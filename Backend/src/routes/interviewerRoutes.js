const { Router } = require('express');
const {
  listInterviewers,
  getInterviewer,
  applyAsInterviewer,
  updateInterviewer,
  getMyInterviewerProfile,
  setAvailability,
  getFilterMeta,
} = require('../controllers/interviewerController');
const { authenticate, requireInterviewer } = require('../middleware/auth');

const router = Router();

// Public
router.get('/', listInterviewers);
router.get('/filters/meta', getFilterMeta);

// Auth-required
router.get('/me', authenticate, requireInterviewer, getMyInterviewerProfile);
router.post('/', authenticate, applyAsInterviewer);
router.get('/:id', getInterviewer);
router.patch('/:id', authenticate, updateInterviewer);
router.post('/:id/availability', authenticate, requireInterviewer, setAvailability);

module.exports = router;

// Made with Bob
