# Stripe Webhook Configuration Guide

## 🎯 Webhook URL

Your Stripe webhook endpoint is already implemented and ready to use:

### Production URL
```
https://your-production-domain.com/api/payments/webhook
```

### Local Development URL (for testing)
```
http://localhost:3003/api/payments/webhook
```

---

## 🔧 Setup Instructions

### Step 1: Configure Stripe Dashboard

1. **Login to Stripe Dashboard**
   - Go to: https://dashboard.stripe.com/
   - Navigate to: **Developers → Webhooks**

2. **Add Endpoint**
   - Click **"Add endpoint"** button
   - Enter your webhook URL:
     - **Production**: `https://api.celorajewelry.com/api/payments/webhook`
     - **Test Mode**: Use Stripe CLI (see below)

3. **Select Events to Listen**
   
   Choose these events (already handled in your code):
   
   ✅ **checkout.session.completed**
   - Triggers when customer completes checkout
   - Creates/confirms order in database
   - Most important event
   
   ✅ **payment_intent.succeeded**
   - Payment successfully processed
   - Updates order payment status
   
   ✅ **payment_intent.payment_failed**
   - Payment failed
   - Logs failure, sends notification
   
   ✅ **charge.dispute.created**
   - Customer disputes a charge
   - Alert for manual review
   
   ✅ **invoice.payment_failed**
   - Recurring payment failed
   - For subscription payments

4. **Save and Get Webhook Secret**
   - After saving, Stripe will show you the **Signing Secret**
   - Format: `whsec_xxxxxxxxxxxxx`
   - **IMPORTANT**: Copy this immediately!

---

### Step 2: Configure Environment Variables

Add to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxx  # Your Stripe Secret Key
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx   # From Step 1 above

# Production
# STRIPE_SECRET_KEY=sk_live_51xxxxxxxxxxxxx
# STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Frontend URLs
CLIENT_URL=https://test.celorajewelry.com/
FRONTEND_URL=https://test.celorajewelry.com
```

**Security Notes**:
- ⚠️ Never commit `.env` to git
- ✅ Different secrets for test/live mode
- ✅ Keep webhook secret secure

---

### Step 3: Test Webhook (Local Development)

For local testing, use **Stripe CLI**:

#### Install Stripe CLI

**macOS**:
```bash
brew install stripe/stripe-cli/stripe
```

**Other OS**: https://stripe.com/docs/stripe-cli

#### Login to Stripe
```bash
stripe login
```

#### Forward Webhooks to Local Server
```bash
# Start your backend server first
npm start

# In another terminal, forward webhooks
stripe listen --forward-to localhost:3003/api/payments/webhook
```

**Output will show**:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
```

Copy this secret to your `.env` as `STRIPE_WEBHOOK_SECRET`

#### Trigger Test Events
```bash
# Test checkout session completed
stripe trigger checkout.session.completed

# Test payment succeeded
stripe trigger payment_intent.succeeded

# Test payment failed
stripe trigger payment_intent.payment_failed
```

---

## 🔍 Verify Webhook is Working

### Check Logs

Your webhook logs events:

```bash
# Start server and watch logs
npm start

# You should see:
Received webhook event: checkout.session.completed
✅ Signature verification successful
Processing checkout session completed: cs_test_xxx
```

### Check Stripe Dashboard

1. Go to: **Developers → Webhooks → [Your Endpoint]**
2. Click on endpoint
3. View **Recent deliveries** tab
4. Should show successful deliveries with 200 status

---

## 📋 Webhook Events Handled

Your backend currently handles these events:

| Event | Purpose | Action Taken |
|-------|---------|--------------|
| `checkout.session.completed` | Customer completes checkout | Creates order, confirms payment |
| `payment_intent.succeeded` | Payment successful | Updates order status, sends confirmation |
| `payment_intent.payment_failed` | Payment failed | Logs failure, notifies admin |
| `charge.dispute.created` | Customer disputes charge | Alerts for manual review |
| `invoice.payment_failed` | Invoice payment failed | Logs failure for subscriptions |

---

## 🔐 Security Implementation

Your webhook endpoint is already secure with:

### ✅ Signature Verification
```javascript
// Verifies request is from Stripe
event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
```

### ✅ Raw Body Parsing
```javascript
// Webhook route uses raw body (required for signature verification)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
```

### ✅ Error Handling
```javascript
// Returns appropriate status codes
400 - Signature verification failed
500 - Processing error
200 - Success
```

---

## 🚀 Production Deployment Checklist

### Before Going Live:

- [ ] **Update webhook URL in Stripe Dashboard**
  - Production URL: `https://api.celorajewelry.com/api/payments/webhook`
  - Switch to **Live Mode** in Stripe Dashboard

- [ ] **Update Environment Variables**
  ```bash
  STRIPE_SECRET_KEY=sk_live_51xxxxxxxxxxxxx
  STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx (live mode secret)
  ```

- [ ] **Test Webhook in Production**
  - Use Stripe Dashboard → Webhooks → Send test webhook
  - Verify logs show successful processing

- [ ] **Monitor Webhook Health**
  - Check Stripe Dashboard regularly
  - Set up alerts for failed webhooks

- [ ] **Enable Webhook Retry**
  - Stripe automatically retries failed webhooks
  - Ensure your endpoint returns 200 on success

---

## 🧪 Testing Guide

### Test Locally with Stripe CLI

1. **Start Backend**:
   ```bash
   npm start
   ```

2. **Start Webhook Forwarding**:
   ```bash
   stripe listen --forward-to localhost:3003/api/payments/webhook
   ```

3. **Trigger Events**:
   ```bash
   # Test successful checkout
   stripe trigger checkout.session.completed
   
   # Test successful payment
   stripe trigger payment_intent.succeeded
   ```

4. **Check Your Database**:
   ```bash
   # Orders should be created/updated
   node get-complete-order.js
   ```

### Test with Real Checkout Flow

1. **Start Backend**: `npm start`
2. **Start Webhook Forwarding**: `stripe listen --forward-to localhost:3003/api/payments/webhook`
3. **Complete Checkout** using test card: `4242 4242 4242 4242`
4. **Check Logs** for webhook events
5. **Verify Order Created** in database

---

## 🐛 Troubleshooting

### Webhook Returns 400 Error

**Issue**: Signature verification failed

**Solutions**:
```bash
# Check webhook secret is correct
echo $STRIPE_WEBHOOK_SECRET

# Ensure raw body parsing is enabled (already done in your app.js)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

# Restart server after changing .env
npm start
```

### Webhook Not Receiving Events

**Issue**: Events not reaching your endpoint

**Solutions**:
1. **Check URL is correct** in Stripe Dashboard
2. **Ensure server is running** and accessible
3. **Check firewall/security groups** allow Stripe IPs
4. **For local testing**: Use Stripe CLI forwarding

### Order Not Created After Payment

**Issue**: Webhook received but order not in database

**Solutions**:
1. **Check logs** for errors:
   ```bash
   npm start
   # Look for "Error handling webhook event"
   ```

2. **Verify database connection**:
   ```bash
   echo $DATABASE_URI
   ```

3. **Check session metadata** includes order info

### Events Showing as Failed in Stripe Dashboard

**Issue**: Stripe shows webhook delivery failed

**Solutions**:
1. **Ensure endpoint returns 200**: Check error handling
2. **Check server logs** for exceptions
3. **Verify timeout**: Webhook should respond < 5 seconds
4. **Check response format**: Must return JSON `{ received: true }`

---

## 📊 Monitoring Webhooks

### Stripe Dashboard Monitoring

1. **View Webhook Health**:
   - Developers → Webhooks → [Your Endpoint]
   - Check success rate
   - View recent deliveries

2. **Failed Deliveries**:
   - Click on failed events
   - View error message
   - Use "Resend" to retry

### Application Logging

Your webhook logs to console:
```javascript
console.log(`Received webhook event: ${event.type}`);
console.log("Processing checkout session completed:", session.id);
```

**Recommended**: Implement logging service (e.g., Winston, Sentry)

---

## 🔄 Webhook Retry Logic

Stripe automatically retries failed webhooks:
- **1st retry**: After 1 hour
- **2nd retry**: After 6 hours
- **3rd retry**: After 12 hours
- **Continues**: Up to 3 days

**Your endpoint should be idempotent** (handle duplicate events gracefully)

---

## 📝 Quick Reference

### Webhook URL Format
```
https://your-domain.com/api/payments/webhook
```

### Required Headers (Stripe sends automatically)
```
stripe-signature: signature_string
content-type: application/json
```

### Environment Variables
```bash
STRIPE_SECRET_KEY=sk_test_51xxxxx or sk_live_51xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Events to Select in Stripe Dashboard
- ✅ checkout.session.completed
- ✅ payment_intent.succeeded
- ✅ payment_intent.payment_failed
- ✅ charge.dispute.created
- ✅ invoice.payment_failed

### Testing Commands
```bash
# Forward webhooks locally
stripe listen --forward-to localhost:3003/api/payments/webhook

# Trigger test event
stripe trigger checkout.session.completed
```

---

## 🎯 Production URLs

Based on your configuration:

### Backend API
```
https://api.celorajewelry.com/api/payments/webhook
```

### Frontend
```
https://test.celorajewelry.com/
```

### Full Webhook URL
```
https://api.celorajewelry.com/api/payments/webhook
```

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Webhook URL added to Stripe Dashboard
- [ ] Correct events selected (5 events minimum)
- [ ] Webhook secret copied to `.env`
- [ ] Server running and accessible
- [ ] Test event sent successfully
- [ ] Event shows as delivered (200) in Stripe Dashboard
- [ ] Order created in database after test
- [ ] Logs show successful processing

---

## 🆘 Need Help?

### Common Issues

1. **400 Bad Request**: Check webhook secret
2. **404 Not Found**: Verify URL is correct
3. **500 Server Error**: Check server logs for exceptions
4. **Timeout**: Webhook processing takes > 5 seconds

### Resources

- **Stripe Webhook Docs**: https://stripe.com/docs/webhooks
- **Stripe CLI**: https://stripe.com/docs/stripe-cli
- **Webhook Testing**: https://stripe.com/docs/webhooks/test

---

## 🎉 Ready to Go!

Your webhook endpoint is **production-ready** with:
- ✅ Secure signature verification
- ✅ Proper raw body parsing
- ✅ Comprehensive event handling
- ✅ Error handling and logging
- ✅ Idempotent design

Just configure the URL in Stripe Dashboard and you're live! 🚀
