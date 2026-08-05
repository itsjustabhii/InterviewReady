const { Router } = require('express');
const {
  getPlans,
  getMySubscription,
  createSubscription,
  cancelSubscription,
  renewSubscription,
  adminListSubscriptions,
  adminUpdateSubscriptionStatus,
} = require('../controllers/subscriptionController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// Public
router.get('/plans', getPlans);

// Auth required
router.use(authenticate);

router.get('/my', getMySubscription);
router.post('/', createSubscription);
router.post('/my/cancel', cancelSubscription);
router.post('/my/renew', renewSubscription);

// Admin
router.get('/admin/all', authorize('admin'), adminListSubscriptions);
router.patch('/admin/:id/status', authorize('admin'), adminUpdateSubscriptionStatus);

module.exports = router;

// Made with Bob
