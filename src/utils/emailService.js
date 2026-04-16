const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const handlebars = require('handlebars');
const { EmailClient } = require('@azure/communication-email');

// Register Handlebars helpers
handlebars.registerHelper('eq', function(a, b) {
    return a === b;
});

handlebars.registerHelper('ne', function(a, b) {
    return a !== b;
});

handlebars.registerHelper('gt', function(a, b) {
    return a > b;
});

handlebars.registerHelper('lt', function(a, b) {
    return a < b;
});

handlebars.registerHelper('and', function() {
    return Array.prototype.slice.call(arguments, 0, -1).every(Boolean);
});

handlebars.registerHelper('or', function() {
    return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
});

handlebars.registerHelper('formatCurrency', function(amount) {
    if (typeof amount !== 'number') return '$0.00';
    return '$' + amount.toFixed(2);
});

handlebars.registerHelper('formatDate', function(date) {
    if (!date) return new Date().toLocaleDateString();
    return new Date(date).toLocaleDateString();
});

handlebars.registerHelper('inc', function(value) {
  return parseInt(value) + 1;
});

// Helper for first item in array
handlebars.registerHelper('first', function(array) {
  return array && array.length > 0 ? array[0] : null;
});

// Helper to check if array has items
handlebars.registerHelper('hasItems', function(array) {
  return array && array.length > 0;
});// Initialize the Azure Email Client
const connectionString = process.env.AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING;

// Validate connection string on startup
if (!connectionString) {
  console.error('❌ CRITICAL: AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING is not set in .env');
  console.error('Email service will be unavailable until this is configured');
}

let client = null;
try {
  if (connectionString) {
    client = new EmailClient(connectionString);
    console.log('✅ Azure Communication Services client initialized');
  }
} catch (error) {
  console.error('❌ Failed to initialize Azure Email Client:', error.message);
}

// Utility function to convert relative paths to full URLs
const convertToFullUrl = (imageUrl) => {
  if (!imageUrl) return null;
  
  // If it's already a full URL, return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // If it's an Azure blob URL (contains blob.core.windows.net), return as-is
  if (imageUrl.includes('blob.core.windows.net')) {
    return imageUrl;
  }
  
  // If it's a relative path starting with /uploads, convert to full URL
  if (imageUrl.startsWith('/uploads/')) {
    const baseUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${baseUrl}${imageUrl}`;
  }
  
  // For any other relative path, prepend base URL
  const baseUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
};

// Utility function to prepare images for email (both inline and attachments)
const prepareImagesForEmail = async (imageUrls) => {
  const inlineImages = [];
  const attachments = [];
  
  if (!imageUrls || imageUrls.length === 0) {
    return { inlineImages, attachments, imageData: [] };
  }
  
  const imageData = [];
  
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      // Convert relative paths to full URLs
      const fullImageUrl = convertToFullUrl(imageUrls[i]);
      console.log(`Converting image URL: ${imageUrls[i]} -> ${fullImageUrl}`);
      
      const attachment = await fetchImageAsBase64(fullImageUrl);
      const cid = `image${i + 1}`;
      
      // For inline embedding
      inlineImages.push({
        cid: cid,
        name: attachment.name,
        contentType: attachment.contentType,
        contentInBase64: attachment.contentInBase64
      });
      
      // For downloadable attachments
      attachments.push({
        name: `${i + 1}_${attachment.name}`,
        contentType: attachment.contentType,
        contentInBase64: attachment.contentInBase64
      });
      
      // For template data
      imageData.push({
        cid: cid,
        filename: cid, // For backwards compatibility
        name: attachment.name,
        index: i + 1,
        description: `Image ${i + 1}`
      });
      
    } catch (error) {
      console.error('Failed to prepare image:', imageUrls[i], 'Full URL:', convertToFullUrl(imageUrls[i]), error);
    }
  }
  
  return { inlineImages, attachments, imageData };
};
const fetchImageAsBase64 = async (imageUrl) => {
  return new Promise((resolve, reject) => {
    const protocol = imageUrl.startsWith('https:') ? https : http;
    
    protocol.get(imageUrl, (response) => {
      const chunks = [];
      
      response.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        
        // Determine content type from URL extension
        const extension = path.extname(imageUrl).toLowerCase();
        let contentType = 'image/jpeg'; // default
        
        switch (extension) {
          case '.png':
            contentType = 'image/png';
            break;
          case '.gif':
            contentType = 'image/gif';
            break;
          case '.webp':
            contentType = 'image/webp';
            break;
          case '.jpg':
          case '.jpeg':
          default:
            contentType = 'image/jpeg';
            break;
        }
        
        resolve({
          contentInBase64: base64,
          contentType: contentType,
          name: path.basename(imageUrl)
        });
      });
      
      response.on('error', (error) => {
        console.error('Error fetching image:', error);
        reject(error);
      });
    }).on('error', (error) => {
      console.error('Error fetching image:', error);
      reject(error);
    });
  });
};

// Generate plain text fallback content based on template and data
const generatePlainTextFallback = (data, templateName) => {
  try {
    switch (templateName) {
      case 'order-confirmed-new':
      case 'order-confirmed':
        return `
Order Confirmation - ${data.companyName || 'Celora Jewelry'}

Dear ${data.customerName || 'Valued Customer'},

Thank you for your order! Your order has been confirmed and is being processed.

Order Details:
- Order ID: ${data.orderId}
- Order Date: ${data.orderDate}
- Total Amount: ${data.formattedTotal || data.total}
- Status: ${data.status || 'Confirmed'}

${data.products && data.products.length > 0 ? 
  'Products:\n' + data.products.map((p, i) => `${i + 1}. ${p.productTitle || p.name} - ${p.formattedPrice || p.price} (Qty: ${p.quantity})`).join('\n') :
  ''
}

${data.trackOrderUrl ? `Track your order: ${data.trackOrderUrl}` : ''}

If you have any questions, please don't hesitate to contact us.

Best regards,
${data.companyName || 'Celora Jewelry'} Team
        `.trim();

      case 'refund-confirmation':
        return `
Refund Confirmation - ${data.companyName || 'Celora Jewelry'}

Dear ${data.customerName || 'Valued Customer'},

Your refund has been processed successfully.

Refund Details:
- Order ID: ${data.orderId}
- Refund Amount: $${data.refundAmount}
- Refund ID: ${data.refundId}
- Reason: ${data.reason || 'Refund requested'}
- Processing Date: ${new Date().toLocaleDateString()}

The refund will appear in your original payment method within 3-5 business days.

If you have any questions about this refund, please contact our customer service team.

Best regards,
${data.companyName || 'Celora Jewelry'} Team
        `.trim();

      case 'payment-failed':
        return `
Payment Failed - ${data.companyName || 'Celora Jewelry'}

Dear ${data.customerName || 'Valued Customer'},

We were unable to process your payment for order ${data.orderId}.

Reason: ${data.failureReason || 'Payment could not be processed'}

${data.retryUrl ? `You can retry your payment here: ${data.retryUrl}` : ''}

If you continue to experience issues, please contact our support team.

Best regards,
${data.companyName || 'Celora Jewelry'} Team
        `.trim();

      case 'order-status-update':
      case 'order-status-update-new':
        return `
Order Status Update - ${data.companyName || 'Celora Jewelry'}

Dear ${data.customerName || 'Valued Customer'},

Your order status has been updated.

Order Details:
- Order ID: ${data.orderId}
- New Status: ${data.newStatus || data.orderStatus}
- Update Date: ${data.statusDate || new Date().toLocaleDateString()}

${data.trackingId ? `Tracking Number: ${data.trackingId}` : ''}
${data.trackingLink ? `Track Package: ${data.trackingLink}` : ''}
${data.trackOrderUrl ? `View Order: ${data.trackOrderUrl}` : ''}

${data.statusMessage || 'Your order is progressing as expected.'}

Best regards,
${data.companyName || 'Celora Jewelry'} Team
        `.trim();

      default:
        // Generic fallback
        return `
${data.companyName || 'Celora Jewelry'}

Dear ${data.customerName || 'Valued Customer'},

${data.orderId ? `Order ID: ${data.orderId}` : ''}
${data.message || 'Thank you for choosing our services.'}

${data.trackOrderUrl ? `Track your order: ${data.trackOrderUrl}` : ''}

For the best experience, please view this email in an HTML-capable email client.

Best regards,
${data.companyName || 'Celora Jewelry'} Team
        `.trim();
    }
  } catch (error) {
    console.error('Error generating plain text fallback:', error);
    return `
${data.companyName || 'Celora Jewelry'}

Dear ${data.customerName || 'Valued Customer'},

${data.orderId ? `Order ID: ${data.orderId}` : ''}

For the best experience, please view this email in an HTML-capable email client.

Best regards,
${data.companyName || 'Celora Jewelry'} Team
    `.trim();
  }
};

// Load an HTML template from the 'templates' directory
const loadTemplate = (templateName) => {
  // Construct the full path to the template file
  const filePath = path.join(__dirname, '../templates', `${templateName}.html`);
  // Read the file content synchronously
  return fs.readFileSync(filePath, 'utf8');
};

// Replace placeholders like {{name}} in the template with actual data using Handlebars
const renderTemplate = (template, data) => {
  try {
    // Compile the template with Handlebars
    const compiledTemplate = handlebars.compile(template);
    
    // Render with data
    const html = compiledTemplate(data);
    
    return html;
  } catch (error) {
    console.error('Error rendering template with Handlebars:', error);
    // Fallback to simple replacement for basic placeholders
    return Object.keys(data).reduce((html, key) => {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const value = data[key];
      // Only replace if it's not an object or array
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return html.replace(placeholder, value);
      }
      return html;
    }, template);
  }
};

/**
 * Sends an email using Azure Communication Services.
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} templateName - The name of the HTML template file (without .html extension).
 * @param {object} data - The data object to populate the template's placeholders.
 * @param {Array} attachments - Array of attachment objects with { name, contentType, contentInBase64 }
 * @param {Array} inlineImages - Array of inline image objects with { cid, name, contentType, contentInBase64 }
 */
const sendEmail = async (to, subject, templateName, data, attachments = [], inlineImages = [], retryCount = 0, maxRetries = 2) => {
  try {
    // Check if Azure client is initialized
    if (!client) {
      throw new Error('Azure Email Client is not initialized. Check AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING in .env');
    }

    // 1. Load and render the HTML content for the email
    const template = loadTemplate(templateName);
    const htmlContent = renderTemplate(template, data);

    // 2. Construct the email message payload
    const emailMessage = {
      senderAddress: process.env.EMAIL_FROM,
      bcc : "20bmiit076@gmail.com",
      content: {
        subject: subject,
        plainText: generatePlainTextFallback(data, templateName),
        html: htmlContent
      },
      recipients: {
        to: [
          {
            address: to
          }
        ]
      }
    };

    // 3. Add attachments and inline images
    const allAttachments = [];
    
    if (attachments && attachments.length > 0) {
      allAttachments.push(...attachments);
    }
    
    if (inlineImages && inlineImages.length > 0) {
      const inlineAttachments = inlineImages.map(img => ({
        name: img.name,
        contentType: img.contentType,
        contentInBase64: img.contentInBase64,
        contentId: img.cid
      }));
      allAttachments.push(...inlineAttachments);
    }
    
    if (allAttachments.length > 0) {
      emailMessage.attachments = allAttachments;
    }

    // 4. Send with improved error handling and logging
    console.log(`📧 Attempting to send email to: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Template: ${templateName}`);
    console.log(`   Retry: ${retryCount}/${maxRetries}`);

    // Use beginSend with custom timeout and error handling
    const poller = await client.beginSend(emailMessage).catch(error => {
      console.error('❌ beginSend failed:', {
        error: error.message,
        code: error.code,
        status: error.statusCode
      });
      throw error;
    });

    // Poll with custom timeout (30 seconds)
    const pollTimeout = 30000;
    const startTime = Date.now();
    
    let result = null;
    let isPolling = true;
    let lastError = null;

    while (isPolling && (Date.now() - startTime) < pollTimeout) {
      try {
        // Check every 5 seconds if operation is done
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        if (poller.isDone?.()) {
          result = poller.getResult?.();
          if (result) {
            isPolling = false;
          }
        }

        // Fallback: try pollUntilDone with timeout
        if (!result) {
          try {
            result = await Promise.race([
              poller.pollUntilDone(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Polling timeout')), 5000)
              )
            ]);
            isPolling = false;
          } catch (timeoutError) {
            if (timeoutError.message === 'Polling timeout') {
              console.log(`⏳ Still polling... (${Math.round((Date.now() - startTime) / 1000)}s)`);
              // Continue polling
            } else {
              throw timeoutError;
            }
          }
        }
      } catch (pollError) {
        lastError = pollError;
        console.log(`⚠️ Polling error: ${pollError.message}`);
        
        // Check if we should retry
        if (retryCount < maxRetries && shouldRetry(pollError)) {
          console.log(`🔄 Retrying email send (attempt ${retryCount + 1}/${maxRetries})...`);
          return sendEmail(to, subject, templateName, data, attachments, inlineImages, retryCount + 1, maxRetries);
        }
        throw pollError;
      }
    }

    // Check if polling timed out
    if (isPolling) {
      console.warn(`⚠️ Email polling timed out after ${pollTimeout}ms`);
      // Job might still be processing, log it but don't fail
      console.log(`✅ Email accepted by Azure (may still be processing)`);
      return { messageId: 'pending', status: 'accepted', success: true };
    }

    if (!result) {
      throw new Error('No result from polling operation');
    }

    console.log(`✅ Email sent successfully to ${to}`);
    console.log(`   Message ID: ${result.messageId}`);
    
    return { ...result, success: true };

  } catch (error) {
    console.error('❌ Failed to send email:', {
      to: to,
      subject: subject,
      error: error.message,
      code: error.code,
      statusCode: error.statusCode
    });

    // Check if we should retry
    if (retryCount < maxRetries && shouldRetry(error)) {
      console.log(`🔄 Retrying email send (attempt ${retryCount + 1}/${maxRetries})...`);
      return sendEmail(to, subject, templateName, data, attachments, inlineImages, retryCount + 1, maxRetries);
    }

    // Return failure instead of throwing to allow order update to continue
    return { 
      success: false, 
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      retriesAttempted: retryCount
    };
  }
};

/**
 * Determine if an error should trigger a retry
 */
function shouldRetry(error) {
  if (!error) return false;
  
  const message = error.message || '';
  const code = error.code || '';
  
  // Retry on network/timeout errors
  const retryableErrors = [
    'timeout',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'TimeoutError',
    'ERR_HTTP_REQUEST_TIMEOUT',
    '429', // Too many requests
    '503', // Service unavailable
    '502', // Bad gateway
  ];
  
  return retryableErrors.some(err => 
    message.toLowerCase().includes(err.toLowerCase()) || 
    code.includes(err)
  );
}
//forget password
/**
 * Sends a password reset email to the user.
 * @param {string} to - The user's email address.
 * @param {string} resetUrl - The full password reset URL.
 * @param {string} name - The user's name to personalize the email.
 */
const sendPasswordResetEmail = async (to, resetUrl, name = 'User') => {
  const subject = 'Password Reset Request';

  // Call the main sendEmail function with the template and data
  return sendEmail(to, subject, 'reset-password', {
    name,
    resetUrl
  });
};
 const sendOrderConfirmedEmail = async (to, data, imageUrls = []) => {
  try {
    const { inlineImages, attachments, imageData } = await prepareImagesForEmail(imageUrls);
    
    // Add image data to template variables
    const templateData = {
      ...data,
      images: imageData,
      hasImages: imageData.length > 0,
      imageCount: imageData.length
    };
    
    return sendEmail(to, 'Your Order is Confirmed', 'order-confirmed', templateData, attachments, inlineImages);
  } catch (error) {
    console.error('Error sending order confirmed email:', error);
    throw error;
  }
};

const sendManufacturingEmail = async (to, data, imageUrls = []) => {
  try {
    const { inlineImages, attachments, imageData } = await prepareImagesForEmail(imageUrls);
    
    // Add image data to template variables
    const templateData = {
      ...data,
      images: imageData,
      hasImages: imageData.length > 0,
      imageCount: imageData.length
    };
    
    return sendEmail(to, 'Order in Manufacturing', 'order-manufacturing', templateData, attachments, inlineImages);
  } catch (error) {
    console.error('Error sending manufacturing email:', error);
    throw error;
  }
};

const sendQualityAssuranceEmail = async (to, data, imageUrls = []) => {
  try {
    const { inlineImages, attachments, imageData } = await prepareImagesForEmail(imageUrls);
    
    // Add image data to template variables
    const templateData = {
      ...data,
      images: imageData,
      hasImages: imageData.length > 0,
      imageCount: imageData.length
    };
    
    return sendEmail(to, 'Quality Check in Progress', 'order-quality', templateData, attachments, inlineImages);
  } catch (error) {
    console.error('Error sending quality assurance email:', error);
    throw error;
  }
};

const sendOutForDeliveryEmail = async (to, data, imageUrls = []) => {
  try {
    const { inlineImages, attachments, imageData } = await prepareImagesForEmail(imageUrls);
    
    // Add image data to template variables
    const templateData = {
      ...data,
      images: imageData,
      hasImages: imageData.length > 0,
      imageCount: imageData.length
    };
    
    return sendEmail(to, 'Your Order is Out for Delivery', 'order-delivery', templateData, attachments, inlineImages);
  } catch (error) {
    console.error('Error sending out for delivery email:', error);
    throw error;
  }
};

const sendDeliveredEmail = async (to, data) => {
  try {
    // No images for delivered status
    return sendEmail(to, 'Your Order is Delivered!', 'order-delivered', data);
  } catch (error) {
    console.error('Error sending delivered email:', error);
    throw error;
  }
};

// Function to send invoice email with PDF attachment (supports both file path and buffer)
const sendInvoiceEmail = async (to, customerName, orderId, invoiceData) => {
  try {
    const attachments = [];
    
    // Handle both file path (legacy) and invoice data object (new Azure approach)
    if (invoiceData) {
      if (typeof invoiceData === 'string') {
        // Legacy: file path
        if (fs.existsSync(invoiceData)) {
          const pdfBuffer = fs.readFileSync(invoiceData);
          const pdfBase64 = pdfBuffer.toString('base64');
          
          attachments.push({
            name: `invoice-${orderId}.pdf`,
            contentType: 'application/pdf',
            contentInBase64: pdfBase64
          });
        } else {
          console.warn('Invoice PDF not found or path not provided:', invoiceData);
        }
      } else if (invoiceData.buffer) {
        // New: Azure approach with buffer
        const pdfBase64 = invoiceData.buffer.toString('base64');
        
        attachments.push({
          name: `invoice-${orderId}.pdf`,
          contentType: 'application/pdf',
          contentInBase64: pdfBase64
        });
      }
    } else {
      console.warn('No invoice data provided');
    }
    
    const emailData = {
      customerName: customerName || 'Customer',
      orderId: orderId,
      date: new Date().toLocaleDateString()
    };
    
    // Send the email
    const result = await sendEmail(to, 'Your Order Invoice', 'invoice', emailData, attachments);
    
    // Clean up local file if it was a file path (legacy support)
    if (typeof invoiceData === 'string' && fs.existsSync(invoiceData)) {
      try {
        fs.unlinkSync(invoiceData);
        console.log(`📧 Invoice email sent and local PDF cleaned up: ${invoiceData}`);
      } catch (deleteError) {
        console.error('Error deleting invoice PDF after sending:', deleteError);
      }
    } else if (invoiceData.buffer) {
      console.log(`📧 Invoice email sent using Azure-stored PDF for order: ${orderId}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error sending invoice email:', error);
    throw error;
  }
};
const sendRetailerVerificationEmail = async (to, name) => {
  return sendEmail(to, 'Your Retailer Account is Verified', 'retailer-verification', {
    name
  });
};
const sendRetailerCouponEmail = async (to, name, coupon) => {
  return sendEmail(to, 'Your Exclusive Coupon Code', 'retailer-coupon', {
    name,
    couponCode: coupon.couponCode,
    couponName: coupon.couponName,
    expiry: new Date(coupon.dateRange.end).toLocaleDateString()
  });
};

// Function to send invoice email with PDF buffer (for Azure-stored PDFs)
const sendInvoiceEmailWithBuffer = async (to, customerName, orderId, pdfBuffer, filename) => {
  try {
    const attachments = [];
    
    // Convert PDF buffer to base64
    if (pdfBuffer && Buffer.isBuffer(pdfBuffer)) {
      const pdfBase64 = pdfBuffer.toString('base64');
      
      attachments.push({
        name: filename || `invoice-${orderId}.pdf`,
        contentType: 'application/pdf',
        contentInBase64: pdfBase64
      });
    } else {
      console.warn('No valid PDF buffer provided for invoice email');
    }
    
    const emailData = {
      customerName: customerName || 'Customer',
      orderId: orderId,
      date: new Date().toLocaleDateString()
    };
    
    const result = await sendEmail(to, 'Your Order Invoice', 'invoice', emailData, attachments);
    console.log(`📧 Invoice email sent using Azure-stored PDF for order: ${orderId}`);
    
    return result;
  } catch (error) {
    console.error('Error sending invoice email with buffer:', error);
    throw error;
  }
};

const sendRefundConfirmationEmail = async (to, data) => {
  try {
    const templateData = {
      ...data,
      processingDate: new Date(),
      refundDate: new Date().toLocaleDateString(),
      supportEmail: 'support@celorajewelry.com',
      websiteUrl: 'https://celorajewelry.com',
      siteUrl: 'https://celorajewelry.com',
      companyName: 'Celora Jewelry',
      currentYear: new Date().getFullYear(),
      // Format the refund amount properly
      refundAmount: typeof data.refundAmount === 'number' ? data.refundAmount.toFixed(2) : data.refundAmount
    };
    
    return sendEmail(to, `Refund Processed - Order ${data.orderId}`, 'refund-confirmation', templateData);
  } catch (error) {
    console.error('Error sending refund confirmation email:', error);
    throw error;
  }
};

const sendAdminRefundNotification = async (adminEmails, data) => {
  try {
    const templateData = {
      ...data,
      refundDate: new Date().toLocaleDateString(),
      currentTime: new Date().toLocaleTimeString(),
      currentYear: new Date().getFullYear(),
      customerEmailSent: data.customerEmailSuccess || false
    };
    
    // Send to multiple admin emails if provided as array, or single email
    const emails = Array.isArray(adminEmails) ? adminEmails : [adminEmails];
    
    const emailPromises = emails.map(email => 
      sendEmail(email, 'Refund Processed - Admin Notification', 'admin-refund-notification', templateData)
    );
    
    await Promise.all(emailPromises);
    console.log(`Admin refund notifications sent to ${emails.length} admin(s)`);
    
  } catch (error) {
    console.error('Error sending admin refund notification:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendOrderConfirmedEmail,
  sendManufacturingEmail,
  sendQualityAssuranceEmail,
  sendOutForDeliveryEmail,
  sendDeliveredEmail,
  sendInvoiceEmail,
  sendInvoiceEmailWithBuffer,
  sendRefundConfirmationEmail,
  sendAdminRefundNotification,
  fetchImageAsBase64,
  prepareImagesForEmail,
  sendRetailerVerificationEmail,
  sendRetailerCouponEmail
};

