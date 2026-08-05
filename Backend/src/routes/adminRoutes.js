const { Router } = require('express');
const {
  getPlatformStats, getUserAnalytics,
  listUsers, getUser, updateUser, deleteUser,
  listAllInterviewers, approveInterviewer, rejectInterviewer, suspendInterviewer, reactivateInterviewer,
  listAllBookings, cancelBookingAdmin,
  listAllPayments, getPaymentAnalytics, adminInitiateRefund,
  listAllSubscriptions, getSubscriptionAnalytics, adminUpdateSubscription,
  listAllReviews, moderateReview,
  listTestimonials, createTestimonial, updateTestimonial, deleteTestimonial, promoteReviewToTestimonial,
  listCampaigns, getCampaign, createCampaign, updateCampaign, scheduleCampaign, cancelCampaign, deleteCampaign,
  sendPlatformNotification, listPlatformNotifications,
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();
router.use(authenticate, authorize('admin'));

// Stats
router.get('/stats', getPlatformStats);
router.get('/analytics/users', getUserAnalytics);

// Users
router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Interviewers
router.get('/interviewers', listAllInterviewers);
router.patch('/interviewers/:id/approve', approveInterviewer);
router.patch('/interviewers/:id/reject', rejectInterviewer);
router.patch('/interviewers/:id/suspend', suspendInterviewer);
router.patch('/interviewers/:id/reactivate', reactivateInterviewer);

// Bookings
router.get('/bookings', listAllBookings);
router.patch('/bookings/:id/cancel', cancelBookingAdmin);

// Payments
router.get('/payments', listAllPayments);
router.get('/payments/analytics', getPaymentAnalytics);
router.post('/payments/:id/refund', adminInitiateRefund);

// Subscriptions
router.get('/subscriptions', listAllSubscriptions);
router.get('/subscriptions/analytics', getSubscriptionAnalytics);
router.patch('/subscriptions/:id/status', adminUpdateSubscription);

// Reviews
router.get('/reviews', listAllReviews);
router.patch('/reviews/:id/moderate', moderateReview);

// Testimonials
router.get('/testimonials', listTestimonials);
router.post('/testimonials', createTestimonial);
router.post('/testimonials/from-review/:reviewId', promoteReviewToTestimonial);
router.patch('/testimonials/:id', updateTestimonial);
router.delete('/testimonials/:id', deleteTestimonial);

// Email Campaigns
router.get('/campaigns', listCampaigns);
router.post('/campaigns', createCampaign);
router.get('/campaigns/:id', getCampaign);
router.patch('/campaigns/:id', updateCampaign);
router.post('/campaigns/:id/schedule', scheduleCampaign);
router.post('/campaigns/:id/cancel', cancelCampaign);
router.delete('/campaigns/:id', deleteCampaign);

// Platform Notifications
router.get('/notifications', listPlatformNotifications);
router.post('/notifications/broadcast', sendPlatformNotification);

module.exports = router;

// Made with Bob
