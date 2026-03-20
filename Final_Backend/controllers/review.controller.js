const Review = require('../models/Review.model');
const Transaction = require('../models/Transaction.model');
const User = require('../models/User.model');

// POST /api/reviews
exports.createReview = async (req, res) => {
  const { transactionId, rating, comment } = req.body;

  const transaction = await Transaction.findById(transactionId);
  if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
  if (transaction.status !== 'Completed') {
    return res.status(400).json({ success: false, message: 'Can only review completed transactions' });
  }

  const userId = req.user._id.toString();
  const isBuyer = transaction.buyer.toString() === userId;
  const isSeller = transaction.seller.toString() === userId;

  if (!isBuyer && !isSeller) {
    return res.status(403).json({ success: false, message: 'Not a participant in this transaction' });
  }

  // Check if already reviewed
  const existing = await Review.findOne({ transaction: transactionId, reviewer: req.user._id });
  if (existing) {
    return res.status(400).json({ success: false, message: 'You have already reviewed this transaction' });
  }

  const revieweeId = isBuyer ? transaction.seller : transaction.buyer;
  const reviewerRole = isBuyer ? 'buyer' : 'seller';

  const review = await Review.create({
    transaction: transactionId,
    reviewer: req.user._id,
    reviewee: revieweeId,
    rating,
    comment,
    reviewerRole,
  });

  // Update reviewee's trust score
  const reviewee = await User.findById(revieweeId);
  await reviewee.updateTrustScore(rating);

  await review.populate([
    { path: 'reviewer', select: 'name profilePicture' },
    { path: 'reviewee', select: 'name trustScore' },
  ]);

  res.status(201).json({ success: true, message: 'Review submitted!', data: review });
};

// GET /api/reviews/user/:userId
exports.getUserReviews = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [reviews, total] = await Promise.all([
    Review.find({ reviewee: req.params.userId })
      .populate('reviewer', 'name profilePicture')
      .populate('transaction', 'agreedPrice completedAt')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit)),
    Review.countDocuments({ reviewee: req.params.userId }),
  ]);

  res.json({
    success: true,
    data: reviews,
    pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
  });
};
