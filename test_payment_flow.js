
// Native fetch in Node 20+
const fs = require('fs');

const BASE_URL = 'http://localhost:3000/api';
const REPORT_FILE = 'payment_test_report.md';

let reportContent = `# Payment Flow Test Report\n\nDate: ${new Date().toISOString()}\n\n`;

function log(msg) {
    console.log(msg);
    reportContent += `${msg}\n`;
}

function logSection(title) {
    log(`\n## ${title}`);
}

async function runStep(stepName, fn) {
    logSection(stepName);
    try {
        const res = await fn();
        log(`✅ Success`);
        return res;
    } catch (err) {
        log(`❌ Failed: ${err.message}`);
        // We continue despite failure to try other steps if possible, 
        // but usually failure in step 1 blocks others.
        throw err;
    }
}

async function main() {
    try {
        // Read Config
        if (!fs.existsSync('test_config.json')) {
            throw new Error("Configuration file 'test_config.json' not found. Run setup_test_data.js first.");
        }
        const config = JSON.parse(fs.readFileSync('test_config.json', 'utf8'));
        const { productId, userId } = config;
        const sessionId = `sess-${Date.now()}`; // Unique session

        log(`**Configuration:**`);
        log(`- Product ID: ${productId}`);
        log(`- User ID: ${userId}`);
        log(`- Session ID: ${sessionId}`);

        // 1. Add to Cart
        await runStep('Step 1: Add Item to Cart (Vertex)', async () => {
            const res = await fetch(`${BASE_URL}/cart/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    userId,
                    productId, // Uses the ObjectId now!
                    quantity: 1,
                    price: 856 // Force price to match scenario
                })
            });

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
            }

            if (!res.ok || !data.success) {
                throw new Error(data.error || data.message || `HTTP ${res.status}`);
            }

            log(`- Added Item: Vertex`);
            log(`- Cart Total Items: ${data.totalItems}`);
            log(`- Cart ID: ${data.cart.cartId}`);
            return data;
        });

        // 2. Create Payment Intent (USD)
        await runStep('Step 2: Create Payment Intent (USD)', async () => {
            const res = await fetch(`${BASE_URL}/checkout-direct/create-payment-intent-from-cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    userId,
                    currency: 'USD'
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'USD Checkout failed');

            log(`- Order ID: ${data.orderId}`);
            log(`- Stripe PI: ${data.paymentIntentId}`);
            log(`- Order Total (USD): $${data.orderSummary.total}`);
            return data;
        });

        // 3. Create Payment Intent (INR)
        await runStep('Step 3: Create Payment Intent (INR)', async () => {
            const res = await fetch(`${BASE_URL}/checkout-direct/create-payment-intent-from-cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    userId,
                    currency: 'INR'
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'INR Checkout failed');

            log(`- Order ID: ${data.orderId}`);
            log(`- Stripe PI: ${data.paymentIntentId}`);
            log(`- Reuse/Resume: ${data.isResume ? 'Yes' : 'No'}`);
            log(`\n**Currency Verification:**`);
            log(`- Requested: INR`);
            if (data.orderSummary.formattedSubtotal) {
                log(`- Converted Total: ${data.orderSummary.formattedSubtotal}`);
            }
            return data;
        });

        // 4. Create Payment Intent (EUR)
        await runStep('Step 4: Create Payment Intent (EUR)', async () => {
            const res = await fetch(`${BASE_URL}/checkout-direct/create-payment-intent-from-cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    userId,
                    currency: 'EUR'
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'EUR Checkout failed');

            log(`- Order ID: ${data.orderId}`);
            log(`- Stripe PI: ${data.paymentIntentId}`);
            log(`- Reuse/Resume: ${data.isResume ? 'Yes' : 'No'}`);
            log(`\n**Currency Verification:**`);
            log(`- Requested: EUR`);
            if (data.orderSummary.formattedSubtotal) {
                log(`- Converted Total: ${data.orderSummary.formattedSubtotal}`);
            }
            return data;
        });

    } catch (globalErr) {
        console.error("\nTest Suite Failed:", globalErr.message);
        reportContent += `\n❌ TEST SUITE FAILED: ${globalErr.message}\n`;
    } finally {
        fs.writeFileSync(REPORT_FILE, reportContent);
        console.log(`\n📄 Report generated: ${REPORT_FILE}`);
    }
}

main();
