require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');

// Simulate the API response by running enrichProductData locally
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
const Product = mongoose.models.productModel || mongoose.model('productModel', new mongoose.Schema(Schema.product), 'products');

// Helper functions from customerOrderAPI.js
const normalizeImages = (images) => {
  if (Array.isArray(images)) return images.filter(img => typeof img === 'string');
  if (typeof images === 'string') return [images];
  return [];
};

const formatCurrency = (amount, currency = 'USD') => {
  return `$${Number(amount || 0).toFixed(2)}`;
};

async function enrichProductData(product, index) {
  let prodDoc = product.productId && typeof product.productId === 'object' ? product.productId : null;
  const existingDetails = product.productDetails || {};

  if (!prodDoc && product.productId) {
    try {
      prodDoc = await Jewelry.findById(product.productId).lean();
      if (!prodDoc) {
        prodDoc = await Product.findById(product.productId).lean();
      }
    } catch (e) {
      console.warn('Failed to fetch product:', e.message);
    }
  }

  let images = [];
  if (product.imageUrl) {
    images = [product.imageUrl];
  } else if (existingDetails.images && existingDetails.images.length) {
    images = normalizeImages(existingDetails.images);
  } else if (prodDoc) {
    images = normalizeImages(prodDoc.images || prodDoc.imageUrl || existingDetails.images || existingDetails.imageUrl);
  }

  const price = product.priceAtTime || existingDetails.price || prodDoc?.price || 0;
  const quantity = product.quantity || 1;

  return {
    id: prodDoc?._id || product.productId || `product-${index}`,
    title: existingDetails.title || existingDetails.name || prodDoc?.title || prodDoc?.name || `Product ${index + 1}`,
    description: existingDetails.description || prodDoc?.description || '',
    category: existingDetails.category || prodDoc?.category || '',
    material: existingDetails.material || prodDoc?.material || '',
    quantity: quantity,
    price: price,
    formattedPrice: formatCurrency(price),
    total: price * quantity,
    formattedTotal: formatCurrency(price * quantity),
    images: images,
    primaryImage: images.length > 0 ? images[0] : null,
    type: product.type || 'jewelry',
    engraving: product.engravingDetails?.hasEngraving ? {
      text: product.engravingDetails.engravingText,
      type: product.engravingDetails.engravingType,
      location: product.engravingDetails.engravingLocation,
      cost: product.engravingDetails.engravingCost || 0,
      status: product.engravingDetails.engravingStatus
    } : null,
    selectedMetal: existingDetails.selectedMetal || prodDoc?.selectedMetal,
    selectedVariation: existingDetails.selectedVariation || prodDoc?.selectedVariation,
    cadCode: existingDetails.cadCode || prodDoc?.cadCode,
    // NEW FIELDS
    metalType: existingDetails.metalType || prodDoc?.metalType || '-',
    ringSize: existingDetails.ringSize || prodDoc?.ringSize || '-',
    packagingType: existingDetails.packagingType || prodDoc?.packagingType || '-',
    estimatedDeliveryDays: existingDetails.estimatedDeliveryDays || prodDoc?.estimatedDeliveryDays || 5,
    diamondDetails: existingDetails.diamondDetails || {
      shape: prodDoc?.shape || '-',
      diamondType: prodDoc?.diamondType || '-',
      cut: prodDoc?.cut || '-',
      clarity: prodDoc?.clarity || '-',
      caratSize: prodDoc?.caratSize || '-',
      color: prodDoc?.color || '-',
      priceWithMargin: prodDoc?.priceWithMargin || '-'
    }
  };
}

(async () => {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    const dbUri = process.env.DATABASE_URI;
    await mongoose.connect(dbUri);
    console.log('✅ Connected\n');
    
    const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');
    
    // Fetch the order
    const order = await Order.findOne({ orderId: '1e6075d0-2c2b-11f1-8f28-dd126dd8a653' }).lean();
    
    if (!order) {
      console.log('❌ Order not found');
      await mongoose.disconnect();
      return;
    }
    
    console.log('✅ Order Found\n');
    console.log('═════════════════════════════════════════════════════');
    console.log('\n📌 ROOT LEVEL FIELDS:');
    console.log(`  estimatedDeliveryDays: ${order.estimatedDeliveryDays} days`);
    console.log(`  expectedDeliveryDate: ${new Date(order.expectedDeliveryDate).toLocaleDateString()}`);
    console.log(`  status: ${order.status}`);
    console.log(`  paymentStatus: ${order.paymentStatus}`);
    
    // Enrich products
    const enrichedProducts = await Promise.all(
      (order.products || []).map((product, index) => enrichProductData(product, index))
    );
    
    if (enrichedProducts && enrichedProducts[0]) {
      console.log('\n💍 PRODUCT DATA (after enrichment):');
      const product = enrichedProducts[0];
      
      console.log(`  title: ${product.title}`);
      console.log(`  price: $${product.price}`);
      console.log(`  category: ${product.category}`);
      console.log(`  cadCode: ${product.cadCode}`);
      console.log(`  metalType: ${product.metalType}`);
      console.log(`  ringSize: ${product.ringSize}`);
      console.log(`  packagingType: ${product.packagingType}`);
      console.log(`  estimatedDeliveryDays: ${product.estimatedDeliveryDays}`);
      
      if (product.diamondDetails) {
        console.log(`\n  💎 diamondDetails:`);
        console.log(`    shape: ${product.diamondDetails.shape}`);
        console.log(`    diamondType: ${product.diamondDetails.diamondType}`);
        console.log(`    cut: ${product.diamondDetails.cut}`);
        console.log(`    clarity: ${product.diamondDetails.clarity}`);
        console.log(`    caratSize: ${product.diamondDetails.caratSize}`);
        console.log(`    color: ${product.diamondDetails.color}`);
      }
      
      if (product.engraving) {
        console.log(`\n  ✏️  Engraving:`);
        console.log(`    text: "${product.engraving.text}"`);
        console.log(`    status: ${product.engraving.status}`);
      }
    }
    
    console.log('\n═════════════════════════════════════════════════════\n');
    
    // Verification
    const checks = {
      'Root estimatedDeliveryDays present': !!order.estimatedDeliveryDays,
      'Root estimatedDeliveryDays > 5': order.estimatedDeliveryDays > 5,
      'Root expectedDeliveryDate': !!order.expectedDeliveryDate,
      'Product metalType present': enrichedProducts[0]?.metalType !== undefined,
      'Product ringSize present': enrichedProducts[0]?.ringSize !== undefined,
      'Product packagingType present': enrichedProducts[0]?.packagingType !== undefined,
      'Product estimatedDeliveryDays': enrichedProducts[0]?.estimatedDeliveryDays,
      'Product diamondDetails present': !!enrichedProducts[0]?.diamondDetails,
      'Diamond diamondType value': enrichedProducts[0]?.diamondDetails?.diamondType
    };
    
    let passCount = 0;
    for (const [check, passed] of Object.entries(checks)) {
      if (passed) {
        console.log(`  ✅ ${check}`);
        passCount++;
      } else {
        console.log(`  ❌ ${check}`);
      }
    }
    
    console.log(`\n✨ ${passCount}/${Object.keys(checks).length} checks passed\n`);
    
    if (passCount === Object.keys(checks).length) {
      console.log('🎉 API Response includes all new fields!\n');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
