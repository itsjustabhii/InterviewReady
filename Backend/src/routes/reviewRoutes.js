const { Router } = require('express');
const {
  createReview,
  getInterviewerReviews,
  getMyReviews,
  respondToReview,
  markHelpful,
  reportReview,
  moderateReview,
} = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// Public
router.get('/interviewer/:interviewerId', getInterviewerReviews);

// Auth required
router.use(authenticate);

router.post('/', createReview);
router.get('/my', getMyReviews);
router.post('/:id/response', respondToReview);
router.post('/:id/helpful', markHelpful);
router.post('/:id/report', reportReview);

// Admin
router.patch('/:id/moderate', authorize('admin'), moderateReview);

module.exports = router;

// Made with Bob
