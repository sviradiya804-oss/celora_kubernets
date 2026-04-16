# 📧 Unified Email Template System - Integration Guide

## 🎯 Overview

The unified email template system consolidates all order status emails into a single, professional template that automatically adapts based on the order status. This eliminates the need for multiple HTML files and provides consistent styling across all communications.

## 🏗️ Architecture

### Files Created:
1. **`order-status-update-new.html`** - Single unified template
2. **`unifiedEmailService.js`** - Email service with Handlebars helpers
3. **`testEmailRoutes.js`** - Testing endpoints
4. **`unifiedOrderController.js`** - Order status management
5. **Updated Postman Collection** - Comprehensive testing suite

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install handlebars nodemailer
```

### 2. Add Test Routes to Your App
```javascript
// In your main app.js or server.js
const testEmailRoutes = require('./src/routes/testEmailRoutes');
app.use('/api/test-email', testEmailRoutes);
```

### 3. Basic Usage
```javascript
const { sendUnifiedOrderEmail } = require('./src/utils/unifiedEmailService');

// Send any status email
await sendUnifiedOrderEmail({
    customerEmail: 'customer@example.com',
    customerName: 'John Doe',
    orderId: 'ORDER-123',
    newStatus: 'Manufacturing',
    statusMessage: 'Your jewelry is being crafted...',
    total: 299.99
});
```

## 📊 Template Features

### ✅ Fixed Issues:
- ❌ **Removed formatting errors** in the original template
- ✅ **Proper Handlebars syntax** with correct if/else logic
- ✅ **Responsive design** that works on all devices
- ✅ **Dynamic content** based on order status
- ✅ **Professional gradient styling** throughout
- ✅ **Consistent branding** across all emails

### 🎨 Design Features:
- **Gradient backgrounds** for modern look
- **Status-specific colors** (confirmed=green, manufacturing=yellow, etc.)
- **Mobile-responsive** grid layouts
- **Professional typography** with proper spacing
- **Interactive buttons** with hover effects
- **Image galleries** for manufacturing progress

### 🔧 Template Logic:
```handlebars
{{#if isConfirmation}}
    <!-- Confirmation-specific content -->
{{else if isManufacturing}}
    <!-- Manufacturing-specific content -->
{{else if isDelivered}}
    <!-- Delivered-specific content -->
{{/if}}
```

## 📝 Usage Examples

### Example 1: Order Confirmation
```javascript
const { sendOrderConfirmationEmail } = require('./src/utils/unifiedEmailService');

await sendOrderConfirmationEmail({
    customerEmail: 'customer@example.com',
    customerName: 'John Doe',
    orderId: 'ORDER-123',
    orderDate: '7/28/2025',
    total: 299.99,
    products: [
        { name: 'Diamond Ring', quantity: 1, price: 299.99 }
    ]
});
```

### Example 2: Manufacturing Update with Images
```javascript
await sendUnifiedOrderEmail({
    customerEmail: 'customer@example.com',
    customerName: 'John Doe',
    orderId: 'ORDER-123',
    newStatus: 'Manufacturing',
    oldStatus: 'Confirmed',
    statusMessage: 'Your jewelry is being expertly crafted...',
    images: [
        {
            filename: 'progress1.jpg',
            description: 'Initial crafting stage',
            path: '/path/to/image1.jpg'
        },
        {
            filename: 'progress2.jpg',
            description: 'Detail work in progress',
            path: '/path/to/image2.jpg'
        }
    ]
});
```

### Example 3: Delivery with Tracking
```javascript
await sendUnifiedOrderEmail({
    customerEmail: 'customer@example.com',
    customerName: 'John Doe',
    orderId: 'ORDER-123',
    newStatus: 'Out For Delivery',
    statusMessage: 'Your order is on its way!',
    trackingInfo: {
        number: 'TRK123456789',
        carrier: 'FedEx',
        expectedDelivery: '2-3 business days',
        url: 'https://fedex.com/track?number=TRK123456789'
    }
});
```

## 🔄 Integration with Existing System

### Option 1: Replace Existing Email Functions
```javascript
// OLD: Multiple separate functions
// sendOrderConfirmedEmail()
// sendOrderManufacturingEmail()
// sendOrderQualityEmail()
// etc.

// NEW: Single unified function
const { sendUnifiedOrderEmail } = require('./src/utils/unifiedEmailService');

// In your order update logic:
await sendUnifiedOrderEmail({
    customerEmail: order.customer.email,
    customerName: order.customer.name,
    orderId: order._id,
    newStatus: 'Manufacturing', // Pass any status
    // ... other data
});
```

### Option 2: Use the Enhanced Controller
```javascript
const { updateOrderStatusWithEmail } = require('./src/controllers/unifiedOrderController');

// This handles both database update AND email sending
const result = await updateOrderStatusWithEmail(
    orderId, 
    'Manufacturing', 
    'customer@example.com',
    {
        statusMessage: 'Custom message here',
        images: [/* image objects */],
        trackingInfo: {/* tracking data */}
    }
);
```

## 🧪 Testing

### Using Postman Collection:
1. **Import** the updated collection
2. **Set variables**: `TEST_EMAIL`, `CUSTOMER_NAME`
3. **Run tests**:
   - Single status test
   - All statuses in sequence
   - Individual status tests

### Using Test Routes:
```bash
# Test single email
POST /api/test-email/unified
{
  "email": "test@example.com",
  "status": "Manufacturing",
  "includeImages": true,
  "includeProducts": true
}

# Test all statuses
POST /api/test-email/all-statuses
{
  "email": "test@example.com",
  "customerName": "John Doe"
}
```

## 🎛️ Configuration

### Environment Variables:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@celorajewelry.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

### Template Customization:
The template automatically handles:
- ✅ **Status-specific styling** (colors, icons, messages)
- ✅ **Conditional sections** (next steps, tracking, images)
- ✅ **Responsive layouts** for mobile devices
- ✅ **Professional branding** with gradients and shadows

## 📈 Benefits

### For Developers:
- **Single template** to maintain instead of 5 separate files
- **Type safety** with clear parameter interfaces
- **Consistent styling** across all emails
- **Easy testing** with comprehensive test suite

### For Customers:
- **Professional appearance** with modern design
- **Consistent experience** across all order stages
- **Clear information** with structured layouts
- **Mobile-friendly** responsive design

### For Business:
- **Brand consistency** across all communications
- **Reduced maintenance** with unified system
- **Better tracking** with structured email data
- **Scalable solution** for future email types

## 🚨 Migration Steps

1. **Backup** existing email templates
2. **Test** the unified system with sample data
3. **Update** your order controllers to use new functions
4. **Deploy** with monitoring for email delivery
5. **Remove** old template files once confirmed working

## 📞 Support

The system includes comprehensive error handling and logging. Check console output for debugging information:

```javascript
// Success: "Order Manufacturing email sent successfully to customer@example.com"
// Error: "Failed to send status email for order ORDER-123: [error details]"
```

This unified system provides a professional, maintainable solution for all your order status communication needs! 🎉
