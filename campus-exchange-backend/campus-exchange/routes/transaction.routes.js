const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const txn = require('../controllers/transaction.controller');

router.get('/my', protect, txn.getMyTransactions);
router.get('/:id', protect, txn.getTransaction);

router.post('/', protect, [
  body('listingId').notEmpty().withMessage('Listing ID required'),
  body('agreedPrice').optional().isFloat({ min: 0 }),
  validate,
], txn.initiateTransaction);

router.post('/:id/confirm', protect, txn.confirmTransaction);
router.post('/:id/dispute', protect, [
  body('reason').trim().notEmpty().withMessage('Dispute reason required'),
  validate,
], txn.raiseDispute);
router.post('/:id/cancel', protect, txn.cancelTransaction);

module.exports = router;
