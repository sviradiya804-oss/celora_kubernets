const fs = require('fs');
const PDFDocument = require('pdfkit');
const path = require('path');

const generateInvoice = (order, filepath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);

    // === WATERMARK IMAGE (logo as watermark) ===
    const watermarkPath = path.join(__dirname, '../templates/logo/Logo-01.png');
    if (fs.existsSync(watermarkPath)) {
      doc.opacity(0.1);
      doc.image(watermarkPath, 100, 200, {
        width: 400,
        align: 'center'
      });
      doc.opacity(1);
    }

    // === HEADER ===
    const logoPath = watermarkPath; // reuse same image as top-left logo
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 100 });
    }

    doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 450, 50, { align: 'right' });

    doc.moveDown(2);
    doc.fontSize(12);
    doc.text(`Invoice Date: ${new Date().toDateString()}`);
    doc.text(`Invoice ID: ${order.orderId}`);
    doc.moveDown();

    // === CUSTOMER INFO ===
    doc.font('Helvetica-Bold').text('Customer Information:', { underline: true });
    doc.font('Helvetica');
    doc.text(`Name: ${order.customerData?.name || order.customer?.name || 'Valued Customer'}`);
    doc.text(`Email: ${order.customerData?.email || order.customer?.email || 'N/A'}`);
    doc.moveDown();

    // === ITEM TABLE HEADER ===
    doc.font('Helvetica-Bold').text('Item', 50);
    doc.text('Qty', 300);
    doc.text('Price', 370);
    doc.text('Total', 440);
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
    doc.moveDown();

    // === ITEMS ===
    doc.font('Helvetica');
    const products = order.subOrders || order.items || [];
    products.forEach(item => {
      const title = item.productDetails?.title || item.title || item.name || 'Product';
      const qty = item.quantity || 1;
      const price = item.priceAtTime || item.price || 0;
      const total = qty * price;

      doc.text(title, 50);
      doc.text(qty.toString(), 300);
      doc.text(`$${price.toFixed(2)}`, 370);
      doc.text(`$${total.toFixed(2)}`, 440);
      doc.moveDown();
    });

    // === TOTALS ===
    doc.moveDown();
    const subtotal = order.subtotal || order.total || 0;
    const discount = order.discount || 0;
    const finalTotal = order.total || subtotal - discount;

    if (discount > 0) {
      doc.text(`Subtotal: $${subtotal.toFixed(2)}`, 400);
      doc.text(`Discount: -$${discount.toFixed(2)}`, 400);
    }

    doc.font('Helvetica-Bold').text(`Total: $${finalTotal.toFixed(2)}`, 400);
    doc.moveDown(2);

    // === FOOTER ===
    doc.fontSize(10).font('Helvetica')
      .text('Thank you for choosing Celora Jewelry!', { align: 'center' })
      .text('Visit us at www.celorajewelry.com', { align: 'center' })
      .text('Follow us: @celorajewelry on Instagram & Facebook', { align: 'center' });

    doc.end();

    writeStream.on('finish', () => {
      resolve(filepath);
    });

    writeStream.on('error', reject);
  });
};

module.exports = generateInvoice;
