const { Router } = require('express');
const {
  getProfile,
  updateProfile,
  changePassword,
  updatePreferences,
  deleteAccount,
} = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.use(authenticate);

router.get('/me', getProfile);
router.patch('/me', updateProfile);
router.patch('/me/password', changePassword);
router.patch('/me/preferences', updatePreferences);
router.delete('/me', deleteAccount);

module.exports = router;

// Made with Bob
