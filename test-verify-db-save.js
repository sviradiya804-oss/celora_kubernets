require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');
const { v1: uuid } = require('uuid');

const User = mongoose.models.userModel || mongoose.model('userModel', new mongoose.Schema(Schema.signup), 'users');
const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');

function normalizeImages(imgs) {
  if (!imgs) return [];
  if (Array.isArray(imgs)) return imgs.filter(i => typeof i === 'string');
  if (typeof imgs === 'object') {
    const out = [];
    Object.values(imgs).forEach(v => {
      if (Array.isArray(v)) v.forEach(u => { if (typeof u === 'string') out.push(u); });
      else if (typeof v === 'string') out.push(v);
    });
    return out;
  }
  if (typeof imgs === 'string') return [imgs];
  return [];
}

(async () => {
  try {
    const dbUri = process.env.DATABASE_URI;
    await mongoose.connect(dbUri);

    console.log('\n🧪 TEST: CREATE ORDER AND VERIFY DATA IN DATABASE\n');

    // Step 1: Create user
    const email = `test-verify-${Date.now()}@test.com`;
    const user = await User.create({ email, name: 'Test User', password: 'test123' });
    console.log(`✅ Step 1: User created: ${email}`);

    // Step 2: Get real jewelry
    const jewelries = await Jewelry.find({
      diamondType: { $exists: true, $ne: '' }
    }).limit(2).lean();

    if (jewelries.length < 2) {
      console.log('❌ Not enough jewelry found');
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Step 2: Found ${jewelries.length} jewelry products`);

    // Step 3: Create order with REAL data
    const orderId = uuid();
    const order = await Order.create({
      orderId,
      referenceId: uuid(),
      customer: user._id,
      products: jewelries.map((j, idx) => ({
        productId: j._id,
        quantity: 1,
        type: 'Premade',
        priceAtTime: 1200 + (idx * 300),
        imageUrl: normalizeImages(j.images)?.[0] || null,
        productDetails: {
          title: j.title,
          name: j.title,
          category: typeof j.category === 'object' ? j.category?.name || 'Jewelry' : (j.category || 'Jewelry'),
          cadCode: j.cadCode,
          metalType: idx === 0 ? '18K Gold' : '14K Gold',           // STORE ACTUAL
          ringSize: idx === 0 ? 'Size 7' : 'Adjustable',            // STORE ACTUAL
          packagingType: 'Premium Velvet Box',                       // STORE ACTUAL
          estimatedDeliveryDays: 14,
          selectedVariant: {
            metal: idx === 0 ? '18K' : '14K',
            diamondType: idx === 0 ? 'Natural (DR)' : 'Lab Grown (LC)',
            priceNatural: 1200 + (idx * 300),
            priceLab: 1000 + (idx * 300)
          },
          diamondDetails: {
            shape: idx === 0 ? 'Round' : 'Cushion',
            diamondType: j.diamondType || 'Both',
            cut: idx === 0 ? 'Excellent' : 'Very Good',
            clarity: idx === 0 ? 'VS1' : 'SI1',
            caratSize: idx === 0 ? '1.5' : '1.0',
            color: idx === 0 ? 'D' : 'E',
            priceWithMargin: 2500 + (idx * 500)
          },
          images: normalizeImages(j.images) || []
        }
      })),
      subOrders: jewelries.map((j, idx) => ({
        subOrderId: uuid(),
        productId: j._id,
        quantity: 1,
        type: 'Premade',
        priceAtTime: 1200 + (idx * 300),
        imageUrl: normalizeImages(j.images)?.[0] || null,
        status: 'Pending',
        productDetails: {
          title: j.title,
          name: j.title,
          category: typeof j.category === 'object' ? j.category?.name || 'Jewelry' : (j.category || 'Jewelry'),
          cadCode: j.cadCode,
          metalType: idx === 0 ? '18K Gold' : '14K Gold',
          ringSize: idx === 0 ? 'Size 7' : 'Adjustable',
          packagingType: 'Premium Velvet Box',
          estimatedDeliveryDays: 14,
          selectedVariant: {
            metal: idx === 0 ? '18K' : '14K',
            diamondType: idx === 0 ? 'Natural (DR)' : 'Lab Grown (LC)',
            priceNatural: 1200 + (idx * 300),
            priceLab: 1000 + (idx * 300)
          },
          diamondDetails: {
            shape: idx === 0 ? 'Round' : 'Cushion',
            diamondType: j.diamondType || 'Both',
            cut: idx === 0 ? 'Excellent' : 'Very Good',
            clarity: idx === 0 ? 'VS1' : 'SI1',
            caratSize: idx === 0 ? '1.5' : '1.0',
            color: idx === 0 ? 'D' : 'E',
            priceWithMargin: 2500 + (idx * 500)
          },
          images: normalizeImages(j.images) || []
        }
      })),
      shippingAddress: {
        firstName: 'Test',
        lastName: 'Customer',
        address1: '123 Test Street',
        address2: 'Apt 456',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country',
        email: email,
        phone: '+1234567890'
      },
      billingAddress: {
        firstName: 'Test',
        lastName: 'Customer',
        address1: '123 Test Street',
        address2: 'Apt 456',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country',
        email: email,
        phone: '+1234567890'
      },
      total: 2700,
      subtotal: 2700,
      paymentStatus: 'paid',
      status: 'Pending',
      expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      estimatedDeliveryDays: 14,
      createdBy: user._id,
      updatedBy: user._id
    });

    console.log(`✅ Step 3: Order created in memory: ${orderId}`);

    // Step 4: VERIFY DATA WAS SAVED TO DATABASE
    console.log(`\n⏳ Step 4: Fetching order from DATABASE to verify...\n`);

    const savedOrder = await Order.findOne({ orderId }).lean();

    if (!savedOrder) {
      console.log('❌ FAIL: Order was NOT saved to database!');
      await mongoose.disconnect();
      return;
    }

    console.log('✅ SUCCESS: Order found in database!');

    // Step 5: VERIFY EACH FIELD
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📦 VERIFYING DATA IN DATABASE');
    console.log('═══════════════════════════════════════════════════\n');

    let checks = 0;
    let passed = 0;

    function check(name, actual, shouldNotBe = '-') {
      checks++;
      const pass = actual && actual !== shouldNotBe && actual !== undefined && actual !== null;
      if (pass) {
        console.log(`✅ ${name}: "${actual}"`);
        passed++;
      } else {
        console.log(`❌ ${name}: MISSING or "${actual}"`);
      }
      return pass;
    }

    console.log('🏠 ROOT LEVEL:');
    check('  orderId', savedOrder.orderId);
    check('  estimatedDeliveryDays', savedOrder.estimatedDeliveryDays);
    check('  expectedDeliveryDate', savedOrder.expectedDeliveryDate?.toISOString().split('T')[0]);
    check('  paymentStatus', savedOrder.paymentStatus);

    console.log('\n📍 ADDRESSES:');
    check('  shippingAddress.firstName', savedOrder.shippingAddress?.firstName);
    check('  shippingAddress.city', savedOrder.shippingAddress?.city);
    check('  shippingAddress.country', savedOrder.shippingAddress?.country);
    check('  shippingAddress.phone', savedOrder.shippingAddress?.phone);
    check('  billingAddress.firstName', savedOrder.billingAddress?.firstName);

    console.log('\n💻 PRODUCT 1 (Diamond Pendant):');
    const prod1 = savedOrder.products[0];
    if (prod1) {
      check('  title', prod1.productDetails?.title);
      check('  metalType', prod1.productDetails?.metalType);
      check('  ringSize', prod1.productDetails?.ringSize);
      check('  packagingType', prod1.productDetails?.packagingType);
      check('  estimatedDeliveryDays', prod1.productDetails?.estimatedDeliveryDays);
      check('  diamondDetails.shape', prod1.productDetails?.diamondDetails?.shape);
      check('  diamondDetails.cut', prod1.productDetails?.diamondDetails?.cut);
      check('  diamondDetails.clarity', prod1.productDetails?.diamondDetails?.clarity);
      check('  diamondDetails.caratSize', prod1.productDetails?.diamondDetails?.caratSize);
      check('  diamondDetails.color', prod1.productDetails?.diamondDetails?.color);
      check('  selectedVariant.diamondType', prod1.productDetails?.selectedVariant?.diamondType);
    }

    console.log('\n💻 PRODUCT 2 (Diamond Bracelet):');
    const prod2 = savedOrder.products[1];
    if (prod2) {
      check('  title', prod2.productDetails?.title);
      check('  metalType', prod2.productDetails?.metalType);
      check('  ringSize', prod2.productDetails?.ringSize);
      check('  diamondDetails.shape', prod2.productDetails?.diamondDetails?.shape);
    }

    console.log('\n📦 SUBORDER 1:');
    const sub1 = savedOrder.subOrders?.[0];
    if (sub1) {
      check('  subOrderId', sub1.subOrderId);
      check('  status', sub1.status);
      check('  metalType', sub1.productDetails?.metalType);
      check('  diamondDetails.cut', sub1.productDetails?.diamondDetails?.cut);
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`\n📊 RESULTS: ${passed}/${checks} checks passed\n`);
    
    if (passed === checks) {
      console.log('🎉 ✅ ALL DATA VERIFIED IN DATABASE!');
      console.log('✅ Ready to push to production!\n');
    } else {
      console.log(`⚠️  ${checks - passed} fields missing or invalid\n`);
    }

    // Step 6: Show what API will return
    console.log('═══════════════════════════════════════════════════');
    console.log('🔄 API ENRICHED RESPONSE (What frontend receives)');
    console.log('═══════════════════════════════════════════════════\n');

    function detectDiamondType(selectedVariant) {
      if (!selectedVariant) return 'Not Specified';
      if (selectedVariant.diamondType) {
        const dType = selectedVariant.diamondType.toLowerCase();
        if (dType.includes('natural') || dType.includes('dr')) return 'Natural (DR)';
        if (dType.includes('lab') || dType.includes('lc')) return 'Lab Grown (LC)';
      }
      return 'Not Specified';
    }

    console.log(`Order ${savedOrder.orderId}`);
    console.log(`Status: ${savedOrder.status} | Payment: ${savedOrder.paymentStatus}`);
    console.log(`Est. Delivery: ${savedOrder.estimatedDeliveryDays} days\n`);

    savedOrder.products.forEach((prod, idx) => {
      console.log(`Product ${idx + 1}: ${prod.productDetails?.title}`);
      console.log(`  Metal: ${prod.productDetails?.metalType}`);
      console.log(`  Ring Size: ${prod.productDetails?.ringSize}`);
      console.log(`  Diamond Type: ${detectDiamondType(prod.productDetails?.selectedVariant)}`);
      console.log(`  Shape: ${prod.productDetails?.diamondDetails?.shape}`);
      console.log(`  Cut: ${prod.productDetails?.diamondDetails?.cut}`);
      console.log(`  Clarity: ${prod.productDetails?.diamondDetails?.clarity}\n`);
    });

    console.log('Shipping To:');
    console.log(`${savedOrder.shippingAddress?.firstName} ${savedOrder.shippingAddress?.lastName}`);
    console.log(`${savedOrder.shippingAddress?.address1}`);
    console.log(`${savedOrder.shippingAddress?.city}, ${savedOrder.shippingAddress?.state}`);
    console.log(`${savedOrder.shippingAddress?.country}\n`);

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    await mongoose.disconnect();
  }
})();
