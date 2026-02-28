const Transaction = require('../models/Transaction.model');
const Listing = require('../models/Listing.model');
const User = require('../models/User.model');

// POST /api/transactions  — Buyer initiates: Reserved
exports.initiateTransaction = async (req, res) => {
  const { listingId, agreedPrice, meetingLocation, notes } = req.body;

  const listing = await Listing.findById(listingId);
  if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
  if (listing.status !== 'Available') {
    return res.status(400).json({ success: false, message: `Listing is currently ${listing.status}` });
  }
  if (listing.seller.toString() === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: 'You cannot buy your own listing' });
  }

  // Lock the listing → Reserved (escrow)
  listing.status = 'Reserved';
  listing.reservedBy = req.user._id;
  listing.reservedAt = new Date();
  listing.reservationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await listing.save();

  const transaction = await Transaction.create({
    listing: listing._id,
    buyer: req.user._id,
    seller: listing.seller,
    agreedPrice: agreedPrice || listing.price,
    meetingLocation,
    notes,
  });

  await transaction.populate([
    { path: 'listing', select: 'title price category images' },
    { path: 'buyer', select: 'name email trustScore' },
    { path: 'seller', select: 'name email trustScore' },
  ]);

  res.status(201).json({
    success: true,
    message: 'Transaction initiated. Item is now reserved for 24 hours.',
    data: transaction,
  });
};

// POST /api/transactions/:id/confirm  — Bilateral confirmation → Completed
exports.confirmTransaction = async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
  if (transaction.status !== 'Reserved') {
    return res.status(400).json({ success: false, message: `Transaction is already ${transaction.status}` });
  }

  const userId = req.user._id.toString();
  const isBuyer = transaction.buyer.toString() === userId;
  const isSeller = transaction.seller.toString() === userId;

  if (!isBuyer && !isSeller) {
    return res.status(403).json({ success: false, message: 'Not authorized for this transaction' });
  }

  if (isBuyer) { transaction.buyerConfirmed = true; transaction.buyerConfirmedAt = new Date(); }
  if (isSeller) { transaction.sellerConfirmed = true; transaction.sellerConfirmedAt = new Date(); }

  // Both confirmed → Complete
  if (transaction.buyerConfirmed && transaction.sellerConfirmed) {
    transaction.status = 'Completed';
    transaction.completedAt = new Date();

    const listing = await Listing.findById(transaction.listing);
    listing.status = 'Completed';
    await listing.save();

    // Update transaction counts
    await User.findByIdAndUpdate(transaction.buyer, { $inc: { totalTransactions: 1, successfulTransactions: 1 } });
    await User.findByIdAndUpdate(transaction.seller, { $inc: { totalTransactions: 1, successfulTransactions: 1 } });
  }

  await transaction.save();

  res.json({
    success: true,
    message: transaction.status === 'Completed'
      ? '🎉 Transaction completed! You can now leave a review.'
      : 'Confirmation recorded. Waiting for the other party.',
    data: transaction,
  });
};

// POST /api/transactions/:id/dispute  — Raise a dispute
exports.raiseDispute = async (req, res) => {
  const { reason } = req.body;
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
  if (transaction.status !== 'Reserved') {
    return res.status(400).json({ success: false, message: 'Can only dispute a Reserved transaction' });
  }

  const userId = req.user._id.toString();
  if (transaction.buyer.toString() !== userId && transaction.seller.toString() !== userId) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  transaction.status = 'Disputed';
  transaction.disputeRaisedBy = req.user._id;
  transaction.disputeReason = reason;
  transaction.disputeRaisedAt = new Date();
  await transaction.save();

  // Unlock listing back to Available
  await Listing.findByIdAndUpdate(transaction.listing, {
    status: 'Disputed',
    reservedBy: null,
    reservedAt: null,
    reservationExpiresAt: null,
  });

  res.json({ success: true, message: 'Dispute raised. An admin will review this.', data: transaction });
};

// POST /api/transactions/:id/cancel  — Cancel (only if Reserved and not yet confirmed)
exports.cancelTransaction = async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
  if (transaction.status !== 'Reserved') {
    return res.status(400).json({ success: false, message: 'Cannot cancel this transaction' });
  }

  const userId = req.user._id.toString();
  if (transaction.buyer.toString() !== userId && transaction.seller.toString() !== userId) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  transaction.status = 'Cancelled';
  transaction.cancelledAt = new Date();
  await transaction.save();

  // Release listing back to Available
  await Listing.findByIdAndUpdate(transaction.listing, {
    status: 'Available',
    reservedBy: null,
    reservedAt: null,
    reservationExpiresAt: null,
  });

  res.json({ success: true, message: 'Transaction cancelled. Listing is now available again.' });
};

// GET /api/transactions/my
exports.getMyTransactions = async (req, res) => {
  const { role = 'all', status } = req.query;
  const filter = {};

  if (role === 'buyer') filter.buyer = req.user._id;
  else if (role === 'seller') filter.seller = req.user._id;
  else filter.$or = [{ buyer: req.user._id }, { seller: req.user._id }];

  if (status) filter.status = status;

  const transactions = await Transaction.find(filter)
    .populate('listing', 'title price category images')
    .populate('buyer', 'name trustScore profilePicture')
    .populate('seller', 'name trustScore profilePicture')
    .sort('-createdAt');

  res.json({ success: true, data: transactions });
};

// GET /api/transactions/:id
exports.getTransaction = async (req, res) => {
  const transaction = await Transaction.findById(req.params.id)
    .populate('listing', 'title price category images description')
    .populate('buyer', 'name email trustScore profilePicture hostel phone')
    .populate('seller', 'name email trustScore profilePicture hostel phone');

  if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });

  const userId = req.user._id.toString();
  if (transaction.buyer._id.toString() !== userId && transaction.seller._id.toString() !== userId) {
    return res.status(403).json({ success: false, message: 'Not authorized to view this transaction' });
  }

  res.json({ success: true, data: transaction });
};
