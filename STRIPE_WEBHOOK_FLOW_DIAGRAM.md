# Stripe Webhook Flow Diagram

## 🔄 Complete Payment & Webhook Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          STRIPE PAYMENT FLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

1. CUSTOMER INITIATES CHECKOUT
   ┌──────────┐
   │ Customer │ Clicks "Pay Now"
   └────┬─────┘
        │
        │ POST /api/checkout-direct/create-checkout-session
        ↓
   ┌────────────┐
   │  Backend   │ Creates Stripe Checkout Session
   └────┬───────┘
        │
        │ Returns checkout URL
        ↓
   ┌──────────┐
   │ Customer │ Redirected to Stripe Checkout Page
   └────┬─────┘
        │
        ↓

2. PAYMENT PROCESSING
   ┌─────────────────┐
   │ Stripe Checkout │ Customer enters card: 4242 4242 4242 4242
   └────┬────────────┘
        │
        │ Processes payment
        ↓
   ┌─────────────────┐
   │ Stripe Backend  │ Payment successful!
   └────┬────────────┘
        │
        ├─────────────────────────────────────────────────┐
        │                                                 │
        │ Redirect customer                               │ Send webhook
        ↓                                                 ↓

3. TWO PARALLEL ACTIONS

   A) CUSTOMER REDIRECT                    B) WEBHOOK TO YOUR SERVER
   ┌──────────┐                            ┌─────────────────┐
   │ Customer │                            │ Stripe Backend  │
   └────┬─────┘                            └────┬────────────┘
        │                                       │
        │ Redirected to success page            │ POST webhook event
        ↓                                       ↓
   ┌─────────────────────────────┐        ┌─────────────────────────────┐
   │ https://test.celorajewelry  │        │ POST /api/payments/webhook  │
   │ .com/payment/success        │        │                             │
   │ ?session_id=cs_test_xxx     │        │ Headers:                    │
   └─────────────────────────────┘        │ - stripe-signature: xxx     │
                                          │                             │
                                          │ Body: {                     │
                                          │   type: "checkout.session   │
                                          │         .completed",        │
                                          │   data: { ... }             │
                                          │ }                           │
                                          └────┬────────────────────────┘
                                               │
                                               │ Verify signature
                                               ↓
                                          ┌─────────────────┐
                                          │ Your Backend    │
                                          │ payment.js      │
                                          └────┬────────────┘
                                               │
                                               │ 1. Verify signature ✅
                                               │ 2. Extract session data
                                               │ 3. Find/create order
                                               │ 4. Update payment status
                                               │ 5. Send confirmation email
                                               ↓
                                          ┌─────────────────┐
                                          │   MongoDB       │
                                          │ Order created/  │
                                          │ updated         │
                                          └────┬────────────┘
                                               │
                                               │ Return 200 OK
                                               ↓
                                          ┌─────────────────┐
                                          │ Stripe Backend  │
                                          │ ✅ Webhook       │
                                          │    delivered    │
                                          └─────────────────┘

4. FINAL STATE
   ┌──────────┐
   │ Customer │ Sees success message
   └────┬─────┘
        │
        │ Can track order at:
        │ POST /api/public/track-order
        │ { orderId, email }
        ↓
   ┌─────────────────┐
   │ Order Details   │
   │ Status: Confirmed
   │ Payment: Paid   │
   │ Email sent ✅   │
   └─────────────────┘
```

---

## 🔐 Webhook Security Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     WEBHOOK SIGNATURE VERIFICATION                       │
└─────────────────────────────────────────────────────────────────────────┘

1. Stripe sends webhook:
   ┌─────────────────┐
   │ Stripe Backend  │
   └────┬────────────┘
        │
        │ Creates signature using:
        │ - Webhook payload
        │ - Timestamp
        │ - Signing secret (whsec_xxx)
        │
        │ POST /api/payments/webhook
        │ Headers:
        │   stripe-signature: t=timestamp,v1=signature
        ↓
   ┌─────────────────────────────────────────────────┐
   │ Your Backend - app.js                           │
   │                                                 │
   │ app.use('/api/payments/webhook',                │
   │   express.raw({ type: 'application/json' }))    │
   │                                                 │
   │ ⚠️  IMPORTANT: Raw body required for signature  │
   └────┬────────────────────────────────────────────┘
        │
        │ Raw body preserved
        ↓
   ┌─────────────────────────────────────────────────┐
   │ Your Backend - payment.js                       │
   │                                                 │
   │ const sig = req.headers['stripe-signature'];   │
   │ const secret = process.env.STRIPE_WEBHOOK_SECRET│
   │                                                 │
   │ event = stripe.webhooks.constructEvent(         │
   │   rawBody, sig, secret                          │
   │ )                                               │
   └────┬────────────────────────────────────────────┘
        │
        ├─── Signature valid? ───┐
        │                        │
    YES │                        │ NO
        ↓                        ↓
   ┌─────────────┐          ┌──────────────────┐
   │ Process     │          │ Return 400 Error │
   │ Event ✅    │          │ "Webhook Error:  │
   │             │          │  Invalid sig"    │
   └─────────────┘          └──────────────────┘
        │
        │ Handle event based on type
        ↓
   ┌─────────────────────────────────────┐
   │ switch (event.type) {               │
   │   case "checkout.session.completed":│
   │     → Create order                  │
   │   case "payment_intent.succeeded":  │
   │     → Update payment status         │
   │   case "payment_intent.failed":     │
   │     → Log failure                   │
   │ }                                   │
   └────┬────────────────────────────────┘
        │
        │ Return success
        ↓
   ┌─────────────────┐
   │ res.json({      │
   │   received: true│
   │ })              │
   │                 │
   │ HTTP 200 ✅     │
   └────┬────────────┘
        │
        ↓
   ┌─────────────────┐
   │ Stripe marks    │
   │ webhook as      │
   │ delivered ✅    │
   └─────────────────┘
```

---

## 🌐 Production Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION SETUP                                   │
└─────────────────────────────────────────────────────────────────────────┘

                           INTERNET
                              │
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        │                     │                     │
   Customer Side         Stripe Backend       Your Backend
        │                     │                     │
        ↓                     ↓                     ↓
┌───────────────┐    ┌─────────────────┐    ┌────────────────┐
│ Browser       │    │ Stripe Servers  │    │ Your Server    │
│               │    │                 │    │                │
│ test.celora   │    │ stripe.com      │    │ api.celora     │
│ jewelry.com   │    │                 │    │ jewelry.com    │
└───┬───────────┘    └────┬────────────┘    └───┬────────────┘
    │                     │                     │
    │ 1. Create checkout  │                     │
    │────────────────────────────────────────→  │
    │                     │                     │
    │ 2. Checkout URL     │                     │
    │  ←────────────────────────────────────────│
    │                     │                     │
    │ 3. Redirect to      │                     │
    │    Stripe           │                     │
    │────────────────→    │                     │
    │                     │                     │
    │ 4. Enter payment    │                     │
    │────────────────→    │                     │
    │                     │                     │
    │                     │ 5. Process payment  │
    │                     │                     │
    │                     │ 6. Send webhook     │
    │                     │────────────────────→│
    │                     │                     │
    │                     │                     │ 7. Verify & save
    │                     │                     │    to database
    │                     │                     │
    │                     │ 8. Webhook OK (200) │
    │                     │  ←──────────────────│
    │                     │                     │
    │ 9. Redirect success │                     │
    │  ←──────────────────│                     │
    │                     │                     │
    │ 10. Show success    │                     │
    │     page            │                     │
    └─────────────────────┴─────────────────────┘
```

---

## 🔧 Configuration Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    REQUIRED CONFIGURATION                                │
└─────────────────────────────────────────────────────────────────────────┘

1. STRIPE DASHBOARD
   ┌────────────────────────────────────────────┐
   │ https://dashboard.stripe.com/webhooks      │
   │                                            │
   │ Endpoint URL:                              │
   │ https://api.celorajewelry.com              │
   │       /api/payments/webhook                │
   │                                            │
   │ Events to send:                            │
   │ ✅ checkout.session.completed              │
   │ ✅ payment_intent.succeeded                │
   │ ✅ payment_intent.payment_failed           │
   │ ✅ charge.dispute.created                  │
   │ ✅ invoice.payment_failed                  │
   │                                            │
   │ Signing secret: whsec_xxxxxxxxxxxxx        │
   └────────────────────────────────────────────┘

2. YOUR .ENV FILE
   ┌────────────────────────────────────────────┐
   │ STRIPE_SECRET_KEY=sk_live_51xxxxxx         │
   │ STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx       │
   │ CLIENT_URL=https://test.celorajewelry.com/ │
   │ DATABASE_URI=mongodb://...                 │
   └────────────────────────────────────────────┘

3. YOUR BACKEND CODE (Already configured ✅)
   ┌────────────────────────────────────────────┐
   │ app.js:                                    │
   │ app.use('/api/payments/webhook',           │
   │   express.raw({ type: 'application/json' })│
   │                                            │
   │ payment.js:                                │
   │ router.post('/webhook', ...)               │
   │ - Verifies signature                       │
   │ - Processes events                         │
   │ - Updates database                         │
   └────────────────────────────────────────────┘
```

---

## 📊 Event Processing Timeline

```
Time    Event                           Status
─────────────────────────────────────────────────────────────
0:00    Customer clicks "Pay Now"       🔵 Initiated
0:01    Stripe checkout page loads      🔵 Loading
0:15    Customer enters card info       🔵 Processing
0:16    Stripe processes payment        🟡 Processing
0:17    Payment successful              🟢 Success
0:17    → Webhook sent to your server   🚀 Sending
0:18    → Your server receives webhook  📥 Received
0:18    → Signature verified            ✅ Verified
0:19    → Order created in database     💾 Saved
0:19    → Confirmation email sent       📧 Sent
0:19    → Return 200 to Stripe          ✅ Acknowledged
0:20    → Customer redirected           🔄 Redirected
0:21    Customer sees success page      ✅ Complete
```

---

## 🎯 Testing Checklist

```
LOCAL TESTING (Development)
├─ [ ] Install Stripe CLI
├─ [ ] Login to Stripe: stripe login
├─ [ ] Start backend: npm start
├─ [ ] Forward webhooks: stripe listen --forward-to localhost:3003/api/payments/webhook
├─ [ ] Copy webhook secret to .env
├─ [ ] Trigger test: stripe trigger checkout.session.completed
├─ [ ] Check logs: Event received ✅
└─ [ ] Check database: Order created ✅

PRODUCTION TESTING (Live)
├─ [ ] Add webhook URL in Stripe Dashboard (live mode)
├─ [ ] Copy live webhook secret to .env
├─ [ ] Update STRIPE_SECRET_KEY to sk_live_xxx
├─ [ ] Deploy to production
├─ [ ] Test with real payment (small amount)
├─ [ ] Verify webhook delivery in Stripe Dashboard
├─ [ ] Check order created in database
└─ [ ] Monitor for 24 hours
```

---

**Status**: Your webhook implementation is complete and ready! ✅
