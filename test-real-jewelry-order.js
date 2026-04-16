require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');
const { v1: uuid } = require('uuid');

// Get models
const User = mongoose.models.userModel || mongoose.model('userModel', new mongoose.Schema(Schema.signup), 'users');
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', new mongoose.Schema(Schema.cart), 'carts');
const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');

// Helper functions
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

function detectDiamondType(selectedVariant, product, price) {
  if (!selectedVariant) return 'Not Specified';
  if (selectedVariant.diamondType) {
    const dType = selectedVariant.diamondType.toLowerCase();
    if (dType.includes('natural') || dType.includes('dr')) return 'Natural (DR)';
    if (dType.includes('lab') || dType.includes('lc')) return 'Lab Grown (LC)';
  }
  if (selectedVariant.priceNatural && selectedVariant.priceLab) {
    if (Math.abs(price - selectedVariant.priceLab) < Math.abs(price - selectedVariant.priceNatural)) {
      return 'Lab Grown (LC)';
    }
    return 'Natural (DR)';
  }
  return 'Not Specified';
}

async function enrichProductData(product) {
  let prodDoc = product.productId && typeof product.productId === 'object' ? product.productId : null;
  const existingDetails = product.productDetails || {};

  if (!prodDoc && product.productId) {
    try {
      prodDoc = await Jewelry.findById(product.productId).lean();
    } catch (e) { }
  }

  let images = [];
  if (product.imageUrl) {
    images = [product.imageUrl];
  } else if (existingDetails.images?.length) {
    images = normalizeImages(existingDetails.images);
  } else if (prodDoc) {
    images = normalizeImages(prodDoc.images || prodDoc.imageUrl || existingDetails.images);
  }

  const price = product.priceAtTime || existingDetails.price || prodDoc?.price || 0;
  const diamondTypeDetected = detectDiamondType(
    existingDetails.selectedVariant || prodDoc?.selectedVariant,
    product,
    price
  );

  return {
    title: existingDetails.title || prodDoc?.title || `Product`,
    metalType: existingDetails.metalType || prodDoc?.metalType || '-',
    ringSize: existingDetails.ringSize || prodDoc?.ringSize || '-',
    packagingType: existingDetails.packagingType || prodDoc?.packagingType || '-',
    estimatedDeliveryDays: existingDetails.estimatedDeliveryDays || 14,
    price: price,
    images: images,
    diamondDetails: {
      ...(existingDetails.diamondDetails || {}),
      actualType: diamondTypeDetected
    }
  };
}

(async () => {
  try {
    const dbUri = process.env.DATABASE_URI;
    await mongoose.connect(dbUri);

    console.log('\n🎀 CREATE NEW ORDER WITH ACTUAL JEWELRY DATA\n');

    // 1. Create user
    const email = `testuser-${Date.now()}@test.com`;
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, name: 'Test User', password: 'test123' });
      console.log(`✅ User created: ${email}`);
    } else {
      console.log(`✅ User found: ${email}`);
    }

    // 2. Get real jewelry products
    const jewelries = await Jewelry.find({
      diamondType: { $exists: true, $ne: '' }
    }).limit(2).lean();

    if (jewelries.length < 2) {
      console.log('❌ Not enough jewelry products found');
      await mongoose.disconnect();
      return;
    }

    console.log(`\n✅ Using ${jewelries.length} products:`);
    jewelries.forEach(j => console.log(`   - ${j.title} (${j.cadCode})`));

    // 3. Create cart
    const cart = await Cart.create({
      customerId: user._id,
      itemsInCart: jewelries.map((j, idx) => ({
        productId: j._id,
        quantity: 1,
        selectedVariant: {
          metal: idx === 0 ? '14K' : '18K',
          diamondType: idx === 0 ? 'Natural (DR)' : 'Lab Grown (LC)',
          priceNatural: j.pricing?.metalPricing?.[0]?.finalPrice?.natural || 500,
          priceLab: j.pricing?.metalPricing?.[0]?.finalPrice?.lab || 400
        }
      }))
    });
    console.log(`\n✅ Cart created with ${cart.itemsInCart.length} items`);

    // 4. Create order from cart
    const orderId = uuid();
    const order = await Order.create({
      orderId,
      referenceId: uuid(),
      customer: user._id,
      products: jewelries.map((j, idx) => ({
        productId: j._id,
        quantity: 1,
        type: 'Premade',
        priceAtTime: j.pricing?.metalPricing?.[0]?.finalPrice?.natural || 500,
        imageUrl: normalizeImages(j.images)?.[0] || null,
        productDetails: {
          title: j.title,
          name: j.title,
          category: j.category || 'Jewelry',
          cadCode: j.cadCode,
          metalType: idx === 0 ? '14K Gold' : '18K Gold',
          ringSize: j.ringSize || '-',
          packagingType: 'Premium Box',
          estimatedDeliveryDays: 14,
          selectedVariant: {
            metal: idx === 0 ? '14K' : '18K',
            diamondType: idx === 0 ? 'Natural (DR)' : 'Lab Grown (LC)',
            priceNatural: j.pricing?.metalPricing?.[0]?.finalPrice?.natural || 500,
            priceLab: j.pricing?.metalPricing?.[0]?.finalPrice?.lab || 400
          },
          diamondDetails: {
            shape: 'Round',
            diamondType: j.diamondType || 'Both',
            cut: 'Excellent',
            clarity: 'VS1',
            caratSize: '1.0',
            color: 'D',
            priceWithMargin: 2000
          },
          images: normalizeImages(j.images) || []
        }
      })),
      subOrders: jewelries.map((j, idx) => ({
        subOrderId: uuid(),
        productId: j._id,
        quantity: 1,
        type: 'Premade',
        priceAtTime: j.pricing?.metalPricing?.[0]?.finalPrice?.natural || 500,
        imageUrl: normalizeImages(j.images)?.[0] || null,
        status: 'Pending',
        productDetails: {
          title: j.title,
          name: j.title,
          category: j.category || 'Jewelry',
          cadCode: j.cadCode,
          metalType: idx === 0 ? '14K Gold' : '18K Gold',
          ringSize: j.ringSize || '-',
          packagingType: 'Premium Box',
          estimatedDeliveryDays: 14,
          selectedVariant: {
            metal: idx === 0 ? '14K' : '18K',
            diamondType: idx === 0 ? 'Natural (DR)' : 'Lab Grown (LC)',
            priceNatural: j.pricing?.metalPricing?.[0]?.finalPrice?.natural || 500,
            priceLab: j.pricing?.metalPricing?.[0]?.finalPrice?.lab || 400
          },
          diamondDetails: {
            shape: 'Round',
            diamondType: j.diamondType || 'Both',
            cut: 'Excellent',
            clarity: 'VS1',
            caratSize: '1.0',
            color: 'D',
            priceWithMargin: 2000
          },
          images: normalizeImages(j.images) || []
        }
      })),
      shippingAddress: {
        firstName: 'Test',
        lastName: 'Customer',
        address1: '123 Diamond Street',
        address2: 'Suite 456',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA',
        email: email,
        phone: '+1234567890'
      },
      billingAddress: {
        firstName: 'Test',
        lastName: 'Customer',
        address1: '123 Diamond Street',
        address2: 'Suite 456',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA',
        email: email,
        phone: '+1234567890'
      },
      total: jewelry?.pricing?.metalPricing?.[0]?.finalPrice?.natural * 2 || 1000,
      subtotal: jewelry?.pricing?.metalPricing?.[0]?.finalPrice?.natural * 2 || 1000,
      paymentStatus: 'paid',
      status: 'Pending',
      paymentDetails: {
        cardLast4: '4242',
        cardBrand: 'visa',
        paymentStatus: 'succeeded'
      },
      expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      estimatedDeliveryDays: 14,
      createdBy: user._id,
      updatedBy: user._id
    });

    console.log(`\n✅ Order created: ${orderId}`);

    // 5. Enrich and display products
    console.log('\n📦 PRODUCTS WITH ACTUAL DATA:\n');
    for (let i = 0; i < order.products.length; i++) {
      const enriched = await enrichProductData(order.products[i]);
      console.log(`Product ${i + 1}: ${enriched.title}`);
      console.log(`  Metal Type: ${enriched.metalType}`);
      console.log(`  Packaging: ${enriched.packagingType}`);
      console.log(`  Est. Delivery: ${enriched.estimatedDeliveryDays} days`);
      console.log(`  Diamond Available: ${enriched.diamondDetails.diamondType}`);
      console.log(`  Your Selection: ${enriched.diamondDetails.actualType}`);
      console.log(`  Diamond Details:`);
      console.log(`    - Shape: ${enriched.diamondDetails.shape}`);
      console.log(`    - Cut: ${enriched.diamondDetails.cut}`);
      console.log(`    - Clarity: ${enriched.diamondDetails.clarity}`);
      console.log(`    - Carat: ${enriched.diamondDetails.caratSize}`);
      console.log(`    - Color: ${enriched.diamondDetails.color}`);
      console.log(`  Price: $${enriched.price}\n`);
    }

    // 6. Display shipping info
    console.log('📍 SHIPPING ADDRESS:\n');
    console.log(`${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`);
    console.log(`${order.shippingAddress.address1}, ${order.shippingAddress.address2}`);
    console.log(`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`);
    console.log(`${order.shippingAddress.country}`);
    console.log(`Phone: ${order.shippingAddress.phone}\n`);

    console.log('💳 PAYMENT:\n');
    console.log(`Status: ${order.paymentStatus}`);
    console.log(`Card: ${order.paymentDetails.cardBrand.toUpperCase()} ending in ${order.paymentDetails.cardLast4}`);
    console.log(`Total: $${order.total}`);
    console.log(`Expected Delivery: ${new Date(order.expectedDeliveryDate).toLocaleDateString()}`);

    console.log('\n✅ Test Complete! Check order in database.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
})();
