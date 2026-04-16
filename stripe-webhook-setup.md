# Stripe Webhook Setup Guide

## Your Current Webhook Endpoint
**Local Path:** `/api/payments/webhook`
**Full Local URL:** `http://localhost:3000/api/payments/webhook`

## Option 1: Stripe CLI (Recommended for Development)

### Step 1: Login to Stripe CLI
```bash
stripe login
```
This will open your browser to authenticate with Stripe.

### Step 2: Start Local Development Server
```bash
cd /Users/vats/Desktop/celora-backend
npm run dev
# Server should start on http://localhost:3000
```

### Step 3: Forward Webhooks to Local Server
```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

This command will:
- ✅ Create a temporary webhook endpoint that's publicly accessible
- ✅ Forward all webhook events to your local server
- ✅ Provide you with a webhook signing secret
- ✅ Show you real-time webhook events in the terminal

### Step 4: Update Your Environment Variables
When you run `stripe listen`, it will output a webhook signing secret like:
```
whsec_1234567890abcdef...
```

Add this to your `.env` file:
```env
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
```

### Step 5: Test the Webhook
You can trigger test events:
```bash
# Trigger a test checkout session completed event
stripe trigger checkout.session.completed

# Trigger a test payment succeeded event  
stripe trigger payment_intent.succeeded

# Trigger a test payment failed event
stripe trigger payment_intent.payment_failed
```

## Option 2: ngrok (Alternative)

If you prefer ngrok for public URL exposure:

### Install ngrok
```bash
brew install ngrok
```

### Start your development server
```bash
npm run dev
```

### Expose local server
```bash
ngrok http 3000
```

This gives you a public URL like: `https://abc123.ngrok.io`

### Configure in Stripe Dashboard
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://abc123.ngrok.io/api/payments/webhook`
3. Select these events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.dispute.created`
   - `invoice.payment_failed`

## Option 3: Production Deployment

For production, your webhook URL will be:
```
https://yourdomain.com/api/payments/webhook
```

### Common Production Domains:
- **Vercel:** `https://your-app.vercel.app/api/payments/webhook`
- **Heroku:** `https://your-app.herokuapp.com/api/payments/webhook`
- **Custom Domain:** `https://api.celora.com/api/payments/webhook`

## Webhook Events Your Code Handles

Your webhook endpoint currently handles these events:

1. ✅ **checkout.session.completed**
   - Updates order status to "Confirmed"
   - Sends confirmation email
   - Generates and sends PDF invoice
   - Clears the cart

2. ✅ **payment_intent.succeeded**
   - Updates order status for direct payments

3. ✅ **payment_intent.payment_failed**
   - Marks order as failed
   - Sends failure notification email

4. ✅ **charge.dispute.created**
   - Marks order as disputed
   - Tracks dispute information

5. ✅ **invoice.payment_failed**
   - Handles subscription/invoice failures

## Testing Your Webhook

### Test Email and PDF Generation
Use the test endpoint:
```bash
curl -X POST http://localhost:3000/api/payments/test-email-pdf \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your-test-email@example.com"}'
```

### Monitor Webhook Events
When using Stripe CLI, you'll see real-time events:
```
2025-07-29 10:30:45   --> checkout.session.completed [evt_1234...]
2025-07-29 10:30:45  <--  [200] POST http://localhost:3000/api/payments/webhook [evt_1234...]
```

## Environment Variables Checklist

Make sure your `.env` file contains:
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # or sk_live_... for production
STRIPE_WEBHOOK_SECRET=whsec_... # Get this from stripe listen output

# Azure Email Service
AZURE_COMMUNICATION_CONNECTION_STRING=your_azure_connection_string

# Other required variables
CLIENT_URL=http://localhost:3000
```

## Troubleshooting

### Common Issues:

1. **"Webhook signature verification failed"**
   - Make sure `STRIPE_WEBHOOK_SECRET` matches the output from `stripe listen`
   - Ensure you're using the raw body parser: `express.raw({ type: "application/json" })`

2. **"Cannot read properties of undefined (reading 'match')"**
   - Check your `AZURE_COMMUNICATION_CONNECTION_STRING` is set correctly

3. **Webhook endpoint not receiving events**
   - Verify your server is running on the correct port
   - Check the `stripe listen` forward URL matches your server

4. **PDF generation fails**
   - Ensure the `invoices` directory exists or can be created
   - Check file permissions

### Success Indicators:
- ✅ Stripe CLI shows `[200]` responses
- ✅ Your server logs show "Received webhook event: checkout.session.completed"
- ✅ Emails are sent successfully
- ✅ PDF invoices are generated and attached
- ✅ Order status updates in database

## Quick Start Script

Run this to start everything:
```bash
#!/bin/bash
echo "🚀 Starting Celora Webhook Development Environment"

# Start the development server in background
cd /Users/vats/Desktop/celora-backend
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 3

# Start Stripe webhook forwarding
echo "🔄 Starting Stripe webhook forwarding..."
echo "📝 Copy the webhook secret (whsec_...) to your .env file"
stripe listen --forward-to localhost:3000/api/payments/webhook

# Cleanup on exit
trap "kill $SERVER_PID" EXIT
```

Save this as `start-webhook-dev.sh` and run with `bash start-webhook-dev.sh`
