# Samiul Publication — e-book store

A mobile-friendly, Android-phone-responsive starter website for a Bengali e-book publisher. It includes a storefront, category shelves, admin login, publish/edit/hide/delete books, configurable prices, PDF/EPUB uploads, and an order-record scaffold.

## Requirements
- Node.js 18 or newer
- npm

## Run locally
1. Extract this folder.
2. Copy `.env.example` to `.env`.
3. Change `ADMIN_PASSWORD` and `SESSION_SECRET` in `.env`.
4. In this folder run:
   ```bash
   npm install
   npm start
   ```
5. Open `http://localhost:3000`
6. Admin: `http://localhost:3000/admin/login` (use credentials set in `.env`).

The seeded demo book is “অন্তিম রহস্য” by Samiul at ৳99. You can edit or remove it from the admin dashboard.

## Important: payments are NOT live yet
The checkout page currently records a **pending** order only. It does not collect money and does not grant an ebook download. This is intentional: live payment requires an approved merchant account and verified server-to-server gateway integration. Never mark an order paid based only on a browser redirect or a submitted form.

For Bangladesh, choose a payment provider (for example bKash merchant checkout, Nagad merchant payment, or SSLCOMMERZ hosted checkout), obtain merchant credentials directly from that provider, and implement:
- create-payment call on the server,
- verified callback/IPN validation,
- amount/order matching and idempotency,
- paid status update only after verification,
- protected, expiring download links after payment,
- HTTPS in production.

The included `.env.example` contains placeholders only; no live gateway is connected. Provider APIs and onboarding terms can change, so use the provider's current official merchant documentation.

## Before production
- Use HTTPS and a production session store (not Express MemoryStore).
- Use a strong unique admin password and secret; add login rate-limiting and CSRF protection.
- Store ebooks privately, not in a public static directory; serve only after verified payment.
- Back up the database and uploads.
- Add email receipts, refund/support policy, privacy notice, and terms.
- Consider cloud storage and a managed database for a deployed service.

## Phone-friendly layout
The storefront and admin dashboard use responsive layouts for Android browsers, with touch-sized controls and mobile forms. You still need Node.js hosting/server to run the app; the ZIP file itself does not install as an Android app.
