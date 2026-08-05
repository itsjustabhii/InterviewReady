/**
 * sessionController
 * Handles HTTP API for creating/joining/ending interview sessions.
 */
const { StatusCodes } = require('http-status-codes');
const roomService = require('../services/roomService');
const signalingService = require('../services/signalingService');
const socketService = require('./socketService'); // for emitToRoom
const InterviewSession = require('../models/InterviewSession');
const Booking = require('../models/Booking');
const ApiResponse = require('../utils/response');
const { asyncHandler } = require('../middleware/errorHandler');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');
const config = require('../config');

// ─── GET /api/v1/sessions/room/:bookingId ─────────────────────────────────────
/**
 * Get or create the room for a confirmed booking.
 * Returns roomId + STUN/TURN config so the client can set up RTCPeerConnection.
 */
const getRoomForBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user._id.toString();

  // Verify the requesting user owns or is the interviewer for this booking
  const booking = await Booking.findById(bookingId)
    .populate('interviewer', 'user')
    .populate('user', '_id');

  if (!booking) throw new NotFoundError('Booking not found');

  const isUser = booking.user._id.toString() === userId;
  const isInterviewer = booking.interviewer?.user?.toString() === userId;
  const isAdmin = req.user.role === 'admin';

  if (!isUser && !isInterviewer && !isAdmin) {
    throw new ForbiddenError('You are not a participant of this booking');
  }

  if (!['confirmed', 'in-progress'].includes(booking.status)) {
    throw new BadRequestError(`Cannot join a booking with status "${booking.status}"`);
  }

  const { roomId, sessionId, session } = await roomService.getOrCreateRoom(bookingId, userId);

  return ApiResponse.success(res, {
    roomId,
    sessionId,
    iceServers: buildIceServers(),
    socketNamespace: '/webrtc',
  }, 'Room ready');
});

// ─── GET /api/v1/sessions/:sessionId ─────────────────────────────────────────
const getSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await InterviewSession.findById(sessionId)
    .populate('user', 'firstName lastName avatar')
    .populate({
      path: 'interviewer',
      populate: { path: 'user', select: 'firstName lastName avatar' },
    })
    .populate('booking', 'scheduledDate startTime endTime duration interviewType expertise amount');

  if (!session) throw new NotFoundError('Session not found');

  // Auth: must be participant or admin
  const uid = req.user._id.toString();
  const isParticipant = session.user._id.toString() === uid ||
    session.interviewer?.user?._id?.toString() === uid;
  if (!isParticipant && req.user.role !== 'admin') {
    throw new ForbiddenError('Access denied');
  }

  return ApiResponse.success(res, { session });
});

// ─── POST /api/v1/sessions/:sessionId/end ────────────────────────────────────
const endSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await InterviewSession.findById(sessionId);
  if (!session) throw new NotFoundError('Session not found');

  if (!['in-progress', 'waiting'].includes(session.status)) {
    throw new BadRequestError(`Session is already ${session.status}`);
  }

  await session.end();

  // Emit session-ended to all peers
  if (session.roomId) {
    signalingService.emitToRoom(
      socketService.getIO(),
      session.roomId,
      'session-ended',
      { endedBy: req.user._id.toString() }
    );
  }

  return ApiResponse.success(res, { session }, 'Session ended');
});

// ─── POST /api/v1/sessions/:sessionId/recording ──────────────────────────────
const updateRecording = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { action, url, duration, sizeBytes } = req.body; // action: 'start' | 'complete' | 'fail'

  const session = await InterviewSession.findById(sessionId);
  if (!session) throw new NotFoundError('Session not found');

  if (action === 'complete' && url) {
    session.recording = {
      url,
      duration,
      sizeBytes,
      provider: 'aws_s3',
      status: 'ready',
      processedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };
  } else if (action === 'fail') {
    session.recording = { status: 'failed', processedAt: new Date() };
  }

  await session.save();
  return ApiResponse.success(res, { recording: session.recording });
});

// ─── POST /api/v1/sessions/:sessionId/evaluation ─────────────────────────────
const submitEvaluation = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await InterviewSession.findById(sessionId);
  if (!session) throw new NotFoundError('Session not found');

  await session.submitEvaluation(req.body);
  return ApiResponse.success(res, { evaluation: session.technicalEvaluation }, 'Evaluation submitted');
});

// ─── ICE server configuration ─────────────────────────────────────────────────
function buildIceServers() {
  const servers = [
    { urls: config.webrtc?.stunServer || 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  // Add TURN server if configured
  if (config.webrtc?.turnServer) {
    servers.push({
      urls: config.webrtc.turnServer,
      username: config.webrtc.turnUsername || '',
      credential: config.webrtc.turnCredential || '',
    });
  }

  return servers;
}

module.exports = {
  getRoomForBooking,
  getSession,
  endSession,
  updateRecording,
  submitEvaluation,
};

// Made with Bob
