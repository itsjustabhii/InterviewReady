const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { authenticate, authorize } = require('../middleware/auth');

// Get/create room for a confirmed booking
router.get('/room/:bookingId', authenticate, sessionController.getRoomForBooking);

// Get session detail
router.get('/:sessionId', authenticate, sessionController.getSession);

// End a session (interviewer or admin)
router.post('/:sessionId/end', authenticate, sessionController.endSession);

// Update recording metadata (called by recording service/webhook)
router.post('/:sessionId/recording', authenticate, sessionController.updateRecording);

// Submit post-session evaluation (interviewer only)
router.post('/:sessionId/evaluation', authenticate, sessionController.submitEvaluation);

module.exports = router;

// Made with Bob
