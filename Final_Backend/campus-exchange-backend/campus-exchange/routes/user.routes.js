const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const user = require('../controllers/user.controller');

router.get('/me', protect, user.getMe);
router.put('/me', protect, user.updateMe);
router.put('/me/change-password', protect, user.changePassword);
router.get('/:id', user.getUserProfile);

module.exports = router;
