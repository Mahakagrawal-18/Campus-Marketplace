// transaction.routes.js — Drop into campus-exchange/routes/
// New endpoints: GET /dashboard, POST /:id/release

const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const txn = require('../controllers/transaction.controller');

// ── Dashboard summary stats ────────────────────────────────────────────────
router.get('/dashboard', protect, txn.getDashboardStats);

// ── My transactions (with role + status filter) ────────────────────────────
router.get('/my', protect, txn.getMyTransactions);

// ── Single transaction ─────────────────────────────────────────────────────
router.get('/:id', protect, txn.getTransaction);

// ── Initiate (buyer reserves item) ────────────────────────────────────────
router.post('/', protect, [
  body('listingId').notEmpty().withMessage('Listing ID required'),
  body('agreedPrice').optional().isFloat({ min: 0 }),
  validate,
], txn.initiateTransaction);

// ── Seller releases item (marks handover done from seller side) ────────────
router.post('/:id/release', protect, txn.releaseTransaction);

// ── Bilateral confirm (either party) ──────────────────────────────────────
router.post('/:id/confirm', protect, txn.confirmTransaction);

// ── Raise dispute ─────────────────────────────────────────────────────────
router.post('/:id/dispute', protect, [
  body('reason').trim().notEmpty().withMessage('Dispute reason required'),
  validate,
], txn.raiseDispute);

// ── Cancel ────────────────────────────────────────────────────────────────
router.post('/:id/cancel', protect, txn.cancelTransaction);

module.exports = router;
