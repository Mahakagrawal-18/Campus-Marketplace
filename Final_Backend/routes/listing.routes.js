const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body } = require('express-validator');
const { protect, optionalAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const listing = require('../controllers/listing.controller');

const storage = multer.diskStorage({
  destination: '/tmp/uploads',
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    cb(null, allowed.test(file.mimetype));
  },
});

const listingValidation = [
  body('title').trim().notEmpty().withMessage('Title required').isLength({ max: 100 }),
  body('description').trim().notEmpty().withMessage('Description required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
  body('category').isIn(['Books', 'Electronics', 'Cycles', 'Hostel Essentials', 'Clothing', 'Sports & Supplies', 'Stationery', 'Course Subscription','Labs Supplies','Other']),
  body('condition').isIn(['New', 'Like New', 'Good', 'Fair', 'Poor']),
  validate,
];

router.get('/', optionalAuth, listing.getListings);
router.get('/my', protect, listing.getMyListings);
router.get('/:id', optionalAuth, listing.getListing);

router.post('/', protect, listingValidation, listing.createListing);
router.put('/:id', protect, listing.updateListing);
router.delete('/:id', protect, listing.deleteListing);
router.post('/:id/images', protect, upload.array('images', 5), listing.uploadImages);

router.post('/:id/reserve', protect, listing.reserveListing);
router.post('/:id/complete', protect, listing.completeSale);
router.post('/:id/cancel', protect, listing.cancelReservation);

module.exports = router;
