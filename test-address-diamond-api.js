require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');

// Create models
const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
const Product = mongoose.models.productModel || mongoose.model('productModel', new mongoose.Schema(Schema.product), 'products');

/**
 * Normalize images from different storage formats
 */
function normalizeImages(imgs) {
  if (!imgs) return [];
  if (Array.isArray(imgs)) {
    return imgs.filter(i => typeof i === 'string' && (i.startsWith('http') || i.startsWith('/')));
  }
  if (typeof imgs === 'object') {
    const out = [];
    Object.values(imgs).forEach(v => {
      if (Array.isArray(v)) v.forEach(u => { if (typeof u === 'string') out.push(u); });
      else if (typeof v === 'string') out.push(v);
    });
    return out.filter(i => typeof i === 'string' && (i.startsWith('http') || i.startsWith('/')));
  }
  if (typeof imgs === 'string') return [imgs];
  return [];
}

/**
 * Detect if diamond is Natural or Lab-grown
 */
function detectDiamondType(selectedVariant, product, price) {
  if (!selectedVariant) return 'Not Specified';
  
  if (selectedVariant.diamondType) {
    const dType = selectedVariant.diamondType.toLowerCase();
    if (dType.includes('natural') || dType.includes('dr')) return 'Natural (DR)';
    if (dType.includes('lab') || dType.includes('lc') || dType.includes('lab grown')) return 'Lab Grown (LC)';
  }
  
  if (selectedVariant.priceNatural && selectedVariant.priceLab) {
    if (Math.abs(price - selectedVariant.priceLab) < Math.abs(price - selectedVariant.priceNatural)) {
      return 'Lab Grown (LC)';
    }
    return 'Natural (DR)';
  }
  
  if (product?.productDetails?.selectedVariant) {
    const sv = product.productDetails.selectedVariant;
    if (sv.diamondType) {
      const dType = sv.diamondType.toLowerCase();
      if (dType.includes('natural') || dType.includes('dr')) return 'Natural (DR)';
      if (dType.includes('lab') || dType.includes('lc')) return 'Lab Grown (LC)';
    }
  }
  
  return 'Not Specified';
}

/**
 * Enrich product data
 */
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

  const diamondTypeDetected = detectDiamondType(
    existingDetails.selectedVariant || prodDoc?.selectedVariant,
    product,
    price
  );

  const baseDiamondDetails = existingDetails.diamondDetails || {
    shape: prodDoc?.shape || '-',
    diamondType: prodDoc?.diamondType || '-',
    cut: prodDoc?.cut || '-',
    clarity: prodDoc?.clarity || '-',
    caratSize: prodDoc?.caratSize || '-',
    color: prodDoc?.color || '-',
    priceWithMargin: prodDoc?.priceWithMargin || '-'
  };

  return {
    title: existingDetails.title || existingDetails.name || prodDoc?.title || prodDoc?.name || `Product ${index + 1}`,
    category: existingDetails.category || prodDoc?.category || '',
    metalType: existingDetails.metalType || prodDoc?.metalType || '-',
    ringSize: existingDetails.ringSize || prodDoc?.ringSize || '-',
    packagingType: existingDetails.packagingType || prodDoc?.packagingType || '-',
    estimatedDeliveryDays: existingDetails.estimatedDeliveryDays || prodDoc?.estimatedDeliveryDays || 5,
    diamondDetails: {
      ...baseDiamondDetails,
      actualType: diamondTypeDetected
    }
  };
}

(async () => {
  try {
    const dbUri = process.env.DATABASE_URI;
    await mongoose.connect(dbUri);

    console.log('\n🔍 Testing Address and Diamond Details in API Response\n');

    // Get order with payment details
    const order = await Order.findOne({ paymentStatus: 'paid' }).lean();

    if (!order) {
      console.log('❌ No paid order found');
      await mongoose.disconnect();
      return;
    }

    console.log('✅ Test 1: Shipping Address');
    if (order.shippingAddress) {
      console.log(`   ✓ Has shipping address`);
      console.log(`   - Name: ${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`);
      console.log(`   - Address: ${order.shippingAddress.address1}`);
      console.log(`   - City: ${order.shippingAddress.city}, ${order.shippingAddress.state}`);
      console.log(`   - Country: ${order.shippingAddress.country}`);
      console.log(`   - Phone: ${order.shippingAddress.phone}`);
    } else {
      console.log(`   ✗ NO shipping address found`);
    }

    console.log('\n✅ Test 2: Billing Address');
    if (order.billingAddress) {
      console.log(`   ✓ Has billing address`);
      console.log(`   - Name: ${order.billingAddress.firstName} ${order.billingAddress.lastName}`);
      console.log(`   - Address: ${order.billingAddress.address1}`);
      console.log(`   - City: ${order.billingAddress.city}, ${order.billingAddress.state}`);
      console.log(`   - Country: ${order.billingAddress.country}`);
      console.log(`   - Phone: ${order.billingAddress.phone}`);
    } else {
      console.log(`   ✗ NO billing address found`);
    }

    console.log('\n✅ Test 3: Product Diamond Details');
    if (order.products && order.products.length > 0) {
      const product = order.products[0];
      const enriched = await enrichProductData(product, 0);
      console.log(`   Product: ${enriched.title}`);
      console.log(`   Metal Type: ${enriched.metalType}`);
      console.log(`   Ring Size: ${enriched.ringSize}`);
      console.log(`   Packaging: ${enriched.packagingType}`);
      console.log(`   Est. Delivery Days: ${enriched.estimatedDeliveryDays}`);
      console.log(`   Diamond Info:`);
      console.log(`     - Shape: ${enriched.diamondDetails.shape}`);
      console.log(`     - Type (Natural/Lab): ${enriched.diamondDetails.actualType}`);
      console.log(`     - Available Types: ${enriched.diamondDetails.diamondType}`);
      console.log(`     - Cut: ${enriched.diamondDetails.cut}`);
      console.log(`     - Clarity: ${enriched.diamondDetails.clarity}`);
      console.log(`     - Carat Size: ${enriched.diamondDetails.caratSize}`);
      console.log(`     - Color: ${enriched.diamondDetails.color}`);
    } else {
      console.log(`   ✗ No products found`);
    }

    console.log('\n✅ Test 4: Sub-Order Diamond Details');
    if (order.subOrders && order.subOrders.length > 0) {
      const subOrder = order.subOrders[0];
      const enriched = await enrichProductData(subOrder, 0);
      console.log(`   SubOrder Product: ${enriched.title}`);
      console.log(`   Diamond Type (Natural/Lab): ${enriched.diamondDetails.actualType}`);
    } else {
      console.log(`   ✗ No sub-orders found`);
    }

    console.log('\n🎉 API Response Structure Verification Complete\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
})();
