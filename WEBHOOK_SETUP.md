# Add this to your .env file for webhook functionality
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# To get your webhook secret:
# 1. Go to Stripe Dashboard > Developers > Webhooks
# 2. Create a new webhook endpoint pointing to: https://yourdomain.com/api/payments/webhook
# 3. Select the following events:
#    - checkout.session.completed
#    - payment_intent.succeeded
#    - payment_intent.payment_failed
#    - charge.dispute.created
#    - invoice.payment_failed
# 4. Copy the webhook signing secret and add it to your .env file
