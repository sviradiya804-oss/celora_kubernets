const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { sendEmail } = require('./emailService'); // Use existing email service

// Register Handlebars helpers
handlebars.registerHelper('gt', function(a, b) {
    return a > b;
});

handlebars.registerHelper('eq', function(a, b) {
    return a === b;
});

handlebars.registerHelper('or', function() {
    return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
});

handlebars.registerHelper('and', function() {
    return Array.prototype.slice.call(arguments, 0, -1).every(Boolean);
});

handlebars.registerHelper('formatCurrency', function(amount) {
    if (typeof amount !== 'number') return '$0.00';
    return '$' + amount.toFixed(2);
});

handlebars.registerHelper('formatDate', function(date) {
    if (!date) return new Date().toLocaleDateString();
    return new Date(date).toLocaleDateString();
});

/**
 * Unified email service for all order status updates - Uses existing Azure email service
 * @param {Object} emailData - The email data object
 * @param {string} emailData.customerEmail - Customer's email address
 * @param {string} emailData.customerName - Customer's name
 * @param {string} emailData.orderId - Order ID
 * @param {string} emailData.orderDate - Order date
 * @param {string} emailData.newStatus - Current/new status
 * @param {string} emailData.oldStatus - Previous status (optional)
 * @param {string} emailData.statusMessage - Custom status message (optional)
 * @param {number} emailData.total - Order total amount (optional)
 * @param {Array} emailData.images - Array of image objects with filename and description (optional)
 * @param {Array} emailData.products - Array of product objects (optional)
 * @param {Object} emailData.trackingInfo - Tracking information object (optional)
 * @param {boolean} emailData.showNextSteps - Whether to show next steps section (default: true)
 */
const sendUnifiedOrderEmail = async (emailData) => {
    try {
        // Determine status-specific data
        const statusData = getStatusSpecificData(emailData.newStatus);
        
        // Prepare template data for existing email service
        const templateData = {
            ...emailData,
            ...statusData,
            showNextSteps: emailData.showNextSteps !== false, // Default to true
            orderDate: emailData.orderDate || new Date().toLocaleDateString(),
            // Format data for template
            formattedTotal: emailData.total ? '$' + emailData.total.toFixed(2) : '$0.00',
            currentYear: new Date().getFullYear(),
            companyName: 'Celora Jewelry',
            
            // Handle multiple products properly
            products: emailData.products && emailData.products.length > 0 ? emailData.products.map((product, index) => ({
                ...product,
                productTitle: product.title || product.productDetails?.title || `Product ${index + 1}`,
                productDescription: product.description || product.productDetails?.description || '',
                productPrice: product.price || product.priceAtTime || product.productDetails?.price || 0,
                formattedPrice: '$' + (product.price || product.priceAtTime || product.productDetails?.price || 0).toFixed(2),
                productQuantity: product.quantity || 1,
                productVariant: product.type || product.selectedVariant || 'Standard',
                productCategory: product.category || product.productDetails?.category || '',
                productMaterial: product.material || product.productDetails?.material || '',
                itemTotal: (product.price || product.priceAtTime || product.productDetails?.price || 0) * (product.quantity || 1),
                formattedItemTotal: '$' + ((product.price || product.priceAtTime || product.productDetails?.price || 0) * (product.quantity || 1)).toFixed(2),
                productImages: product.images || product.productDetails?.images || []
            })) : [],
            
            // Add flags for template conditionals
            hasProducts: emailData.products && emailData.products.length > 0,
            hasMultipleProducts: emailData.products && emailData.products.length > 1,
            productCount: emailData.products ? emailData.products.length : 0,
            
            // Ensure images array exists and is properly formatted
            images: emailData.images && emailData.images.length > 0 ? emailData.images.map((image, index) => ({
                ...image,
                cid: `image${index + 1}`,
                index: index + 1
            })) : [],
            // Add hasImages flag for conditional rendering
            hasImages: emailData.images && emailData.images.length > 0
        };

        // Generate email subject
        const subject = getEmailSubject(emailData.newStatus, emailData.orderId);

        // Prepare attachments from images if provided
        const attachments = [];
        if (emailData.images && emailData.images.length > 0) {
            for (const image of emailData.images) {
                if (image.path && image.filename) {
                    // Note: You may need to convert file paths to base64 for Azure
                    // This depends on your existing image handling in emailService
                    attachments.push({
                        name: image.filename,
                        description: image.description || '',
                        path: image.path
                    });
                }
            }
        }

        // Use existing email service with unified template
        const result = await sendEmail(
            emailData.customerEmail,
            
            subject,
            'order-status-update-new', // Template name (without .html)
            templateData,
            attachments, // Attachments
            [] // Inline images (empty for now, can be enhanced later)
        );
        
        // Handle both old (throws error) and new (returns object) API
        if (result && result.success === false) {
            console.warn(`⚠️ Order ${emailData.newStatus} email failed to send to ${emailData.customerEmail}:`, result.error);
            return { 
                success: false, 
                error: result.error || 'Failed to send email',
                details: result
            };
        }
        
        console.log(`✅ Order ${emailData.newStatus} email sent successfully to ${emailData.customerEmail}`);
        return { success: true, messageId: result?.messageId || 'sent', result };

    } catch (error) {
        console.error('Error sending unified order email:', error);
        
        // If template not found, provide helpful error message
        if (error.message?.includes('ENOENT') || error.message?.includes('template')) {
            return { 
                success: false, 
                error: `Template 'order-status-update-new.html' not found. Please ensure the template exists in src/templates/`,
                details: error.message 
            };
        }
        
        // If Azure credentials issue
        if (error.message?.includes('authentication') || error.message?.includes('credentials') || error.message?.includes('initialized')) {
            return { 
                success: false, 
                error: 'Email service authentication failed. Please check AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING in .env',
                details: error.message 
            };
        }
        
        return { success: false, error: error.message };
    }
};

/**
 * Get status-specific template data
 * @param {string} status - The order status
 * @returns {Object} Status-specific data for the template
 */
const getStatusSpecificData = (status) => {
    const normalizedStatus = status.toLowerCase().replace(/\s+/g, '');
    
    const statusMap = {
        'confirmed': {
            isConfirmation: true,
            statusClass: 'confirmed',
            isManufacturing: false,
            isQuality: false,
            isDelivery: false,
            isDelivered: false
        },
        'manufacturing': {
            isConfirmation: false,
            statusClass: 'manufacturing',
            isManufacturing: true,
            isQuality: false,
            isDelivery: false,
            isDelivered: false
        },
        'qualityassurance': {
            isConfirmation: false,
            statusClass: 'quality',
            isManufacturing: false,
            isQuality: true,
            isDelivery: false,
            isDelivered: false
        },
        'quality': {
            isConfirmation: false,
            statusClass: 'quality',
            isManufacturing: false,
            isQuality: true,
            isDelivery: false,
            isDelivered: false
        },
        'outfordelivery': {
            isConfirmation: false,
            statusClass: 'delivery',
            isManufacturing: false,
            isQuality: false,
            isDelivery: true,
            isDelivered: false
        },
        'shipping': {
            isConfirmation: false,
            statusClass: 'delivery',
            isManufacturing: false,
            isQuality: false,
            isDelivery: true,
            isDelivered: false
        },
        'delivered': {
            isConfirmation: false,
            statusClass: 'delivered',
            isManufacturing: false,
            isQuality: false,
            isDelivery: false,
            isDelivered: true
        }
    };

    return statusMap[normalizedStatus] || {
        isConfirmation: false,
        statusClass: 'update',
        isManufacturing: false,
        isQuality: false,
        isDelivery: false,
        isDelivered: false
    };
};

/**
 * Generate appropriate email subject based on status
 * @param {string} status - The order status
 * @param {string} orderId - The order ID
 * @returns {string} Email subject line
 */
const getEmailSubject = (status, orderId) => {
    const subjects = {
        'confirmed': `Order Confirmation - #${orderId} | Celora Jewelry`,
        'manufacturing': `Your Order is Being Crafted - #${orderId} | Celora Jewelry`,
        'quality assurance': `Quality Check Complete - #${orderId} | Celora Jewelry`,
        'quality': `Quality Check Complete - #${orderId} | Celora Jewelry`,
        'out for delivery': `Your Order is On Its Way! - #${orderId} | Celora Jewelry`,
        'shipping': `Your Order is On Its Way! - #${orderId} | Celora Jewelry`,
        'delivered': `Order Delivered! - #${orderId} | Celora Jewelry`
    };

    return subjects[status.toLowerCase()] || `Order Update - #${orderId} | Celora Jewelry`;
};

/**
 * Quick function for order confirmation emails
 */
const sendOrderConfirmationEmail = async (orderData) => {
    return await sendUnifiedOrderEmail({
        ...orderData,
        newStatus: 'Confirmed',
        statusMessage: 'Your payment has been successfully processed and your order is now confirmed.',
        showNextSteps: true
    });
};

/**
 * Quick function for manufacturing update emails
 */
const sendManufacturingEmail = async (orderData) => {
    return await sendUnifiedOrderEmail({
        ...orderData,
        newStatus: 'Manufacturing',
        statusMessage: 'Your jewelry has entered our manufacturing process. Our skilled artisans are carefully crafting your piece.',
        showNextSteps: true
    });
};

/**
 * Quick function for quality assurance emails
 */
const sendQualityEmail = async (orderData) => {
    return await sendUnifiedOrderEmail({
        ...orderData,
        newStatus: 'Quality Assurance',
        statusMessage: 'Your jewelry is now undergoing our rigorous quality assurance process.',
        showNextSteps: true
    });
};

/**
 * Quick function for delivery emails
 */
const sendDeliveryEmail = async (orderData) => {
    return await sendUnifiedOrderEmail({
        ...orderData,
        newStatus: 'Out For Delivery',
        statusMessage: 'Great news! Your jewelry is now out for delivery and should arrive within 1-2 business days.',
        showNextSteps: true
    });
};

/**
 * Quick function for delivered confirmation emails
 */
const sendDeliveredEmail = async (orderData) => {
    return await sendUnifiedOrderEmail({
        ...orderData,
        newStatus: 'Delivered',
        statusMessage: 'Your jewelry has been successfully delivered! We hope you love your new piece.',
        showNextSteps: true
    });
};

/**
 * Test function to send sample emails
 */
const sendTestEmail = async (testData) => {
    const sampleData = {
        customerEmail: testData.email || 'test@example.com',
        customerName: testData.customerName || 'John Doe',
        orderId: testData.orderId || 'TEST-ORDER-123',
        orderDate: new Date().toLocaleDateString(),
        newStatus: testData.status || 'Confirmed',
        total: testData.total || 299.99,
        products: testData.products || [
            { name: 'Diamond Ring', quantity: 1, price: 299.99 }
        ],
        images: testData.images || [],
        trackingInfo: testData.trackingInfo || null,
        showNextSteps: true
    };

    return await sendUnifiedOrderEmail(sampleData);
};

module.exports = {
    sendUnifiedOrderEmail,
    sendOrderConfirmationEmail,
    sendManufacturingEmail,
    sendQualityEmail,
    sendDeliveryEmail,
    sendDeliveredEmail,
    sendTestEmail
};
