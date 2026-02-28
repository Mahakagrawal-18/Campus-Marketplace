// transaction.controller.js — Extended with Dashboard & Review logic
// Drop this into campus-exchange/controllers/ to replace the existing file

const Transaction = require('../models/Transaction.model');
const Listing     = require('../models/Listing.model');
const Review      = require('../models/Review.model');
const User        = require('../models/User.model');

// ─── POST /api/transactions ───────────────────────────────────────────────────
// Buyer initiates → listing locked → status: Reserved
exports.initiateTransaction = async (req, res) => {
  const { listingId, agreedPrice, meetingLocation, notes } = req.body;

  const listing = await Listing.findById(listingId);
  if (!listing)                        return res.status(404).json({ success: false, message: 'Listing not found' });
  if (listing.status !== 'Available')  return res.status(400).json({ success: false, message: `Item is currently ${listing.status}` });
  if (listing.seller.toString() === req.user._id.toString())
                                       return res.status(400).json({ success: false, message: 'You cannot buy your own listing' });

  listing.status               = 'Reserved';
  listing.reservedBy           = req.user._id;
  listing.reservedAt           = new Date();
  listing.reservationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h
  await listing.save();

  const transaction = await Transaction.create({
    listing:      listing._id,
    buyer:        req.user._id,
    seller:       listing.seller,
    agreedPrice:  agreedPrice || listing.price,
    meetingLocation,
    notes,
  });

  await transaction.populate([
    { path: 'listing', select: 'title price category images' },
    { path: 'buyer',   select: 'name email trustScore profilePicture' },
    { path: 'seller',  select: 'name email trustScore profilePicture' },
  ]);

  res.status(201).json({
    success: true,
    message: 'Item reserved! You have 24 hours to complete the transaction.',
    data:    transaction,
  });
};

// ─── POST /api/transactions/:id/confirm ──────────────────────────────────────
// Bilateral confirmation → both confirmed = Completed
exports.confirmTransaction = async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
  if (transaction.status !== 'Reserved')
    return res.status(400).json({ success: false, message: `Transaction is already ${transaction.status}` });

  const uid     = req.user._id.toString();
  const isBuyer  = transaction.buyer.toString()  === uid;
  const isSeller = transaction.seller.toString() === uid;
  if (!isBuyer && !isSeller)
    return res.status(403).json({ success: false, message: 'Not a participant in this transaction' });

  if (isBuyer  && !transaction.buyerConfirmed)  { transaction.buyerConfirmed  = true; transaction.buyerConfirmedAt  = new Date(); }
  if (isSeller && !transaction.sellerConfirmed) { transaction.sellerConfirmed = true; transaction.sellerConfirmedAt = new Date(); }

  if (transaction.buyerConfirmed && transaction.sellerConfirmed) {
    transaction.status      = 'Completed';
    transaction.completedAt = new Date();

    await Listing.findByIdAndUpdate(transaction.listing, { status: 'Completed' });
    await User.findByIdAndUpdate(transaction.buyer,  { $inc: { totalTransactions: 1, successfulTransactions: 1,trustScore:5 } });

    await User.findByIdAndUpdate(transaction.seller, { $inc: { totalTransactions: 1, successfulTransactions: 1, trustScore:10 } });
  }

  await transaction.save();

  const already = isBuyer ? transaction.sellerConfirmed : transaction.buyerConfirmed;

  res.json({
    success: true,
    message: transaction.status === 'Completed'
      ? '🎉 Transaction complete! Please leave a review.'
      : already
        ? 'Both parties have confirmed — completing transaction.'
        : 'Your confirmation recorded. Waiting for the other party.',
    data: transaction,
  });
};

// ─── POST /api/transactions/:id/dispute ──────────────────────────────────────
exports.raiseDispute = async (req, res) => {
  const { reason } = req.body;
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
  if (transaction.status !== 'Reserved')
    return res.status(400).json({ success: false, message: 'Can only dispute a Reserved transaction' });

  const uid = req.user._id.toString();
  if (transaction.buyer.toString() !== uid && transaction.seller.toString() !== uid)
    return res.status(403).json({ success: false, message: 'Not authorized' });

  transaction.status           = 'Disputed';
  transaction.disputeRaisedBy  = req.user._id;
  transaction.disputeReason    = reason;
  transaction.disputeRaisedAt  = new Date();
  await transaction.save();

  await Listing.findByIdAndUpdate(transaction.listing, {
    status: 'Disputed', reservedBy: null, reservedAt: null, reservationExpiresAt: null,
  });

  res.json({ success: true, message: 'Dispute raised. An admin will review this shortly.', data: transaction });
};

// ─── POST /api/transactions/:id/cancel ───────────────────────────────────────
exports.cancelTransaction = async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
  if (transaction.status !== 'Reserved')
    return res.status(400).json({ success: false, message: 'Only Reserved transactions can be cancelled' });

  const uid = req.user._id.toString();
  if (transaction.buyer.toString() !== uid && transaction.seller.toString() !== uid)
    return res.status(403).json({ success: false, message: 'Not authorized' });

  transaction.status      = 'Cancelled';
  transaction.cancelledAt = new Date();
  await transaction.save();
//  penalty logic 
  if(isSeller){
    await User.findByIdAndUpdate(transaction.seller,{
      $inc:{trustScore:-5}
    })
  }
  if(isBuyer){
    await User.findByIdAndUpdate(transaction.buyer,{
      $inc:{trustScore:-5}
    })
  }

  await Listing.findByIdAndUpdate(transaction.listing, {
    status: 'Available', reservedBy: null, reservedAt: null, reservationExpiresAt: null,
  });

  res.json({ success: true, message: 'Transaction cancelled. Item is available again.' });
};

// ─── POST /api/transactions/:id/release ──────────────────────────────────────
// "Release" = seller marks item handed over (triggers buyer to confirm)
exports.releaseTransaction = async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
  if (transaction.status !== 'Reserved')
    return res.status(400).json({ success: false, message: 'Only Reserved transactions can be released' });
  if (transaction.seller.toString() !== req.user._id.toString())
    return res.status(403).json({ success: false, message: 'Only the seller can release an item' });

  // Seller confirms from their side
  transaction.sellerConfirmed   = true;
  transaction.sellerConfirmedAt = new Date();

  if (transaction.buyerConfirmed) {
    transaction.status      = 'Completed';
    transaction.completedAt = new Date();
    await Listing.findByIdAndUpdate(transaction.listing, { status: 'Completed' });
    await User.findByIdAndUpdate(transaction.buyer,  { $inc: { totalTransactions: 1, successfulTransactions: 1 } });
    await User.findByIdAndUpdate(transaction.seller, { $inc: { totalTransactions: 1, successfulTransactions: 1 } });
  }

  await transaction.save();

  res.json({
    success: true,
    message: transaction.status === 'Completed'
      ? '🎉 Both confirmed — Transaction complete!'
      : 'Item marked as released. Waiting for buyer confirmation.',
    data: transaction,
  });
};

// ─── GET /api/transactions/my ─────────────────────────────────────────────────
exports.getMyTransactions = async (req, res) => {
  const { role = 'all', status } = req.query;

  const filter = {};
  if (role === 'buyer')  filter.buyer  = req.user._id;
  else if (role === 'seller') filter.seller = req.user._id;
  else filter.$or = [{ buyer: req.user._id }, { seller: req.user._id }];
  if (status) filter.status = status;

  const transactions = await Transaction.find(filter)
    .populate('listing', 'title price category images condition')
    .populate('buyer',   'name trustScore profilePicture hostel')
    .populate('seller',  'name trustScore profilePicture hostel')
    .sort('-createdAt');

  // Attach review status for each transaction
  const txWithReviews = await Promise.all(
    transactions.map(async (txn) => {
      const reviewed = await Review.exists({ transaction: txn._id, reviewer: req.user._id });
      return { ...txn.toObject(), hasReviewed: !!reviewed };
    })
  );

  res.json({ success: true, count: txWithReviews.length, data: txWithReviews });
};

// ─── GET /api/transactions/dashboard ─────────────────────────────────────────
// Aggregated stats for the dashboard summary cards
exports.getDashboardStats = async (req, res) => {
  const uid = req.user._id;

  const [asBuyer, asSeller] = await Promise.all([
    Transaction.find({ buyer: uid }),
    Transaction.find({ seller: uid }),
  ]);

  const all = [...asBuyer, ...asSeller];

  const stats = {
    totalTransactions:   all.length,
    asbuyer: {
      total:     asBuyer.length,
      reserved:  asBuyer.filter(t => t.status === 'Reserved').length,
      completed: asBuyer.filter(t => t.status === 'Completed').length,
      cancelled: asBuyer.filter(t => t.status === 'Cancelled').length,
      disputed:  asBuyer.filter(t => t.status === 'Disputed').length,
      totalSpent: asBuyer
        .filter(t => t.status === 'Completed')
        .reduce((sum, t) => sum + t.agreedPrice, 0),
    },
    asSeller: {
      total:     asSeller.length,
      reserved:  asSeller.filter(t => t.status === 'Reserved').length,
      completed: asSeller.filter(t => t.status === 'Completed').length,
      cancelled: asSeller.filter(t => t.status === 'Cancelled').length,
      disputed:  asSeller.filter(t => t.status === 'Disputed').length,
      totalEarned: asSeller
        .filter(t => t.status === 'Completed')
        .reduce((sum, t) => sum + t.agreedPrice, 0),
    },
    trustScore:  req.user.trustScore,
  };

  res.json({ success: true, data: stats });
};

// ─── GET /api/transactions/:id ────────────────────────────────────────────────
exports.getTransaction = async (req, res) => {
  const transaction = await Transaction.findById(req.params.id)
    .populate('listing', 'title price category images description condition')
    .populate('buyer',   'name email trustScore profilePicture hostel phone')
    .populate('seller',  'name email trustScore profilePicture hostel phone');

  if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });

  const uid = req.user._id.toString();
  if (transaction.buyer._id.toString() !== uid && transaction.seller._id.toString() !== uid)
    return res.status(403).json({ success: false, message: 'Not authorized to view this transaction' });

  const hasReviewed = !!(await Review.exists({ transaction: transaction._id, reviewer: req.user._id }));

  res.json({ success: true, data: { ...transaction.toObject(), hasReviewed } });
};
