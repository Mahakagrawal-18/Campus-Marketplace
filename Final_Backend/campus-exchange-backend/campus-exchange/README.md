# Campus Exchange — Backend API

> Secure campus-restricted marketplace for IIT Jodhpur students  
> **Stack:** Node.js · Express · MongoDB · Cloudinary · Nodemailer

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Fill in your values (MongoDB URI, SMTP credentials, JWT secrets, Cloudinary keys)

# 3. Start dev server
npm run dev
```

Server runs at `http://localhost:5000`

---

## 📁 Project Structure

```
campus-exchange/
├── server.js                  # Entry point
├── config/
│   └── db.js                  # MongoDB connection
├── models/
│   ├── User.model.js          # User + trust score
│   ├── Listing.model.js       # Item listings
│   ├── Transaction.model.js   # Escrow state machine
│   └── Review.model.js        # Bilateral ratings
├── controllers/
│   ├── auth.controller.js
│   ├── user.controller.js
│   ├── listing.controller.js
│   ├── transaction.controller.js
│   └── review.controller.js
├── routes/
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── listing.routes.js
│   ├── transaction.routes.js
│   └── review.routes.js
├── middleware/
│   ├── auth.middleware.js     # JWT protect + optional auth
│   └── validate.middleware.js # express-validator runner
└── utils/
    ├── email.util.js          # OTP email sender
    └── jwt.util.js            # Token generators
```

---

## 🔐 Authentication

Only `@iitj.ac.in` email addresses are accepted at the model level and route validation level.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register with IITJ email |
| POST | `/api/auth/verify-email` | Verify email OTP |
| POST | `/api/auth/resend-otp` | Resend OTP |
| POST | `/api/auth/login` | Login → access + refresh tokens |
| POST | `/api/auth/refresh-token` | Get new access token |
| POST | `/api/auth/logout` | Logout (invalidate refresh token) |
| POST | `/api/auth/forgot-password` | Send password reset OTP |
| POST | `/api/auth/reset-password` | Reset password with OTP |

**Auth header:** `Authorization: Bearer <accessToken>`

---

## 👤 Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/me` | ✅ | Get own profile |
| PUT | `/api/users/me` | ✅ | Update profile |
| PUT | `/api/users/me/change-password` | ✅ | Change password |
| GET | `/api/users/:id` | ❌ | Public user profile + reviews |

---

## 📦 Listings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/listings` | Optional | Browse/search listings |
| GET | `/api/listings/my` | ✅ | Own listings |
| GET | `/api/listings/:id` | Optional | Single listing detail |
| POST | `/api/listings` | ✅ | Create listing |
| PUT | `/api/listings/:id` | ✅ | Update own listing |
| DELETE | `/api/listings/:id` | ✅ | Soft-delete own listing |
| POST | `/api/listings/:id/images` | ✅ | Upload images (max 5) |

**Query params for GET /api/listings:**
- `search` — full-text search
- `category` — Books | Electronics | Cycles | Hostel Essentials | Clothing | Sports | Stationery | Other
- `condition` — New | Like New | Good | Fair | Poor
- `minPrice`, `maxPrice`
- `page`, `limit`, `sort`

---

## 🔒 Transactions (Escrow)

```
Listing Available
     │
     ▼ buyer initiates
  Reserved  ──── dispute ────► Disputed
     │
     ├── buyer confirms ─┐
     └── seller confirms ─┤
                          ▼
                      Completed
```

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/transactions/my` | ✅ | My transactions (buyer/seller) |
| GET | `/api/transactions/:id` | ✅ | Single transaction |
| POST | `/api/transactions` | ✅ | Initiate (buyer) |
| POST | `/api/transactions/:id/confirm` | ✅ | Confirm receipt/handover |
| POST | `/api/transactions/:id/dispute` | ✅ | Raise dispute |
| POST | `/api/transactions/:id/cancel` | ✅ | Cancel transaction |

---

## ⭐ Reviews

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/reviews/user/:userId` | ❌ | Reviews for a user |
| POST | `/api/reviews` | ✅ | Leave review (completed transactions only) |

Both buyer and seller can review each other after a completed transaction. Reviews automatically update the recipient's trust score (running average, 1–5).

---

## 🛡️ Security Features

- Helmet.js headers
- Rate limiting (100 req / 15 min globally)
- IITJ domain enforcement at schema + validation level
- Password hashing with bcrypt (12 rounds)
- JWT access (7d) + refresh token (30d) pattern
- OTP expiry (10 minutes)
- Listing lock prevents double-selling (escrow)
- Image upload restricted to jpeg/jpg/png/webp, 5MB max

---

## 🌱 Environment Variables

See `.env.example` for all required variables.
