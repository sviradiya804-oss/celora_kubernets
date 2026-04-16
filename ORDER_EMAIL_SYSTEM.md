# Order Status Email Documentation

## Overview
This system automatically sends email notifications to customers when their order status is updated, with the ability to attach images for each stage of the order process.

## Email Types and When They're Sent

### 1. Order Confirmed
- **Trigger**: When order status is updated to "Confirmed"
- **Images**: Photos of confirmed order items
- **Template**: `order-confirmed.html`

### 2. Manufacturing
- **Trigger**: When order status is updated to "Manufacturing" 
- **Images**: Photos of items being manufactured
- **Template**: `order-manufacturing.html`

### 3. Quality Assurance
- **Trigger**: When order status is updated to "Quality Assurance"
- **Images**: Photos of quality check process
- **Template**: `order-quality.html`

### 4. Out For Delivery
- **Trigger**: When order status is updated to "Out For Delivery"
- **Images**: Photos of packaged items
- **Additional Data**: Tracking ID and tracking link
- **Template**: `order-delivery.html`

### 5. Delivered
- **Trigger**: When order status is updated to "Delivered"
- **Images**: None (no images needed for delivered status)
- **Template**: `order-delivered.html`

### 6. Invoice Email
- **Trigger**: When order is completed
- **Attachments**: PDF invoice
- **Template**: `invoice.html`

## How to Update Order Status with Images

When updating an order status through the API, upload images along with the status update:

```javascript
// Example: Update order to Manufacturing with images
PUT /api/order/{orderId}
Content-Type: multipart/form-data

Form data:
- status: "Manufacturing"
- images: [file1.jpg, file2.jpg, file3.jpg]
```

The system will:
1. Upload images to Azure Blob Storage
2. Update the order status and progress
3. Fetch the customer's email
4. Send an email with images attached
5. Log the email delivery status

## API Endpoints for Email Testing

### Test Email Functionality
```javascript
POST /api/orders/test-email
{
  "email": "test@example.com",
  "type": "manufacturing", // confirmed, manufacturing, quality, delivery, delivered, invoice
  "imageUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "orderId": "TEST-ORDER-123",
  "customerName": "Test Customer"
}
```

### Send Manual Status Email
```javascript
POST /api/orders/send-status-email
{
  "orderId": "ORDER-123",
  "status": "Manufacturing",
  "imageUrls": [
    "https://example.com/manufacturing1.jpg",
    "https://example.com/manufacturing2.jpg"
  ]
}
```

## Email Template Variables

All email templates have access to these variables:

- `{{customerName}}` - Customer's name
- `{{orderId}}` - Order ID
- `{{trackingId}}` - Tracking ID (for delivery emails)
- `{{trackingLink}}` - Tracking URL (for delivery emails)
- `{{date}}` - Current date

## Image Attachment Process

1. **Image Upload**: Images are uploaded to Azure Blob Storage during order status update
2. **URL Storage**: Image URLs are stored in the order's progress object
3. **Email Attachment**: When sending emails, images are:
   - Fetched from the URLs
   - Converted to base64
   - Attached to the email

## Error Handling

The system includes comprehensive error handling:

- **Image Fetch Failures**: If an image URL fails to load, the email is still sent without that image
- **Email Delivery Failures**: Failures are logged in the order's `emailLog` array
- **Missing Customer Data**: System handles missing customer email gracefully

## Email Log Tracking

Each email sent is logged in the order document:

```javascript
emailLog: [{
  stage: "Manufacturing",
  sentAt: "2025-01-25T10:30:00Z",
  success: true,
  imagesCount: 3,
  error: null // only present if success: false
}]
```

## Azure Communication Services Configuration

Ensure these environment variables are set:

```bash
AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING=your_connection_string
EMAIL_FROM=noreply@yourdomain.com
```

## Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

## Production Considerations

1. **Image Size Limits**: Azure Communication Services has attachment size limits
2. **Email Rate Limits**: Be aware of Azure email sending rate limits
3. **Image Optimization**: Consider compressing images before upload
4. **Fallback Handling**: System gracefully handles missing images or email failures
5. **Template Customization**: Email templates can be customized in the `/src/templates/` directory

## Monitoring and Debugging

- Check order's `emailLog` array for email delivery status
- Monitor Azure Communication Services logs
- Use test endpoints to verify email functionality
- Check console logs for detailed error information

## Sample Email Flow

1. Admin uploads manufacturing photos and updates order status to "Manufacturing"
2. System uploads images to Azure Blob Storage
3. System updates order progress with image URLs
4. System fetches customer email from user record
5. System converts image URLs to base64 attachments
6. System sends "Manufacturing" email with attached images
7. System logs email delivery status in order document
8. Customer receives email with manufacturing photos attached
