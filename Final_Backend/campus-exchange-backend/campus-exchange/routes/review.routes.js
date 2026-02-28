const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const review = require('../controllers/review.controller');

router.get('/user/:userId', review.getUserReviews);

router.post('/', protect, [
  body('transactionId').notEmpty().withMessage('Transaction ID required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 500 }),
  validate,
], review.createReview);

module.exports = router;
