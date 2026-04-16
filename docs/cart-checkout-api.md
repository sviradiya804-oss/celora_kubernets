# Cart & Checkout API Contract

Version: 1.0

This document describes the HTTP API surface, request/response shapes, validation rules, and integration notes for the Cart & Checkout flow used by the frontend. It aims to be a single source of truth so frontend and backend remain aligned.

Base paths used in this project (confirm in `src/server.js` / router mounts):
- API prefix: `/api` (routes in the repository use `/api/cart/*`, `/api/customer-order/*`, `/api/orders/*`)

If your local server uses a different port than the examples below, substitute it accordingly.

## Quick run commands (PowerShell)
Start server on port 5000 for local testing:
```powershell
$env:PORT=5000; node src/server.js
```

Run the automated test script included in repository:
```powershell
node test-cart-checkout-flow.js
```

---

## Common shapes and conventions

- sessionId: string (UUID) — identifies an anonymous or logged-in cart session.
- userId: string (ObjectId) — optional if user is not logged in; used to attach cart to a user.
- productId: string (ObjectId) — product reference id.
- productDetails: embedded object snapshot of product at time of add/checkout. Should include `title`, `price`, `images` (array), and `imageUrl` (first image fallback).
- image fields: the API will expose `productDetails.images` (array) and an item-level `imageUrl` for easiest frontend access. Either may be used by the frontend — prefer `productDetails.images[0]` if available.

Engraving canonical recommendation (choose one; backend currently accepts both legacy shapes):
- Preferred per-item engraving shape (canonical):

```json
"selectedOptions": {
  "engraving": {
    "text": "Forever Yours",
    "font": "Script",
    "position": "Inside Band"
  }
}
```

If your frontend currently posts `engravingOptions` at top-level, the backend will try to read `selectedOptions.engraving` first and fall back to `engravingOptions`.

---

## Endpoints (Cart)

1) Add item to cart
- Method: POST
- Path: /api/cart/add
- Description: Add a product to cart or update an existing item. Creates a cart for the sessionId if none exists.
- Request JSON:

```json
{
  "sessionId": "<uuid>",
  "userId": "<userId>",
  "productId": "<productId>",
  "quantity": 2,
  "selectedOptions": { /* per-product options, includes engraving */ },
  "engravingOptions": { "engravingText": "Forever Yours", "font": "Script" }
}
```

- Notes:
  - `selectedOptions.engraving` is the preferred location for engraving metadata.
  - Backend will snapshot `productDetails` (price, images) when saving to cart/order.

- Success Response (200):

```json
{
  "success": true,
  "cart": { "_id": "...", "items": [ ... ] },
  "sessionId": "<sessionId>"
}
```

2) Get cart
- Method: GET
- Path: /api/cart/:userId?sessionId=<sessionId>
- Description: Returns the cart for the given userId and sessionId. If the server adopted a different session, check the returned sessionId.
- Success Response (200):

```json
{
  "success": true,
  "cart": {
    "items": [
      {
        "productId": "...",
        "product": { "title": "...", "images": ["..."], "imageUrl": "..." },
        "quantity": 2,
        "priceAtTime": 1999.99,
        "engravingOptions": { "engravingText": "Forever Yours", "font": "Script" }
      }
    ],
    "summary": { "subtotal": 3999.98, "total": 3999.98 }
  }
}
```

3) Update cart item / quantity
- Method: PUT
- Path: /api/cart/update
- Request JSON: { sessionId, userId, productId, quantity }
- Success response: updated cart

4) Remove item
- Method: DELETE
- Path: /api/cart/remove/:productId
- Body: { sessionId, userId }
- Success response: updated cart

5) Clear cart
- Method: DELETE
- Path: /api/cart/clear
- Body: { sessionId, userId }
- Success response: cart cleared

6) Update customer info (billing & shipping)
- Method: POST
- Path: /api/cart/update-customer-info
- Request JSON: { userId, phone, billingAddress: {...}, shippingAddress: {...} }
- Success: customer info updated and attached to cart

7) Get customer info
- Method: GET
- Path: /api/cart/customer-info/:userId
- Success: customer object with name/email/addresses

8) Apply coupon (optional)
- Method: POST
- Path: /api/cart/apply-coupon
- Request JSON: { sessionId, userId, code }
- Note: coupon may fail validation; treat as optional in front-end flows if not essential.

9) Debug cart (internal / optional)
- Method: GET
- Path: /api/cart/debug/cart/:userId/:sessionId
- Use: admin/debug view; may not be available in all environments

---

## Checkout / Payment endpoints

1) Create Stripe session (checkout)
- Method: POST
- Path: /api/cart/checkout
- Request JSON (example):

```json
{
  "sessionId": "<uuid>",
  "userId": "<userId>",
  "shippingDetails": {
    "estimatedDeliveryDays": 5,
    "deliveryDateStart": "2025-10-12",
    "deliveryDateEnd": "2025-10-14",
    "shippingMethod": "Standard",
    "shippingCost": 0
  }
}
```

- Behavior:
  - Snapshots cart items into an `Order` document, including `productDetails` (images and price), `priceAtTime`, and `engravingOptions`.
  - Creates a Stripe Checkout session and returns the session URL and `orderId` (order may be saved in pending state until webhook confirms payment).

- Success Response (200):
```json
{
  "success": true,
  "url": "https://checkout.stripe.com/...",
  "sessionId": "...",
  "orderId": "ORD1234",
  "orderSummary": { "subtotal": 1999.99, "discount": 0, "total": 1999.99, "itemCount": 1 }
}
```

2) Payment webhook (Stripe)
- Path: as configured in Stripe & `src/routes/payment.js` handles webhooks.
- Behavior: when payment succeeds, webhook finalizes the order (mark paymentStatus, update progress), triggers emails, and clears cart.

---

## Public order status / tracking (frontend order page)

1) Customer-facing status
- Method: GET
- Path: /api/customer-order/status/:orderId
- Description: Returns a structured `order` object for the order tracking page.
- Response shape (important fields):

```json
{
  "success": true,
  "order": {
    "orderId": "ORD1234",
    "status": "confirmed",
    "paymentStatus": "paid",
    "total": 1999.99,
    "formattedTotal": "$1999.99",
    "customer": { "name": "Jane Doe", "email": "jane@example.com" },
    "products": [
      {
        "id": "68e22c...",
        "title": "Oval Classic Ring",
        "description": "...",
        "quantity": 1,
        "price": 1999.99,
        "formattedPrice": "$1999.99",
        "total": 1999.99,
        "formattedTotal": "$1999.99",
        "images": ["https://.../img1.jpg", "https://.../img2.jpg"],
        "type": "jewelry"
      }
    ],
    "progress": [ /* steps with images for manufacturing/shipping */ ]
  }
}
```

- Important frontend notes:
  - The response guarantees `products[*].images` (array) or an `imageUrl` fallback per product item. Use `images[0]` as primary display image.
  - `formattedPrice` and `formattedTotal` are provided for display convenience.

2) Admin order GET
- Method: GET
- Path: /api/orders/:orderId
- Notes: returns richer order document for admin UI. The API now normalizes `productDetails.images` and sets `imageUrl` per ordered item. It also surfaces `payment` (normalized payment details) on the returned order.

---

## Example: add to cart (fetch)

```javascript
fetch('http://localhost:5000/api/cart/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'uuid',
    userId: '68cfb58b...',
    productId: '68e22c2e...',
    quantity: 1,
    selectedOptions: { engraving: { text: 'Forever Yours', font: 'Script' } }
  })
})
.then(r => r.json()).then(console.log)
```

## Validation rules / errors
- 400 Bad Request: missing required fields (productId, sessionId/userId as required by the route), invalid quantity.
- 404 Not Found: product or order not found.
- 403 Forbidden: email mismatch in order lookup.
- 500 Server Error: unexpected errors. Frontend should show an error banner and allow retry.

## Edge cases & recommendations
- Escape/validate engraving input to avoid injection. The backend should enforce a reasonable max length (e.g., 40 characters) and a whitelist of fonts/positions.
- When showing images, always use a fallback if `images` is empty (e.g., placeholder image).
- For optimistic UI, show cart updates immediately and verify the server result; if server modifies sessionId, update client session state.
- If you rely on Stripe for payment, complete checkout flows in a staging environment with Stripe test keys and configure webhooks to your dev endpoint.

## Backfill / migration (optional)
If older orders are missing `productDetails.images` or item-level `imageUrl`, run a backfill script that:
1. Scans orders missing image fields
2. For each product in the order, fetch product doc from `jewelry` or `products` collections
3. Populate `productDetails.images` and `imageUrl` and save

---

## Contact & versioning
- API contract maintained in this repo. If you change shapes, update this document and communicate version changes to the frontend team.

Document created: 2025-10-08

---

## Direct in-app card processing (no redirect) — Stripe Elements + Payment Intents

If you want users to enter card details on your checkout page (no Stripe Checkout redirect URL), use Stripe Elements + Payment Intents. This approach keeps the payment flow inside your site while still avoiding handling raw card numbers on your servers (use Stripe.js / Elements). Below is a recommended flow, server endpoints, example code, and important security notes.

High-level flow options:
- Preferred: Frontend uses Stripe Elements to collect card and calls your backend to create a PaymentIntent; frontend confirms the PaymentIntent using the returned clientSecret. Webhooks still finalize the order on the server after payment success.
- Alternative: Frontend creates a PaymentMethod (via Stripe.js) and sends the paymentMethod.id to your backend; backend creates+confirms the PaymentIntent server-side. This moves the final confirmation to the backend (useful for server-side business logic or strong control over confirmation).

Security note (must read):
- Never send raw card numbers to your backend. Use Stripe Elements (or Stripe Tokenization) so card numbers never hit your server directly — this keeps PCI scope minimal.
- If you must collect raw card data in your own inputs (not recommended), you must meet full PCI requirements. Do not do this.

Server endpoints (suggested additions)

1) Create PaymentIntent
- Method: POST
- Path: /api/cart/create-payment-intent
- Request body (example):

```json
{
  "orderId": "ORD1234",
  "amount": 1999.99,
  "currency": "usd"
}
```

- Response (200):

```json
{
  "clientSecret": "pi_XXX_secret_YYY",
  "paymentIntentId": "pi_XXX"
}
```

Example Node/Express implementation (CommonJS):

```javascript
// server: src/routes/checkout-direct.js (new or add into cart router)
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-payment-intent', async (req, res) => {
  try {
    const { orderId, amount, currency = 'usd' } = req.body;
    // amount expected in decimal dollars; convert to cents for Stripe
    const amountInCents = Math.round(Number(amount) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      payment_method_types: ['card'],
      metadata: { orderId },
      // optional: automatic_payment_methods: { enabled: true }
    });

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (err) {
    console.error('Create PaymentIntent error', err);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

module.exports = router;
```

2) (Optional) Confirm payment server-side
- If you prefer to confirm the PaymentIntent on the server (e.g., after receiving a payment_method id from the client), expose an endpoint such as `/api/cart/confirm-payment` which accepts `{ paymentIntentId, paymentMethodId }` and calls `stripe.paymentIntents.confirm(paymentIntentId, { payment_method: paymentMethodId })`.

Frontend (Stripe.js + Elements) example

1) Include Stripe.js in the page:

```html
<script src="https://js.stripe.com/v3/"></script>
```

2) Minimal client flow (create PaymentIntent on backend, then confirm on client):

```javascript
// initialize
const stripe = Stripe('pk_live_or_pk_test_your_key');
const elements = stripe.elements();
const card = elements.create('card');
card.mount('#card-element');

async function placeOrder(orderId, billingDetails) {
  // 1) ask backend for clientSecret
  const resp = await fetch('/api/cart/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, amount: billingDetails.amount, currency: 'usd' })
  });
  const { clientSecret } = await resp.json();

  // 2) confirm card payment (this will handle SCA/3DS if required)
  const result = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card,
      billing_details: {
        name: billingDetails.name,
        email: billingDetails.email,
        address: billingDetails.address
      }
    }
  });

  if (result.error) {
    // show error to user
    console.error('Payment failed', result.error.message);
    return { success: false, error: result.error.message };
  }

  if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
    // Payment succeeded — inform backend to finalize order (optional: webhook will also handle)
    await fetch('/api/cart/payment-success', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, paymentIntentId: result.paymentIntent.id }) });
    return { success: true, paymentIntentId: result.paymentIntent.id };
  }

  // other statuses are possible (requires_action handled by confirmCardPayment automatically)
  return { success: false, error: 'Unexpected payment status' };
}
```

Server webhook (existing code in `src/routes/payment.js` should already handle Stripe webhooks).
- Keep the webhook active to handle the final authoritative payment state and to trigger order fulfillment, email, and cart cleanup.

3DS / SCA handling
- Using `stripe.confirmCardPayment(clientSecret, ...)` triggers SCA flows automatically when required. The promise will either resolve with a `paymentIntent` whose status becomes `requires_action` or will complete authentication via a popup/modal handled by Stripe.

Fallback: frontend sends paymentMethodId to backend
- If you need the backend to confirm the payment (for additional checks), the client can call `stripe.createPaymentMethod({ type: 'card', card })` to get a `paymentMethod.id`, then send that ID to your backend and the backend calls `stripe.paymentIntents.create({ amount, currency, payment_method: id, confirm: true })`.

Important backend checks
- Validate `orderId` belongs to the logged-in user or session.
- Ensure the `amount` on the PaymentIntent matches your server-side computed order total (don't trust client-sent amount). Prefer computing the amount from the order on server rather than accepting the client-provided amount.

Testing
- Use Stripe test publishable and secret keys. Use test card numbers from Stripe (e.g., 4242 4242 4242 4242 for a successful payment, or cards that simulate 3DS, declines, etc.).
- Confirm webhooks in dev using Stripe CLI `stripe listen` or configure a publicly reachable webhook endpoint.

UX notes for the frontend
- Disable the Place Order button after first submit and show a spinner while confirming the payment.
- Show clear error messages from `result.error.message` to the user.
- On success, navigate to an order confirmation page and show order details obtained from the server (orderId, status).

Summary: pros and cons
- Pros:
  - Full in-site checkout UX (no redirect) and tighter control over UI.
  - Stripe Elements offloads card handling and SCA flows to Stripe while keeping PCI scope minimal.
- Cons:
  - Slightly more implementation work than Stripe Checkout.
  - You must manage client and server flow and be careful with security and webhook handling.

---

If you want, I can:
- Add example route files (`src/routes/checkout-direct.js`) and wire them into `src/app.js` so the backend has the endpoints ready, or
- Add a small frontend snippet (HTML + JS) that you can drop into your checkout page to wire Stripe Elements to the new endpoints.
Which would you prefer?

---

Implementation note — endpoints added in this repo

- POST /api/checkout-direct/create-payment-intent
  - Body: { orderId }
  - Response: { clientSecret, paymentIntentId }

- POST /api/checkout-direct/process-payment
  - Body: { orderId, paymentMethodId, billingDetails }
  - Response: { success, paymentIntentId } or { requiresAction, clientSecret }

Frontend snippet (Stripe Elements -> process-payment using PaymentMethod id)

```javascript
// 1) create PaymentMethod from Elements (client)
const { paymentMethod, error } = await stripe.createPaymentMethod({
  type: 'card',
  card: cardElement,
  billing_details: { name: customerName, email: customerEmail }
});

if (error) {
  // show error
}

// 2) send paymentMethod.id to backend to process and confirm
const resp = await fetch('/api/checkout-direct/process-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orderId, paymentMethodId: paymentMethod.id })
});
const result = await resp.json();

if (result.success) {
  // payment succeeded
} else if (result.requiresAction && result.clientSecret) {
  // 3DS required — let stripe handle it in the client
  const confirmResult = await stripe.confirmCardPayment(result.clientSecret);
  if (confirmResult.error) {
    // show error
  } else if (confirmResult.paymentIntent && confirmResult.paymentIntent.status === 'succeeded') {
    // payment succeeded
  }
} else {
  // handle fail
}
```

Important: frontend must not post raw card number values to `/api/checkout-direct/process-payment`. Use Stripe Elements to produce `paymentMethod.id` or use `create-payment-intent` + `stripe.confirmCardPayment(clientSecret)` method instead.

