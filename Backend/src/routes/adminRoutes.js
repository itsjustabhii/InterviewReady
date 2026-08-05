const { Router } = require('express');
const {
  getPlatformStats,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  listAllInterviewers,
  approveInterviewer,
  rejectInterviewer,
  listAllBookings,
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// All admin routes require admin role
router.use(authenticate, authorize('admin'));

router.get('/stats', getPlatformStats);

router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

router.get('/interviewers', listAllInterviewers);
router.patch('/interviewers/:id/approve', approveInterviewer);
router.patch('/interviewers/:id/reject', rejectInterviewer);

router.get('/bookings', listAllBookings);

module.exports = router;

// Made with Bob
