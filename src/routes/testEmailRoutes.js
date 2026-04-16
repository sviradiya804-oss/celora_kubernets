const express = require('express');
const router = express.Router();
const {
    sendUnifiedOrderEmail,
    sendOrderConfirmationEmail,
    sendManufacturingEmail,
    sendQualityEmail,
    sendDeliveryEmail,
    sendDeliveredEmail,
    sendTestEmail
} = require('../utils/unifiedEmailService');

/**
 * Test the unified email template with different statuses
 * POST /api/test-email/unified
 */
router.post('/unified', async (req, res) => {
    try {
        const {
            email,
            customerName = 'John Doe',
            orderId = 'TEST-ORDER-123',
            status = 'Confirmed',
            includeImages = false,
            includeProducts = false,
            includeTracking = false
        } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email address is required'
            });
        }

        // Sample data for testing
        const testData = {
            customerEmail: email,
            customerName,
            orderId,
            newStatus: status,
            orderDate: new Date().toLocaleDateString(),
            total: 299.99,
            oldStatus: status !== 'Confirmed' ? 'Processing' : undefined,
            statusMessage: getStatusMessage(status)
        };

        // Add sample products if requested
        if (includeProducts) {
            testData.products = [
                { name: 'Diamond Engagement Ring', quantity: 1, price: 199.99 },
                { name: 'Gold Wedding Band', quantity: 1, price: 99.99 }
            ];
            testData.subtotal = 299.98;
            testData.shipping = 0;
            testData.tax = 0;
        }

        // Add sample images if requested
        if (includeImages) {
            testData.images = [
                {
                    filename: 'order-image-1.jpg',
                    description: getImageDescription(status, 1),
                    path: null // Would be actual file path in production
                },
                {
                    filename: 'order-image-2.jpg',
                    description: getImageDescription(status, 2),
                    path: null
                }
            ];
        }

        // Add tracking info if requested
        if (includeTracking && (status.toLowerCase().includes('delivery') || status.toLowerCase().includes('shipping'))) {
            testData.trackingInfo = {
                number: 'TRK123456789',
                carrier: 'FedEx',
                expectedDelivery: '2-3 business days',
                url: 'https://fedex.com/track?number=TRK123456789'
            };
        }

        const result = await sendUnifiedOrderEmail(testData);

        if (result.success) {
            res.json({
                success: true,
                message: `Test email sent successfully to ${email}`,
                data: {
                    status,
                    orderId,
                    customerName,
                    messageId: result.messageId
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send test email',
                error: result.error
            });
        }

    } catch (error) {
        console.error('Error in unified email test:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * Test all email types in sequence
 * POST /api/test-email/all-statuses
 */
router.post('/all-statuses', async (req, res) => {
    try {
        const {
            email,
            customerName = 'John Doe',
            orderId = 'TEST-ORDER-123'
        } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email address is required'
            });
        }

        const statuses = ['Confirmed', 'Manufacturing', 'Quality Assurance', 'Out For Delivery', 'Delivered'];
        const results = [];

        for (let i = 0; i < statuses.length; i++) {
            const status = statuses[i];
            const testData = {
                customerEmail: email,
                customerName,
                orderId: `${orderId}-${i + 1}`,
                newStatus: status,
                orderDate: new Date().toLocaleDateString(),
                total: 299.99,
                oldStatus: i > 0 ? statuses[i - 1] : undefined,
                statusMessage: getStatusMessage(status),
                products: [
                    { name: 'Diamond Engagement Ring', quantity: 1, price: 299.99 }
                ]
            };

            // Add images for manufacturing and quality
            if (status === 'Manufacturing' || status === 'Quality Assurance') {
                testData.images = [
                    {
                        filename: `${status.toLowerCase()}-image.jpg`,
                        description: getImageDescription(status, 1),
                        path: null
                    }
                ];
            }

            // Add tracking for delivery statuses
            if (status.toLowerCase().includes('delivery')) {
                testData.trackingInfo = {
                    number: `TRK${Date.now()}`,
                    carrier: 'FedEx',
                    expectedDelivery: '1-2 business days'
                };
            }

            const result = await sendUnifiedOrderEmail(testData);
            results.push({
                status,
                success: result.success,
                messageId: result.messageId,
                error: result.error
            });

            // Add delay between emails to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        res.json({
            success: true,
            message: `Sent ${results.filter(r => r.success).length} out of ${results.length} test emails`,
            results
        });

    } catch (error) {
        console.error('Error in all-statuses email test:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * Quick test specific email types
 */
router.post('/confirmation', async (req, res) => {
    const result = await sendTestEmail({
        email: req.body.email,
        status: 'Confirmed',
        orderId: 'CONF-' + Date.now()
    });
    res.json(result);
});

router.post('/manufacturing', async (req, res) => {
    const result = await sendTestEmail({
        email: req.body.email,
        status: 'Manufacturing',
        orderId: 'MFG-' + Date.now()
    });
    res.json(result);
});

router.post('/quality', async (req, res) => {
    const result = await sendTestEmail({
        email: req.body.email,
        status: 'Quality Assurance',
        orderId: 'QA-' + Date.now()
    });
    res.json(result);
});

router.post('/delivery', async (req, res) => {
    const result = await sendTestEmail({
        email: req.body.email,
        status: 'Out For Delivery',
        orderId: 'DEL-' + Date.now()
    });
    res.json(result);
});

router.post('/delivered', async (req, res) => {
    const result = await sendTestEmail({
        email: req.body.email,
        status: 'Delivered',
        orderId: 'DELIVERED-' + Date.now()
    });
    res.json(result);
});

// Helper functions
function getStatusMessage(status) {
    const messages = {
        'Confirmed': 'Your payment has been successfully processed and your order is now confirmed. We will begin working on your beautiful jewelry piece right away!',
        'Manufacturing': 'Your jewelry has entered our manufacturing process. Our skilled artisans are carefully crafting your piece with attention to every detail.',
        'Quality Assurance': 'Your jewelry is now undergoing our rigorous quality assurance process. We ensure every piece meets our highest standards.',
        'Out For Delivery': 'Great news! Your jewelry is now out for delivery and should arrive within 1-2 business days. Please ensure someone is available to receive the package.',
        'Delivered': 'Your jewelry has been successfully delivered! We hope you absolutely love your new piece. Thank you for choosing Celora Jewelry!'
    };
    return messages[status] || `Your order status has been updated to ${status}.`;
}

function getImageDescription(status, index) {
    const descriptions = {
        'Confirmed': [`Order Confirmation ${index}`, `Confirmation Photo ${index}`],
        'Manufacturing': [`Manufacturing Progress ${index}`, `Crafting Process ${index}`],
        'Quality Assurance': [`Quality Check ${index}`, `Final Inspection ${index}`],
        'Out For Delivery': [`Packaging Photo ${index}`, `Ready for Delivery ${index}`],
        'Delivered': [`Delivery Confirmation ${index}`, `Package Delivered ${index}`]
    };
    return descriptions[status] ? descriptions[status][index - 1] : `Status Photo ${index}`;
}

module.exports = router;
