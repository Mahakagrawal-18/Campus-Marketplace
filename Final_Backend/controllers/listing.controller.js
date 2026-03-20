const Listing = require('../models/Listing.model');
const User = require('../models/User.model');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// GET /api/listings  — search, filter, paginate
exports.getListings = async (req, res) => {
  const {
    search, category, condition, minPrice, maxPrice,
    page = 1, limit = 20, sort = '-createdAt',
  } = req.query;

  const filter = { status: 'Available' };

  if (search) filter.$text = { $search: search };
  if (category) filter.category = category;
  if (condition) filter.condition = condition;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [listings, total] = await Promise.all([
    Listing.find(filter)
      .populate('seller', 'name trustScore profilePicture hostel')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit)),
    Listing.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: listings,
    pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit) },
  });
};

// GET /api/listings/:id
exports.getListing = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);

        if (!listing) {
            return res.status(404).json({ success: false, message: "Not found" });
        }

        res.json({ success: true, data: listing });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// POST /api/listings
exports.createListing = async (req, res) => {
  const { title, description, price, category, condition, isNegotiable, tags } = req.body;

  try {
    const listing = await Listing.create({
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      condition: req.body.condition,
      seller: req.user._id
    });

    res.status(201).json({
      success: true,
      data: listing
    });

  } catch (error) {
    console.error("Create listing error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
// PUT /api/listings/:id
exports.updateListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
  if (listing.seller.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized to update this listing' });
  }
  if (listing.status !== 'Available') {
    return res.status(400).json({ success: false, message: 'Cannot edit a listing that is not Available' });
  }

  const allowed = ['title', 'description', 'price', 'category', 'condition', 'isNegotiable', 'tags'];
  allowed.forEach((f) => { if (req.body[f] !== undefined) listing[f] = req.body[f]; });
  await listing.save();

  res.json({ success: true, data: listing });
};

// DELETE /api/listings/:id
exports.deleteListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
  if (listing.seller.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  if (listing.status === 'Reserved') {
    return res.status(400).json({ success: false, message: 'Cannot delete a reserved listing. Cancel the transaction first.' });
  }

  listing.status = 'Removed';
  await listing.save();
  res.json({ success: true, message: 'Listing removed' });
};
// reserve lisiting
exports.reserveListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing)
    return res.status(404).json({ success: false, message: 'Listing not found' });

  if (listing.status !== 'Available')
    return res.status(400).json({ success: false, message: 'Listing not available' });

  if (listing.seller.toString() === req.user._id.toString())
    return res.status(400).json({ success: false, message: 'Cannot reserve your own listing' });

  listing.status = 'Reserved';
  listing.reservedBy = req.user._id;
  listing.reservedAt = new Date();
  listing.reservationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await listing.save();

  res.json({ success: true, message: 'Listing reserved', data: listing });
};
// complete sale 
exports.completeSale = async (req, res) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing)
    return res.status(404).json({ success: false, message: 'Listing not found' });

  if (listing.seller.toString() !== req.user._id.toString())
    return res.status(403).json({ success: false, message: 'Only seller can complete sale' });

  if (listing.status !== 'Reserved')
    return res.status(400).json({ success: false, message: 'Listing must be reserved first' });

  listing.status = 'Sold';
  await listing.save();
  // Increase trust score
  const seller = await User.findById(listing.seller);
  const buyer = await User.findById(listing.reservedBy);

  if (seller) seller.trustScore += 5;
  if (buyer) buyer.trustScore += 3;

  await seller.save();
  await buyer.save();

  res.json({ success: true, message: 'Sale completed', data: listing });
};
// cancel reservation
exports.cancelReservation = async (req, res) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing)
    return res.status(404).json({ success: false, message: 'Listing not found' });

  if (
    listing.reservedBy?.toString() !== req.user._id.toString() &&
    listing.seller.toString() !== req.user._id.toString()
  )
    return res.status(403).json({ success: false, message: 'Not authorized' });

  listing.status = 'Available';
  listing.reservedBy = null;
  listing.reservedAt = null;
  listing.reservationExpiresAt = null;

  await listing.save();
  // Small penalty to buyer for cancellation
  if (listing.reservedBy) {
    const buyer = await User.findById(listing.reservedBy);
    if (buyer) {
      buyer.trustScore -= 2;
      await buyer.save();
    }
  }

  res.json({ success: true, message: 'Reservation cancelled', data: listing });
};

// POST /api/listings/:id/images
exports.uploadImages = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
  if (listing.seller.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'No images uploaded' });
  }

  const uploads = await Promise.all(
    req.files.map((file) =>
      cloudinary.uploader.upload(file.path, { folder: 'campus-exchange/listings' })
    )
  );

  const newImages = uploads.map((r) => ({ url: r.secure_url, publicId: r.public_id }));
  listing.images.push(...newImages);
  await listing.save();

  res.json({ success: true, images: listing.images });
};

// GET /api/listings/my  — seller's own listings
exports.getMyListings = async (req, res) => {
  const listings = await Listing.find({ seller: req.user._id }).sort('-createdAt');
  res.json({ success: true, data: listings });
};
