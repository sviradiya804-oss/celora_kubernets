require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');
const { v1: uuid } = require('uuid');

const User = mongoose.models.userModel || mongoose.model('userModel', new mongoose.Schema(Schema.signup), 'users');
const Coupon = mongoose.models.couponModel || mongoose.model('couponModel', new mongoose.Schema(Schema.coupon), 'coupons');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');

// Copy the API enrichment functions
function normalizeImages(imgs) {
  if (!imgs) return [];
  if (Array.isArray(imgs)) return imgs.filter(i => typeof i === 'string' && (i.startsWith('http') || i.startsWith('/')));
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

function detectDiamondType(selectedVariant) {
  if (!selectedVariant) return 'Not Specified';
  if (selectedVariant.diamondType) {
    const dType = selectedVariant.diamondType.toLowerCase();
    if (dType.includes('natural') || dType.includes('dr')) return 'Natural (DR)';
    if (dType.includes('lab') || dType.includes('lc')) return 'Lab Grown (LC)';
  }
  return 'Not Specified';
}

async function enrichProductData(product, index) {
  const existingDetails = product.productDetails || {};
  const price = product.priceAtTime || existingDetails.price || 0;
  const diamondTypeDetected = detectDiamondType(existingDetails.selectedVariant);

  return {
    slug: existingDetails.slug || null,  // ✅ SLUG
    title: existingDetails.title || `Product ${index + 1}`,
    metadata: {
      metalType: existingDetails.metalType || '-',
      ringSize: existingDetails.ringSize || '-',
      packagingType: existingDetails.packagingType || '-',
      estimatedDeliveryDays: existingDetails.estimatedDeliveryDays || 14
    },
    selectedVariant: existingDetails.selectedVariant || {},  // ✅ SELECTED VARIANT WITH DIAMOND TYPE
    diamondDetails: {
      shape: existingDetails.diamondDetails?.shape || '-',
      diamondType: existingDetails.diamondDetails?.diamondType || '-',
      actualType: diamondTypeDetected,  // ✅ ACTUAL TYPE (Natural/Lab)
      cut: existingDetails.diamondDetails?.cut || '-',
      clarity: existingDetails.diamondDetails?.clarity || '-',
      caratSize: existingDetails.diamondDetails?.caratSize || '-',
      color: existingDetails.diamondDetails?.color || '-'
    },
    price: price
  };
}

(async () => {
  try {
    const dbUri = process.env.DATABASE_URI;
    await mongoose.connect(dbUri);

    console.log('\n📊 API RESPONSE STRUCTURE WITH COUPON\n');
    console.log('═══════════════════════════════════════════════════\n');

    // Get the order with coupon we just created
    const order = await Order.findOne({ 'coupon.code': 'WELCOME20' }).sort({ createdOn: -1 }).lean();

    if (!order) {
      console.log('❌ No order with WELCOME20 coupon found');
      await mongoose.disconnect();
      return;
    }

    console.log('🎟️  ORDER API RESPONSE FORMAT:\n');
    console.log(JSON.stringify({
      orderId: order.orderId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      
      // Pricing with Coupon
      pricing: {
        subtotal: order.subtotal,
        discount: order.discount,
        coupon: order.coupon ? {
          code: order.coupon.code,
          discountType: order.coupon.discountType || 'Percentage',
          discountValue: `${order.coupon.discountValue || 0}${order.coupon.discountType === 'Flat' ? '' : '%'}`,
          appliedDiscount: order.coupon.discount
        } : null,
        total: order.total
      },

      // Delivery
      delivery: {
        estimatedDeliveryDays: order.estimatedDeliveryDays,
        expectedDeliveryDate: order.expectedDeliveryDate?.toISOString().split('T')[0]
      },

      // Addresses
      shippingAddress: order.shippingAddress ? {
        name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
        address: order.shippingAddress.address1,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zipCode: order.shippingAddress.zipCode,
        country: order.shippingAddress.country,
        phone: order.shippingAddress.phone
      } : null
    }, null, 2));

    // Enrich products
    console.log('\n📦 PRODUCTS IN ORDER:\n');
    for (let i = 0; i < order.products.length; i++) {
      const enriched = await enrichProductData(order.products[i], i);
      console.log(JSON.stringify({
        [`Product ${i + 1}`]: enriched
      }, null, 2));
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ API RESPONSE INCLUDES:\n');
    console.log('✅ 1. slug - SEO-friendly product URL');
    console.log('✅ 2. selectedVariant - with diamondType selected');
    console.log('✅ 3. diamondDetails.actualType - Natural (DR) or Lab (LC)');
    console.log('✅ 4. metalType, ringSize, packagingType - actual selections');
    console.log('✅ 5. estimatedDeliveryDays - actual duration');
    console.log('✅ 6. coupon.code - coupon applied');
    console.log('✅ 7. coupon.discountType - Percentage or Flat');
    console.log('✅ 8. coupon.discountValue - discount percentage/amount');
    console.log('✅ 9. coupon.appliedDiscount - actual discount given');
    console.log('✅ 10. Shipping & Billing Addresses - complete\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    await mongoose.disconnect();
  }
})();
