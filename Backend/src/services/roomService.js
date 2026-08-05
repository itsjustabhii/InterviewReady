/**
 * RoomService
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages in-memory room state for live WebRTC interview sessions.
 * Also persists state to Redis so multi-process deployments stay consistent.
 *
 * Room lifecycle:
 *   create  → waiting (host joined)
 *   join    → in-progress (both participants present)
 *   leave   → ended / participant left
 *
 * A room is keyed by the InterviewSession.roomId  (UUID, set at booking confirm).
 * Each room tracks:
 *   - participants: Map<userId, ParticipantInfo>
 *   - metadata: sessionId, bookingId, scheduledDuration
 *   - recording state
 *   - code editor content (last known state for late-joiners)
 */

const { v4: uuidv4 } = require('uuid');
const redisClient = require('../config/redis');
const InterviewSession = require('../models/InterviewSession');
const Booking = require('../models/Booking');
const logger = require('../utils/logger');

const ROOM_TTL = 4 * 60 * 60; // 4 hours max room lifetime
const ROOM_KEY = (roomId) => `room:${roomId}`;

class RoomService {
  constructor() {
    // Local in-process cache (primary for single-process; Redis is the truth for multi-process)
    this._rooms = new Map();
  }

  // ─── Room creation ──────────────────────────────────────────────────────────

  /**
   * Create or retrieve the room for a booking.
   * Called by the session join endpoint before the user opens the WebRTC page.
   *
   * @param {string} bookingId
   * @param {string} requestingUserId
   * @returns {{ roomId, sessionId, room }}
   */
  async getOrCreateRoom(bookingId, requestingUserId) {
    // Find the InterviewSession linked to this booking
    let session = await InterviewSession.findOne({ booking: bookingId })
      .populate('user', 'firstName lastName avatar')
      .populate({
        path: 'interviewer',
        populate: { path: 'user', select: 'firstName lastName avatar' },
      });

    if (!session) {
      // First time: create the session
      const booking = await Booking.findById(bookingId)
        .populate('interviewer', 'user')
        .populate('user', '_id');

      if (!booking) throw new Error('Booking not found');
      if (!['confirmed', 'in-progress'].includes(booking.status)) {
        throw new Error('Booking is not confirmed');
      }

      const roomId = uuidv4();
      session = await InterviewSession.create({
        booking: bookingId,
        user: booking.user._id,
        interviewer: booking.interviewer._id,
        status: 'waiting',
        roomId,
        meetingProvider: 'webrtc',
        scheduledStartAt: booking.scheduledDate,
        scheduledEndAt: new Date(
          new Date(booking.scheduledDate).getTime() + booking.duration * 60 * 1000
        ),
      });

      // Also update the Booking with the meeting link
      await Booking.findByIdAndUpdate(bookingId, {
        meetingLink: `/room/${roomId}`,
        meetingId: roomId,
      });
    }

    const roomId = session.roomId;
    await this._persistRoom(roomId, {
      roomId,
      sessionId: session._id.toString(),
      bookingId: bookingId.toString(),
      participants: {},
      recordingState: 'idle', // 'idle' | 'recording' | 'stopped'
      codeContent: '',
      createdAt: Date.now(),
    });

    return { roomId, sessionId: session._id.toString(), session };
  }

  /**
   * Register a participant joining a room.
   * Returns the current room state so the joining client can bootstrap.
   */
  async participantJoin(roomId, userId, socketId, role, displayName, avatar) {
    const room = await this._getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    room.participants[userId] = {
      userId,
      socketId,
      role,
      displayName,
      avatar,
      joinedAt: Date.now(),
      micOn: true,
      camOn: true,
      isScreenSharing: false,
      connectionState: 'connecting',
    };

    await this._persistRoom(roomId, room);

    // Update InterviewSession
    await InterviewSession.findByIdAndUpdate(room.sessionId, {
      $set: { [`participants`]: Object.values(room.participants).map((p) => ({
        user: p.userId,
        role: p.role,
        joinedAt: new Date(p.joinedAt),
      })) },
      status: Object.keys(room.participants).length >= 2 ? 'in-progress' : 'waiting',
      ...(Object.keys(room.participants).length === 1 ? { actualStartAt: new Date() } : {}),
    });

    logger.info(`[Room] ${displayName} (${role}) joined room ${roomId}`);
    return room;
  }

  /**
   * Register a participant leaving a room.
   */
  async participantLeave(roomId, userId) {
    const room = await this._getRoom(roomId);
    if (!room) return;

    const participant = room.participants[userId];
    if (participant) {
      participant.connectionState = 'disconnected';
      participant.leftAt = Date.now();
    }

    // If both participants have left, mark session ended
    const connected = Object.values(room.participants).filter(
      (p) => p.connectionState !== 'disconnected'
    );

    await this._persistRoom(roomId, room);

    if (connected.length === 0) {
      await this._endSession(room.sessionId);
    }

    logger.info(`[Room] User ${userId} left room ${roomId}`);
    return room;
  }

  /**
   * Update a participant's media state (mic, cam, screen share).
   */
  async updateMediaState(roomId, userId, updates) {
    const room = await this._getRoom(roomId);
    if (!room?.participants[userId]) return;
    Object.assign(room.participants[userId], updates);
    await this._persistRoom(roomId, room);
    return room.participants[userId];
  }

  /**
   * Update the shared code editor content.
   */
  async updateCode(roomId, content) {
    const room = await this._getRoom(roomId);
    if (!room) return;
    room.codeContent = content;
    await this._persistRoom(roomId, room);
  }

  /**
   * Persist a code snapshot to the InterviewSession document.
   */
  async saveCodeSnapshot(roomId, language, code, userId, label = '') {
    const room = await this._getRoom(roomId);
    if (!room) return;
    await InterviewSession.findByIdAndUpdate(room.sessionId, {
      $push: { codeSnapshots: { language, code, savedBy: userId, label, savedAt: new Date() } },
    });
  }

  /**
   * Save a chat message to the persistent session log.
   */
  async persistChatMessage(roomId, senderId, message, type = 'text') {
    const room = await this._getRoom(roomId);
    if (!room) return;
    await InterviewSession.findByIdAndUpdate(room.sessionId, {
      $push: { chatLog: { sender: senderId, message, type, sentAt: new Date() } },
    });
  }

  /**
   * Mark recording started/stopped.
   */
  async setRecordingState(roomId, state) {
    const room = await this._getRoom(roomId);
    if (!room) return;
    room.recordingState = state;
    await this._persistRoom(roomId, room);
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  async getRoom(roomId) {
    return this._getRoom(roomId);
  }

  async getParticipant(roomId, userId) {
    const room = await this._getRoom(roomId);
    return room?.participants[userId] ?? null;
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  async _persistRoom(roomId, room) {
    this._rooms.set(roomId, room);
    await redisClient.set(ROOM_KEY(roomId), room, ROOM_TTL);
  }

  async _getRoom(roomId) {
    // Check local cache first
    if (this._rooms.has(roomId)) return this._rooms.get(roomId);
    // Fall back to Redis
    const data = await redisClient.get(ROOM_KEY(roomId));
    if (data) this._rooms.set(roomId, data);
    return data ?? null;
  }

  async _endSession(sessionId) {
    await InterviewSession.findByIdAndUpdate(sessionId, {
      status: 'ended',
      actualEndAt: new Date(),
    });
    logger.info(`[Room] Session ${sessionId} marked as ended`);
  }
}

module.exports = new RoomService();

// Made with Bob
