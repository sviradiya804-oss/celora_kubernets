#!/bin/bash

echo "🚀 Starting Celora Webhook Development Environment"
echo "================================================"

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found. Installing..."
    brew install stripe/stripe-cli/stripe
fi

# Check if user is logged in to Stripe
if ! stripe config --list | grep -q "account_id"; then
    echo "🔐 Please login to Stripe CLI first:"
    echo "Run: stripe login"
    exit 1
fi

echo "✅ Stripe CLI is ready"

# Start the development server in background
echo "🖥️  Starting development server..."
cd /Users/vats/Desktop/celora-backend

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Are you in the right directory?"
    exit 1
fi

# Start server in background
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Check if server is running
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Server is running on http://localhost:3000"
else
    echo "❌ Server failed to start. Check the logs above."
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🔄 Starting Stripe webhook forwarding..."
echo "📝 IMPORTANT: Copy the webhook secret (whsec_...) shown below to your .env file"
echo "💡 Press Ctrl+C to stop both server and webhook forwarding"
echo ""

# Start Stripe webhook forwarding
stripe listen --forward-to localhost:3000/api/payments/webhook

# Cleanup on exit
trap "echo '🛑 Stopping services...'; kill $SERVER_PID 2>/dev/null; exit 0" INT TERM

# Wait for the webhook listener to exit
wait
