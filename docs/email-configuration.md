# Email Configuration for Refund System

## Environment Variables

Add these environment variables to your `.env` file to configure the refund email system:

```env
# Admin Notification Emails for Refunds
# Comma-separated list of admin emails who should receive refund notifications
ADMIN_NOTIFICATION_EMAILS=admin@celorajewelry.com,manager@celorajewelry.com,finance@celorajewelry.com

# Azure Email Service (already configured)
AZURE_COMMUNICATION_CONNECTION_STRING=your_azure_connection_string
```

## Email Notifications

When a refund is processed, the system automatically sends two types of emails:

### 1. Customer Refund Confirmation Email
- **Recipient**: Customer who placed the order
- **Template**: `refund-confirmation.html`
- **Content**: 
  - Refund amount and details
  - Order information
  - Processing timeline
  - Support contact information
  - Professional branding

### 2. Admin Refund Notification Email
- **Recipients**: Admin users (from `ADMIN_NOTIFICATION_EMAILS`)
- **Template**: `admin-refund-notification.html`
- **Content**:
  - Refund summary and amount
  - Order and customer details
  - Admin who processed the refund
  - System status updates
  - Action reminders

## Email Logging

All email attempts are logged in the order's `emailLog` array:

```json
{
  "stage": "refund_confirmation_email",
  "sentAt": "2025-07-29T10:30:00.000Z",
  "success": true,
  "message": "Refund confirmation email sent successfully to customer"
}
```

```json
{
  "stage": "admin_refund_notification", 
  "sentAt": "2025-07-29T10:30:05.000Z",
  "success": true,
  "message": "Admin notification sent to admin@celorajewelry.com, manager@celorajewelry.com"
}
```

## Error Handling

- Customer email failures are logged but don't stop the refund process
- Admin email failures are logged but don't affect the response
- If customer has no email, only admin notification is sent
- All email attempts are tracked for debugging

## Response Format

The refund API response includes email status:

```json
{
  "success": true,
  "message": "Refund processed successfully",
  "data": {
    "orderId": "ORD-12345",
    "refundId": "re_1ABC123def456",
    "refundAmount": 150.99,
    "refundStatus": "succeeded",
    "orderStatus": "Cancelled", 
    "paymentStatus": "refunded",
    "notifications": {
      "customerEmailSent": true,
      "customerEmail": "customer@example.com",
      "adminNotificationSent": true
    }
  }
}
```

## Testing Email Templates

You can test the email templates by:

1. Using the existing test email route (if available)
2. Processing a test refund in development environment
3. Checking the email logs in the order document

## Customization

To customize email content:

1. **Customer emails**: Edit `src/templates/refund-confirmation.html`
2. **Admin emails**: Edit `src/templates/admin-refund-notification.html`
3. **Email data**: Modify the email service functions in `src/utils/emailService.js`

Both templates use Handlebars templating engine for dynamic content injection.
