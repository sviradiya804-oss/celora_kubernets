# Stripe Webhook - Quick Reference Card

## 🎯 Webhook URL

### Local Development
```
http://localhost:3003/api/payments/webhook
```

### Production
```
https://api.celorajewelry.com/api/payments/webhook
```

---

## ⚡ Quick Setup (3 Steps)

### 1️⃣ Add Webhook in Stripe Dashboard
```
1. Login: https://dashboard.stripe.com/
2. Go to: Developers → Webhooks
3. Click: "Add endpoint"
4. URL: https://api.celorajewelry.com/api/payments/webhook
5. Select Events:
   ✅ checkout.session.completed
   ✅ payment_intent.succeeded
   ✅ payment_intent.payment_failed
   ✅ charge.dispute.created
   ✅ invoice.payment_failed
6. Save → Copy webhook signing secret (whsec_xxx)
```

### 2️⃣ Update .env File
```bash
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx  # From step 1
```

### 3️⃣ Restart Server
```bash
npm start
```

**Done!** ✅

---

## 🧪 Test Locally

### Install Stripe CLI
```bash
brew install stripe/stripe-cli/stripe
```

### Login
```bash
stripe login
```

### Forward Webhooks
```bash
# Terminal 1: Start backend
npm start

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:3003/api/payments/webhook
```

### Trigger Test Event
```bash
stripe trigger checkout.session.completed
```

---

## 🔍 Verify It's Working

### Check Logs
```bash
npm start

# Should see:
✅ Signature verification successful
Received webhook event: checkout.session.completed
Processing checkout session completed: cs_test_xxx
```

### Check Stripe Dashboard
```
Developers → Webhooks → Your Endpoint → Recent Deliveries
Status should be: 200 ✅
```

---

## 📋 Events Handled

| Event | Trigger | Action |
|-------|---------|--------|
| `checkout.session.completed` | Customer completes payment | Create/confirm order |
| `payment_intent.succeeded` | Payment successful | Update order status |
| `payment_intent.payment_failed` | Payment failed | Log & notify |
| `charge.dispute.created` | Chargeback filed | Alert admin |
| `invoice.payment_failed` | Subscription failed | Log failure |

---

## 🐛 Troubleshooting

### 400 Error - Signature Failed
```bash
# Check webhook secret
grep STRIPE_WEBHOOK_SECRET .env

# Restart server
npm start
```

### 404 Error - Not Found
```bash
# Verify URL in Stripe Dashboard:
https://api.celorajewelry.com/api/payments/webhook
```

### Events Not Received
```bash
# For local testing, use Stripe CLI:
stripe listen --forward-to localhost:3003/api/payments/webhook
```

### Order Not Created
```bash
# Check server logs
npm start

# Check database
node get-complete-order.js
```

---

## 🔐 Security Checklist

- ✅ Webhook secret in .env (not hardcoded)
- ✅ Signature verification enabled
- ✅ Raw body parsing configured
- ✅ HTTPS in production
- ✅ Different secrets for test/live mode

---

## 📞 Support Commands

### Check Webhook Status
```bash
./stripe-webhook-setup.sh
```

### View Webhook Logs
```bash
stripe logs tail
```

### Resend Failed Webhook
```bash
# In Stripe Dashboard:
Developers → Webhooks → [Endpoint] → Failed Event → Resend
```

---

## 🚀 Production Checklist

Before going live:

- [ ] Update Stripe Dashboard with production URL
- [ ] Switch to Live mode in Stripe
- [ ] Update .env with live keys:
  ```bash
  STRIPE_SECRET_KEY=sk_live_51xxxxx
  STRIPE_WEBHOOK_SECRET=whsec_xxxxx (live mode)
  ```
- [ ] Test webhook with live event
- [ ] Monitor Stripe Dashboard for deliveries
- [ ] Set up error alerts

---

## 💡 Pro Tips

1. **Always test locally first** using Stripe CLI
2. **Monitor webhook health** in Stripe Dashboard
3. **Stripe retries failed webhooks** automatically
4. **Keep webhook responses fast** (< 5 seconds)
5. **Log all events** for debugging

---

## 📚 Resources

- **Guide**: `STRIPE_WEBHOOK_SETUP_GUIDE.md`
- **Stripe Docs**: https://stripe.com/docs/webhooks
- **Stripe CLI**: https://stripe.com/docs/stripe-cli
- **Dashboard**: https://dashboard.stripe.com/webhooks

---

## ⚡ One-Liner Setup

```bash
# Local testing
stripe listen --forward-to localhost:3003/api/payments/webhook

# Trigger test
stripe trigger checkout.session.completed
```

---

**Status**: ✅ Your webhook is production-ready!
