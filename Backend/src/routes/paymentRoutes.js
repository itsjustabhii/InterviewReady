const { Router } = require('express');
const {
  createBookingOrder,
  createSubscriptionOrder,
  verifyPayment,
  getPaymentHistory,
  getPayment,
  requestRefund,
  handleWebhook,
  adminListPayments,
} = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// Webhook (no auth — Razorpay signature verified inside handler)
router.post('/webhook', handleWebhook);

// Auth required
router.use(authenticate);

router.post('/orders/booking', createBookingOrder);
router.post('/orders/subscription', createSubscriptionOrder);
router.post('/verify', verifyPayment);
router.get('/history', getPaymentHistory);
router.get('/:id', getPayment);
router.post('/:id/refund', requestRefund);

// Admin
router.get('/admin/all', authorize('admin'), adminListPayments);

module.exports = router;

// Made with Bob
