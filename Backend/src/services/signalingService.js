/**
 * SignalingService
 * ─────────────────────────────────────────────────────────────────────────────
 * WebRTC signaling server built on top of Socket.IO.
 * Mounts a dedicated namespace  /webrtc  so it is cleanly separated from the
 * existing notification/booking namespace.
 *
 * Signal flow (perfect-negotiation pattern):
 *   1. Both peers connect to /webrtc and emit `join-room`
 *   2. Server relays ICE candidates and SDP offers/answers between peers
 *   3. Server emits `room-state` to every new joiner so they can show
 *      accurate presence indicators immediately
 *
 * Events (client → server):
 *   join-room          { roomId, displayName, avatar, role }
 *   leave-room         { roomId }
 *   signal             { roomId, targetUserId, signal }   ← SDP or ICE
 *   media-state        { roomId, micOn, camOn, isScreenSharing }
 *   chat-message       { roomId, text, type }
 *   code-update        { roomId, content }
 *   save-code          { roomId, language, code, label }
 *   recording-start    { roomId }
 *   recording-stop     { roomId }
 *   heartbeat          { roomId }
 *
 * Events (server → client):
 *   room-state         { participants, recordingState, codeContent, sessionId }
 *   participant-joined { participant }
 *   participant-left   { userId }
 *   signal             { fromUserId, signal }
 *   media-state        { userId, micOn, camOn, isScreenSharing }
 *   chat-message       { id, senderId, senderName, text, type, sentAt }
 *   code-update        { content, fromUserId }
 *   recording-started  { startedBy }
 *   recording-stopped  { stoppedBy }
 *   session-ended      {}
 *   error              { code, message }
 *   reconnect-ack      { roomState }
 */

const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const roomService = require('./roomService');
const logger = require('../utils/logger');

class SignalingService {
  /**
   * Mount the /webrtc namespace on an existing Socket.IO instance.
   * Called once from SocketService.initialize().
   *
   * @param {import('socket.io').Server} io
   */
  mount(io) {
    const nsp = io.of('/webrtc');

    // ── Authentication middleware ─────────────────────────────────────────────
    nsp.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.split(' ')[1];

        if (!token) return next(new Error('AUTH_REQUIRED'));

        const decoded = verifyAccessToken(token);
        const user = await User.findById(decoded.userId).select('_id firstName lastName avatar role isActive');
        if (!user || !user.isActive) return next(new Error('AUTH_INVALID'));

        socket.userId = user._id.toString();
        socket.displayName = `${user.firstName} ${user.lastName}`.trim();
        socket.avatar = user.avatar || '';
        socket.userRole = user.role;
        next();
      } catch (err) {
        logger.error('[WS] Auth error:', err.message);
        next(new Error('AUTH_FAILED'));
      }
    });

    // ── Connection handler ────────────────────────────────────────────────────
    nsp.on('connection', (socket) => {
      const uid = socket.userId;
      logger.logSocket('webrtc_connected', socket.id, { userId: uid });

      // ── join-room ─────────────────────────────────────────────────────────
      socket.on('join-room', async ({ roomId, role }) => {
        if (!roomId) return socket.emit('error', { code: 'MISSING_ROOM' });

        try {
          // Store roomId on socket so we can look it up on disconnect
          socket.currentRoomId = roomId;
          socket.join(roomId);

          const room = await roomService.participantJoin(
            roomId,
            uid,
            socket.id,
            role ?? socket.userRole,
            socket.displayName,
            socket.avatar
          );

          // Tell the joiner the full current room state
          socket.emit('room-state', {
            participants: Object.values(room.participants),
            recordingState: room.recordingState,
            codeContent: room.codeContent,
            sessionId: room.sessionId,
          });

          // Tell everyone else a new participant arrived
          socket.to(roomId).emit('participant-joined', {
            participant: room.participants[uid],
          });

          logger.logSocket('joined_room', socket.id, { userId: uid, roomId });
        } catch (err) {
          logger.error('[WS] join-room error:', err);
          socket.emit('error', { code: 'JOIN_FAILED', message: err.message });
        }
      });

      // ── WebRTC signal relay (SDP offer/answer + ICE) ──────────────────────
      socket.on('signal', ({ roomId, targetUserId, signal }) => {
        if (!roomId || !targetUserId || !signal) return;

        // Find the target user's socket in this namespace+room
        const room = nsp.adapter.rooms.get(roomId);
        if (!room) return;

        // Iterate sockets in the room to find the target
        for (const socketId of room) {
          const targetSocket = nsp.sockets.get(socketId);
          if (targetSocket?.userId === targetUserId) {
            targetSocket.emit('signal', { fromUserId: uid, signal });
            break;
          }
        }
      });

      // ── Media state broadcast ─────────────────────────────────────────────
      socket.on('media-state', async ({ roomId, micOn, camOn, isScreenSharing }) => {
        if (!roomId) return;
        await roomService.updateMediaState(roomId, uid, { micOn, camOn, isScreenSharing });
        socket.to(roomId).emit('media-state', { userId: uid, micOn, camOn, isScreenSharing });
      });

      // ── Chat message ──────────────────────────────────────────────────────
      socket.on('chat-message', async ({ roomId, text, type = 'text' }) => {
        if (!roomId || !text?.trim()) return;

        const msg = {
          id: `${uid}-${Date.now()}`,
          senderId: uid,
          senderName: socket.displayName,
          avatar: socket.avatar,
          text: text.trim().slice(0, 2000),
          type,
          sentAt: new Date().toISOString(),
        };

        // Broadcast to everyone in the room including sender
        nsp.to(roomId).emit('chat-message', msg);

        // Persist async (fire-and-forget)
        roomService.persistChatMessage(roomId, uid, msg.text, type).catch((e) =>
          logger.error('[WS] persistChatMessage error:', e)
        );
      });

      // ── Collaborative code editor ─────────────────────────────────────────
      socket.on('code-update', async ({ roomId, content }) => {
        if (!roomId || content === undefined) return;
        // Relay to peers (exclude sender)
        socket.to(roomId).emit('code-update', { content, fromUserId: uid });
        // Debounced persistence handled in roomService
        await roomService.updateCode(roomId, content).catch(() => {});
      });

      socket.on('save-code', async ({ roomId, language, code, label }) => {
        if (!roomId) return;
        await roomService.saveCodeSnapshot(roomId, language ?? 'javascript', code, uid, label)
          .catch((e) => logger.error('[WS] saveCodeSnapshot error:', e));
        nsp.to(roomId).emit('code-saved', { savedBy: uid, label, savedAt: new Date().toISOString() });
      });

      // ── Recording control ─────────────────────────────────────────────────
      socket.on('recording-start', async ({ roomId }) => {
        if (!roomId) return;
        await roomService.setRecordingState(roomId, 'recording').catch(() => {});
        nsp.to(roomId).emit('recording-started', { startedBy: uid });
        logger.logSocket('recording_started', socket.id, { userId: uid, roomId });
      });

      socket.on('recording-stop', async ({ roomId }) => {
        if (!roomId) return;
        await roomService.setRecordingState(roomId, 'stopped').catch(() => {});
        nsp.to(roomId).emit('recording-stopped', { stoppedBy: uid });
        logger.logSocket('recording_stopped', socket.id, { userId: uid, roomId });
      });

      // ── Reconnect / heartbeat ─────────────────────────────────────────────
      socket.on('heartbeat', ({ roomId }) => {
        if (!roomId) return;
        socket.emit('heartbeat-ack', { ts: Date.now() });
      });

      socket.on('reconnect-request', async ({ roomId, role }) => {
        if (!roomId) return;

        try {
          socket.currentRoomId = roomId;
          socket.join(roomId);

          // Re-register participant (roomService handles re-join gracefully)
          const room = await roomService.participantJoin(
            roomId,
            uid,
            socket.id,
            role ?? socket.userRole,
            socket.displayName,
            socket.avatar
          );

          socket.emit('reconnect-ack', {
            roomState: {
              participants: Object.values(room.participants),
              recordingState: room.recordingState,
              codeContent: room.codeContent,
              sessionId: room.sessionId,
            },
          });

          // Tell peers this user is back
          socket.to(roomId).emit('participant-joined', { participant: room.participants[uid] });

          logger.logSocket('reconnected', socket.id, { userId: uid, roomId });
        } catch (err) {
          socket.emit('error', { code: 'RECONNECT_FAILED', message: err.message });
        }
      });

      // ── Disconnect / leave ────────────────────────────────────────────────
      const handleLeave = async (roomId) => {
        if (!roomId) return;
        try {
          socket.leave(roomId);
          await roomService.participantLeave(roomId, uid);
          nsp.to(roomId).emit('participant-left', { userId: uid });
          logger.logSocket('left_room', socket.id, { userId: uid, roomId });
        } catch (err) {
          logger.error('[WS] leave room error:', err);
        }
      };

      socket.on('leave-room', async ({ roomId }) => handleLeave(roomId));

      socket.on('disconnect', async (reason) => {
        logger.logSocket('webrtc_disconnected', socket.id, { userId: uid, reason });
        const roomId = socket.currentRoomId;
        if (roomId) await handleLeave(roomId);
      });
    });

    logger.info('[WS] WebRTC signaling namespace /webrtc mounted');
  }

  /**
   * Emit a server-initiated event to all sockets in a room.
   * Used by session controllers to push events (e.g. "session-ended").
   *
   * @param {import('socket.io').Server} io
   * @param {string} roomId
   * @param {string} event
   * @param {object} data
   */
  emitToRoom(io, roomId, event, data) {
    io.of('/webrtc').to(roomId).emit(event, data);
  }
}

module.exports = new SignalingService();

// Made with Bob
