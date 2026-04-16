const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/celora')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const Exchangerate = mongoose.model('exchangerate', new mongoose.Schema({
      country: String,
      currencyCode: String,
      rate: Number,
      symbol: String,
      isActive: Boolean
    }));
    
    const result = await Exchangerate.updateOne(
      { currencyCode: 'USD' },
      { $set: { rate: 1.0 } }
    );
    
    console.log('✅ USD rate updated:', result);
    
    const usd = await Exchangerate.findOne({ currencyCode: 'USD' });
    console.log('Updated USD record:', usd);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
