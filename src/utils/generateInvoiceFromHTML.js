const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const { uploadToAzureBlob } = require('../services/azureStorageService');

// Register Handlebars helpers
handlebars.registerHelper('first', function(array) {
  return array && array.length > 0 ? array[0] : null;
});

handlebars.registerHelper('hasItems', function(array) {
  return array && array.length > 0;
});

handlebars.registerHelper('inc', function(value) {
  return parseInt(value) + 1;
});

// Generate PDF and upload to Azure Storage
async function generateInvoiceToAzure(order) {
  let browser;
  try {
    // Read the invoice template
    const templatePath = path.join(__dirname, '../templates/invoice-new.html');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Compile the template
    const template = handlebars.compile(templateContent);
    
    // Prepare data for the invoice (same as existing function)
    const invoiceData = {
      orderId: order.orderId,
      invoiceDate: new Date().toLocaleDateString(),
      paymentStatus: order.paymentStatus === 'paid' ? 'PAID' : 'PENDING',
      customerName: order.customerData?.name || order.customer?.firstName || 'Valued Customer',
      customerEmail: order.customerData?.email || order.customer?.email || '',
      customerPhone: order.customerData?.phone || order.customer?.phone || '',
      shippingAddress: order.shippingAddress || '',
      paymentMethod: order.paymentDetails?.paymentMethod || 'Card',
      paymentDate: order.paymentDetails?.createdOn ? new Date(order.paymentDetails.createdOn).toLocaleDateString() : new Date().toLocaleDateString(),
      transactionId: order.paymentDetails?.stripeSessionId || order.paymentDetails?.transactionId || '',
      
      // Products with enhanced data
      products: (order.subOrders || []).map((product, index) => ({
        title: product.productDetails?.title || product.productDetails?.name || `Product ${index + 1}`,
        description: product.productDetails?.description || '',
        category: product.productDetails?.category || '',
        material: product.productDetails?.material || '',
        type: product.type || 'jewelry',
        quantity: product.quantity || 1,
        images: product.imageUrl ? [product.imageUrl] : (product.productDetails?.images || []),
        formattedPrice: '$' + (product.priceAtTime || 0).toFixed(2),
        formattedTotal: '$' + ((product.priceAtTime || 0) * (product.quantity || 1)).toFixed(2)
      })),
      
      // Totals
      subtotal: '$' + (order.subtotal || order.total || 0).toFixed(2),
      discount: order.discount ? '$' + order.discount.toFixed(2) : null,
      shipping: order.shipping ? '$' + order.shipping.toFixed(2) : null,
      total: '$' + (order.total || 0).toFixed(2),
      
      // Current year for footer
      currentYear: new Date().getFullYear()
    };
    
    // Render the HTML
    const html = template(invoiceData);
    
    // Launch Puppeteer and generate PDF
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF as buffer instead of saving to file
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    
    await browser.close();
    
    // Upload PDF to Azure Storage
    const filename = `invoice-${order.orderId}-${Date.now()}.pdf`;
    const azureUrl = await uploadToAzureBlob(pdfBuffer, filename, 'invoices');
    
    console.log(`✅ Invoice PDF generated and uploaded to Azure: ${azureUrl}`);
    
    return {
      url: azureUrl,
      buffer: pdfBuffer,
      filename: filename
    };
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('❌ Error generating invoice PDF:', error);
    throw error;
  }
}

async function generateInvoiceFromHTML(order, filepath) {
  try {
    // Read the invoice template
    const templatePath = path.join(__dirname, '../templates/invoice-new.html');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Compile the template
    const template = handlebars.compile(templateContent);
    
    // Prepare data for the invoice
    const invoiceData = {
      orderId: order.orderId,
      invoiceDate: new Date().toLocaleDateString(),
      paymentStatus: order.paymentStatus === 'paid' ? 'PAID' : order.paymentStatus?.toUpperCase() || 'PENDING',
      
      // Customer information
      customerName: order.customer?.firstName ? 
        `${order.customer.firstName} ${order.customer.lastName || ''}`.trim() : 
        order.customer?.name || order.customerData?.name || 'Valued Customer',
      customerEmail: order.customer?.email || order.customerData?.email || '',
      customerPhone: order.customer?.phone || order.customerData?.phone || null,
      shippingAddress: order.shippingAddress ? 
        (typeof order.shippingAddress === 'string' ? order.shippingAddress : 
         `${order.shippingAddress.line1 || ''}${order.shippingAddress.line2 ? ', ' + order.shippingAddress.line2 : ''}, ${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''} ${order.shippingAddress.postal_code || ''}, ${order.shippingAddress.country || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '')) : 
        null,
      
      // Payment information
      paymentMethod: order.paymentDetails?.paymentMethod === 'card' ? 'Credit/Debit Card' : 
        order.paymentDetails?.paymentMethod || 'Card Payment',
      paymentDate: order.paymentDetails?.createdOn ? 
        new Date(order.paymentDetails.createdOn).toLocaleDateString() : 
        new Date(order.createdOn).toLocaleDateString(),
      transactionId: order.paymentDetails?.stripeSessionId || null,
      
      // Products information
      products: (order.subOrders || []).map((product, index) => ({
        title: product.productDetails?.title || product.productDetails?.name || `Product ${index + 1}`,
        description: product.productDetails?.description || '',
        category: product.productDetails?.category || '',
        material: product.productDetails?.material || '',
        type: product.type || 'jewelry',
        quantity: product.quantity || 1,
        price: product.priceAtTime || 0,
        formattedPrice: '$' + (product.priceAtTime || 0).toFixed(2),
        total: (product.priceAtTime || 0) * (product.quantity || 1),
        formattedTotal: '$' + ((product.priceAtTime || 0) * (product.quantity || 1)).toFixed(2),
        images: product.imageUrl ? [product.imageUrl] : (product.productDetails?.images || [])
      })),
      
      // Totals
      subtotal: '$' + (order.subtotal || order.total || 0).toFixed(2),
      discount: order.discount ? '$' + order.discount.toFixed(2) : null,
      couponCode: order.couponCode || null,
      tax: order.tax ? '$' + order.tax.toFixed(2) : null,
      shipping: order.shipping ? '$' + order.shipping.toFixed(2) : null,
      total: '$' + (order.total || 0).toFixed(2),
      
      // Company information
      currentYear: new Date().getFullYear()
    };
    
    // Generate HTML
    const html = template(invoiceData);
    
    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set content and wait for network idle (for external images)
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdf = await page.pdf({
      path: filepath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });
    
    await browser.close();
    
    console.log(`✅ Invoice PDF generated: ${filepath}`);
    return filepath;
    
  } catch (error) {
    console.error('❌ Error generating invoice PDF:', error);
    throw error;
  }
}

module.exports = {
  generateInvoiceFromHTML,
  generateInvoiceToAzure
};
