const generateInvoice = require('./src/utils/generateInvoice'); // adjust path as needed
const path = require('path');

const sampleOrder = {
  orderId: 'TEST12345',
  customerData: {
    name: 'John Doe',
    email: 'john@example.com'
  },
  products: [
    {
      title: 'Diamond Ring',
      price: 500,
      quantity: 1
    },
    {
      title: 'Gold Necklace',
      price: 750,
      quantity: 2
    }
  ],
  subtotal: 2000,
  discount: 250,
  total: 1750
};

const filepath = path.join(__dirname, 'preview_invoice.pdf');

generateInvoice(sampleOrder, filepath)
  .then(file => {
    console.log(`✅ Invoice generated at: ${file}`);
  })
  .catch(err => {
    console.error('❌ Error generating invoice:', err);
  });
