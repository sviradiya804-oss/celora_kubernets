#!/bin/bash

# Stripe Webhook Setup Helper Script
# This script helps you test your Stripe webhook configuration

echo "🎯 Stripe Webhook Setup Helper"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Stripe CLI is installed
echo "📋 Step 1: Checking Stripe CLI installation..."
if command -v stripe &> /dev/null; then
    echo -e "${GREEN}✅ Stripe CLI is installed${NC}"
    stripe --version
else
    echo -e "${RED}❌ Stripe CLI is not installed${NC}"
    echo ""
    echo "Install Stripe CLI:"
    echo "  macOS:    brew install stripe/stripe-cli/stripe"
    echo "  Other:    https://stripe.com/docs/stripe-cli"
    echo ""
    exit 1
fi

echo ""

# Check if .env file exists
echo "📋 Step 2: Checking environment configuration..."
if [ -f .env ]; then
    echo -e "${GREEN}✅ .env file found${NC}"
    
    # Check for required variables
    if grep -q "STRIPE_SECRET_KEY" .env && grep -q "STRIPE_WEBHOOK_SECRET" .env; then
        echo -e "${GREEN}✅ Stripe environment variables configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Missing Stripe environment variables${NC}"
        echo ""
        echo "Add these to your .env file:"
        echo "  STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx"
        echo "  STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx"
        echo ""
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Copy .env.example to .env and configure it"
    exit 1
fi

echo ""

# Check if server is running
echo "📋 Step 3: Checking if backend server is running..."
if curl -s http://localhost:3003/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend server is running on port 3003${NC}"
else
    echo -e "${YELLOW}⚠️  Backend server is not running${NC}"
    echo ""
    echo "Start your backend server in another terminal:"
    echo "  npm start"
    echo "  OR"
    echo "  node src/app.js"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo ""
echo "================================"
echo -e "${GREEN}✅ All prerequisites met!${NC}"
echo "================================"
echo ""

# Offer to start webhook forwarding
echo "🚀 Ready to start Stripe webhook forwarding?"
echo ""
echo "This will:"
echo "  1. Forward Stripe webhook events to your local server"
echo "  2. Show you the webhook signing secret"
echo "  3. Display all incoming webhook events"
echo ""
echo "Options:"
echo "  1) Start webhook forwarding"
echo "  2) Test with sample event"
echo "  3) Show webhook URL"
echo "  4) Exit"
echo ""

read -p "Choose an option (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🎯 Starting Stripe webhook forwarding..."
        echo "Press Ctrl+C to stop"
        echo ""
        echo -e "${YELLOW}⚠️  Copy the webhook signing secret (whsec_xxx) to your .env file${NC}"
        echo ""
        stripe listen --forward-to localhost:3003/api/payments/webhook
        ;;
    2)
        echo ""
        echo "🧪 Available test events:"
        echo "  1) checkout.session.completed"
        echo "  2) payment_intent.succeeded"
        echo "  3) payment_intent.payment_failed"
        echo "  4) charge.dispute.created"
        echo ""
        read -p "Choose event to trigger (1-4): " event_choice
        
        case $event_choice in
            1)
                echo "Triggering checkout.session.completed..."
                stripe trigger checkout.session.completed
                ;;
            2)
                echo "Triggering payment_intent.succeeded..."
                stripe trigger payment_intent.succeeded
                ;;
            3)
                echo "Triggering payment_intent.payment_failed..."
                stripe trigger payment_intent.payment_failed
                ;;
            4)
                echo "Triggering charge.dispute.created..."
                stripe trigger charge.dispute.created
                ;;
            *)
                echo "Invalid choice"
                ;;
        esac
        ;;
    3)
        echo ""
        echo "📍 Your webhook URLs:"
        echo ""
        echo "Local Development:"
        echo "  http://localhost:3003/api/payments/webhook"
        echo ""
        echo "Production (update with your domain):"
        echo "  https://api.celorajewelry.com/api/payments/webhook"
        echo ""
        echo "Add this URL to your Stripe Dashboard:"
        echo "  https://dashboard.stripe.com/webhooks"
        echo ""
        ;;
    4)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
