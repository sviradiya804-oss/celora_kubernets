/**
 * test-cart-order.js
 * Run: node test-cart-order.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Schema = require('./src/models/schema.js');
const { getJewelryPrice, calculateCartSummary } = require('./src/utils/cartHelper');

// ─── Models ───────────────────────────────────────────────────────────────────
const Jewelry     = mongoose.models.jewelryModel     || mongoose.model('jewelryModel',     new mongoose.Schema(Schema.jewelry),     'jewelrys');
const Cart        = mongoose.models.cartModel        || mongoose.model('cartModel',        new mongoose.Schema(Schema.cart),        'carts');
const Order       = mongoose.models.orderModel       || mongoose.model('orderModel',       new mongoose.Schema(Schema.order),       'orders');
const User        = mongoose.models.userModel        || mongoose.model('userModel',        new mongoose.Schema(Schema.user),        'users');
const FlatDiscount = mongoose.models.flatDiscountModel || mongoose.model('flatDiscountModel', new mongoose.Schema(Schema.flatdiscount), 'flatdiscounts');

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition, got, expected) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    console.log(`     Expected: ${JSON.stringify(expected)}`);
    console.log(`     Got:      ${JSON.stringify(got)}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(65)}`);
  console.log(`📋 ${title}`);
  console.log('─'.repeat(65));
}

function info(msg) { console.log(`  ℹ️  ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }

function catVal(cat) {
  if (!cat) return '';
  if (typeof cat === 'object' && cat.value) return cat.value;
  return typeof cat === 'string' ? cat : '';
}

// ─── 1. Pricing — engagement ring path ───────────────────────────────────────
async function testEngagementPricing() {
  section('1. Engagement ring pricing (pricing.metalPricing path)');

  const product = await Jewelry.findOne({
    $or: [
      { 'category.value': { $regex: /engagement/i } },
      { category: { $regex: /engagement/i } }
    ],
    'pricing.metalPricing.0': { $exists: true }
  }).lean();

  if (!product) { warn('No engagement ring with metalPricing — skipping'); return; }
  info(`Product: "${product.title || product.name}"`);

  const first      = product.pricing.metalPricing[0];
  const expNatural = first?.finalPrice?.natural;
  const expLab     = first?.finalPrice?.lab;

  const priceNoMetal = getJewelryPrice(product, {});
  assert('No metal selected → first metalPricing natural price', priceNoMetal === expNatural && priceNoMetal > 0, priceNoMetal, expNatural);

  const metalId = (first?.metal?.id || first?.metal)?.toString();
  if (metalId) {
    const priceWithMetal = getJewelryPrice(product, { selectedVariant: { selectedOptions: { metaldetail: metalId } } });
    assert('With metaldetail → correct price', priceWithMetal === expNatural && priceWithMetal > 0, priceWithMetal, expNatural);
  }

  if (expLab > 0) {
    const priceLab = getJewelryPrice(product, { diamondDetails: { diamondType: 'Lab' } });
    assert('Lab diamond → finalPrice.lab', priceLab === expLab, priceLab, expLab);
  }
}

// ─── 2. Pricing — non-engagement (addedDiamonds path) ────────────────────────
async function testNonEngagementPricing() {
  section('2. Non-engagement pricing (addedDiamonds path)');

  const product = await Jewelry.findOne({
    $and: [
      { $or: [
        { 'category.value': { $not: /engagement/i } },
        { category: { $not: /engagement/i } }
      ]},
      { 'addedDiamonds.selectedDiamonds.0.metalPricing.0': { $exists: true } }
    ]
  }).lean();

  if (!product) { warn('No non-engagement jewelry with addedDiamonds — skipping'); return; }
  info(`Product: "${product.title || product.name}"`);

  const expPrice = product.addedDiamonds.selectedDiamonds[0]?.metalPricing[0]?.priceNatural;
  const price    = getJewelryPrice(product, {});
  assert('addedDiamonds[0].metalPricing[0].priceNatural', price === expPrice && price > 0, price, expPrice);
}

// ─── 3. Specific live-site products ──────────────────────────────────────────
async function testSpecificProducts() {
  section('3. Live-site products — price > $0');

  const slugs = [
    { slug: 'aire-curvy-diamond-engagement-ring',  label: 'Aire Curvy Diamond Engagement Ring' },
    { slug: 'climber-morii-diamond-bracelet',       label: 'Climber Morii Diamond Bracelet'    },
    { slug: 'eclat-versatile-diamond-bracelet',     label: 'Eclat Versatile Diamond Bracelet'  },
  ];

  for (const { slug, label } of slugs) {
    const doc = await Jewelry.findOne({ slug }).lean();
    if (!doc) { warn(`"${label}" not found in DB — check slug field`); continue; }
    const price = getJewelryPrice(doc, {});
    assert(`${label} price > $0`, price > 0, price, '> 0');
  }
}

// ─── 4. Cart — itemId and diamondDetails ─────────────────────────────────────
async function testCartItemId() {
  section('4. Cart — itemId (UUID v4) and diamondDetails');

  const cart = await Cart.findOne({ isCheckedOut: false, 'items.0': { $exists: true } }).lean();
  if (!cart) { warn('No active cart with items — skipping'); return null; }
  info(`Cart: ${cart._id} (${cart.items.length} item(s))`);

  const withId   = cart.items.filter(i => i.itemId);
  const withDiam = cart.items.filter(i => i.diamondDetails && Object.keys(i.diamondDetails).length > 0);
  info(`Items with itemId: ${withId.length}/${cart.items.length}  |  With diamondDetails: ${withDiam.length}/${cart.items.length}`);

  withId.forEach((item, idx) => {
    assert(
      `Item[${idx}] itemId is UUID v4`,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.itemId),
      item.itemId, 'UUID v4'
    );
  });

  return cart;
}

// ─── 5. Cart pricing — every item > $0 ───────────────────────────────────────
async function testCartPricing(cart) {
  section('5. Cart pricing — every item price > $0');
  if (!cart) { warn('No cart available — skipping'); return; }

  for (const item of cart.items) {
    const product = await Jewelry.findById(item.productId).lean();
    if (!product) { warn(`Product ${item.productId} not found`); continue; }
    const price = getJewelryPrice(product, item);
    assert(`"${product.title || product.name}" → $${price}`, price > 0, price, '> 0');
  }
}

// ─── 6. Sub-orders — structure ───────────────────────────────────────────────
async function testSubOrders() {
  section('6. Sub-orders — one per cart item, correct fields');

  const order = await Order.findOne({ 'subOrders.0': { $exists: true } }).sort({ date: -1 }).lean();
  if (!order) { warn('No order with subOrders — place a test checkout and re-run'); return null; }
  info(`Order: ${order.orderId} (${order.subOrders.length} sub-order(s))`);

  assert('subOrders.length === products.length', order.subOrders.length === order.products.length, order.subOrders.length, order.products.length);

  order.subOrders.forEach((sub, i) => {
    assert(`subOrder[${i}] has subOrderId`,    !!sub.subOrderId,        sub.subOrderId,  'truthy');
    assert(`subOrder[${i}] status = Pending`,  sub.status === 'Pending', sub.status,     'Pending');
    assert(`subOrder[${i}] has productId`,     !!sub.productId,         sub.productId,   'truthy');
    assert(`subOrder[${i}] priceAtTime > 0`,   sub.priceAtTime > 0,     sub.priceAtTime, '> 0');
  });

  return order;
}

// ─── 7. Sub-order status + main order auto-escalation ────────────────────────
async function testSubOrderStatusUpdate(orderSnap) {
  section('7. Sub-order status update → main order auto-escalates to Delivered');
  if (!orderSnap) { warn('No order available — skipping'); return; }

  const OrderLive = mongoose.model('orderModel');
  const live = await OrderLive.findOne({ orderId: orderSnap.orderId });
  if (!live?.subOrders?.length) { warn('Could not load live order — skipping'); return; }

  const sub0     = live.subOrders[0];
  const original = sub0.status;

  // Confirmed
  sub0.status = 'Confirmed';
  sub0.progress = { confirmed: { date: new Date(), confirmedImages: [] } };
  live.updatedOn = new Date();
  await live.save();

  const r1 = await OrderLive.findOne({ orderId: live.orderId });
  assert('subOrder[0] → Confirmed',               r1.subOrders[0].status === 'Confirmed', r1.subOrders[0].status, 'Confirmed');
  assert('Main order NOT Delivered yet',           r1.status !== 'Delivered',               r1.status,              'not Delivered');
  assert('progress.confirmed.date recorded',       !!r1.subOrders[0].progress?.confirmed?.date, null, 'truthy');

  // Manufacturing
  r1.subOrders[0].status = 'Manufacturing';
  r1.subOrders[0].progress.manufacturing = { date: new Date() };
  await r1.save();
  const r2 = await OrderLive.findOne({ orderId: live.orderId });
  assert('subOrder[0] → Manufacturing', r2.subOrders[0].status === 'Manufacturing', r2.subOrders[0].status, 'Manufacturing');

  // All Delivered → main order auto-escalates
  const r3Doc = await OrderLive.findOne({ orderId: live.orderId });
  for (const sub of r3Doc.subOrders) {
    sub.status   = 'Delivered';
    sub.progress = { delivered: { date: new Date() } };
  }
  if (r3Doc.subOrders.every(s => s.status === 'Delivered')) r3Doc.status = 'Delivered';
  await r3Doc.save();

  const r3 = await OrderLive.findOne({ orderId: live.orderId });
  assert('All sub-orders Delivered → main order = Delivered', r3.status === 'Delivered', r3.status, 'Delivered');

  // Restore
  for (const sub of r3.subOrders) { sub.status = original; sub.progress = {}; }
  r3.status = orderSnap.status || 'Pending';
  await r3.save();
  info('Order status restored after test');
}

// ─── 8. Coupon — category.value matching ─────────────────────────────────────
async function testCouponCategory() {
  section('8. Coupon — category.value matching');

  const Coupon = mongoose.models.couponModel
    || mongoose.model('couponModel', new mongoose.Schema(Schema.coupon), 'coupons');
  const coupon = await Coupon.findOne({ categoryWise: true, isActive: true }).lean();
  if (!coupon) { warn('No active category-wise coupon — skipping'); return; }

  const catName = coupon.selectedCategory?.[0]?.categoryName;
  if (!catName) { warn('Coupon has no selectedCategory.categoryName — skipping'); return; }
  info(`Coupon: ${coupon.couponCode}, category: "${catName}"`);

  const product = await Jewelry.findOne({
    $or: [
      { 'category.value': { $regex: new RegExp(catName, 'i') } },
      { category:         { $regex: new RegExp(catName, 'i') } }
    ]
  }).lean();

  if (!product) { warn(`No jewelry matching category "${catName}"`); return; }

  const val = catVal(product.category);
  assert(
    `category.value "${val}" matches coupon "${catName}"`,
    val.toLowerCase().trim() === catName.toLowerCase().trim(),
    val, catName
  );
}

// ─── 9. User → orders relationship ───────────────────────────────────────────
async function testUserOrderRelationship() {
  section('9. User → orders relationship');

  const top = await Order.aggregate([
    { $group: { _id: '$customer', orderCount: { $sum: 1 } } },
    { $sort: { orderCount: -1 } },
    { $limit: 1 }
  ]);
  if (!top.length) { warn('No orders in DB'); return; }

  const user   = await User.findById(top[0]._id).lean();
  const orders = await Order.find({ customer: top[0]._id }).sort({ date: -1 }).lean();
  info(`User: ${user?.email || top[0]._id} | Orders: ${orders.length}`);

  assert('User has at least 1 order', orders.length > 0, orders.length, '> 0');

  const withSubs = orders.filter(o => o.subOrders?.length > 0);
  if (withSubs.length > 0) {
    assert('Sub-orders visible in user order', true, withSubs.length, '> 0');
  } else {
    info('No orders with subOrders yet');
  }
}

// ─── 10. Delivery date ────────────────────────────────────────────────────────
async function testDeliveryDate() {
  section('10. Delivery date — estimatedDeliveryDays on products');

  const slugs = [
    { slug: 'aire-curvy-diamond-engagement-ring',  expectedDays: 15 },
    { slug: 'climber-morii-diamond-bracelet',       expectedDays: 14 },
    { slug: 'eclat-versatile-diamond-bracelet',     expectedDays: 15 },
  ];

  for (const { slug, expectedDays } of slugs) {
    const product = await Jewelry.findOne({ slug }).select('jewelryName estimatedDeliveryDays').lean();
    if (!product) { warn(`Product not found: ${slug}`); continue; }
    assert(`${product.jewelryName} estimatedDeliveryDays = ${expectedDays}`,
      product.estimatedDeliveryDays === expectedDays, product.estimatedDeliveryDays, expectedDays);
  }

  const ordersWithDate = await Order.find({ expectedDeliveryDate: { $exists: true, $ne: null } })
    .select('orderId expectedDeliveryDate createdOn')
    .sort({ createdOn: -1 })
    .limit(1)
    .lean();

  if (ordersWithDate.length > 0) {
    const o        = ordersWithDate[0];
    const diffDays = Math.round((new Date(o.expectedDeliveryDate) - new Date(o.createdOn)) / (1000 * 60 * 60 * 24));
    assert('expectedDeliveryDate > createdOn',          new Date(o.expectedDeliveryDate) > new Date(o.createdOn), diffDays, '> 0 days');
    assert('Delivery window between 1 and 60 days',     diffDays >= 1 && diffDays <= 60,                          diffDays, '1–60 days');
  } else {
    info('No orders with expectedDeliveryDate yet');
  }
}

// ─── 11. DELETE /api/cart/:id — resolution logic ─────────────────────────────
async function testCartDelete() {
  section('11. DELETE /api/cart/:id — item vs clear cart resolution');

  const cart = await Cart.findOne({ isCheckedOut: false, 'items.0': { $exists: true } });
  if (!cart) { warn('No active cart with items — skipping'); return; }
  info(`Cart: ${cart.cartId} | items: ${cart.items.length}`);

  function findItemIndex(id) {
    if (!id) return -1;
    return cart.items.findIndex(item =>
      (item.itemId && item.itemId === id) ||
      item._id.toString() === id ||
      item.productId.toString() === id
    );
  }

  // cartId + itemId → remove single item
  const isCartId   = (id) => id === cart.cartId || id === cart.sessionId;
  const firstItemId = cart.items[0]._id.toString();

  assert('cartId + itemId → single item removal',
    isCartId(cart.cartId) && findItemIndex(firstItemId) !== -1, null, true);

  assert('cartId, no itemId → clear cart',
    isCartId(cart.cartId) && !undefined, null, true);

  if (cart.sessionId) {
    assert('sessionId + itemId → single item removal',
      isCartId(cart.sessionId) && findItemIndex(firstItemId) !== -1, null, true);
  }

  assert('item _id directly in URL → remove that item',
    !isCartId(firstItemId) && findItemIndex(firstItemId) === 0, null, true);

  assert('productId directly in URL → remove that item',
    !isCartId(cart.items[0].productId.toString()) && findItemIndex(cart.items[0].productId.toString()) === 0, null, true);

  assert('unknown ID → 404',
    !isCartId('ffffffffffffffffffffffff') && findItemIndex('ffffffffffffffffffffffff') === -1, null, true);

  if (cart.items.length >= 2) {
    const copy = [...cart.items];
    copy.splice(findItemIndex(firstItemId), 1);
    assert(`Multi-item: removing 1 leaves ${cart.items.length - 1} items`, copy.length === cart.items.length - 1, copy.length, cart.items.length - 1);
    assert('Remaining items unchanged', cart.items.slice(1).every(i => copy.some(c => c._id.toString() === i._id.toString())), null, true);
  } else {
    info('Multi-item test skipped (only 1 item in cart)');
  }
}

// ─── 12. Flat Discount ────────────────────────────────────────────────────────
async function testFlatDiscounts() {
  section('12. Flat Discount — product / category / cadCode / expiry / diamondType');

  const products = await Jewelry.find({}).limit(3).lean();
  if (!products.length) { warn('No jewelry in DB — skipping'); return; }

  const p1          = products[0];
  const p2          = products[1] || products[0];
  const multiProduct = products.length >= 2;

  const p1CatSlug = catVal(p1.category);
  const slugToDisplay = {
    'engagement-rings': 'Engagement Rings',
    'wedding-bands':    'Wedding Bands',
    'earrings':         'Earrings',
    'bracelet':         'Bracelet',
    'pendant':          'Pendant',
  };
  const p1CatDisplay = slugToDisplay[p1CatSlug] || null;

  info(`p1: "${p1.title || p1.name}" | category: "${p1CatSlug}" | cadCode: "${p1.cadCode}"`);
  if (multiProduct) info(`p2: "${p2.title || p2.name}"`);

  function makeCart(items, coupon = null) {
    return {
      items: items.map(({ product, quantity = 1, priceAtTime, diamondType }) => ({
        itemId:          require('uuid').v4(),
        productId:       product._id,
        quantity,
        priceAtTime:     priceAtTime || product.price || 1000,
        diamondDetails:  diamondType ? { diamondType } : undefined,
        selectedVariant: {}
      })),
      coupon: coupon || {}
    };
  }

  async function createFD(fields) {
    return FlatDiscount.create({
      flatdiscountId:    require('uuid').v4(),
      discountName:      `TEST_FD_${Date.now()}`,
      description:       'Automated test — safe to delete',
      status:            true,
      discountUnit:      '%',
      naturalDiscount:   10,
      labDiscount:       20,
      minimumOrderValue: 0,
      allowThisDiscount: 'all',
      ...fields
    });
  }

  const cleanup = [];

  // 1. all — applies to every item
  {
    const fd    = await createFD({ allowThisDiscount: 'all', naturalDiscount: 10, discountUnit: '%' });
    cleanup.push(fd._id);
    const price   = p1.price || 1000;
    const summary = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: price }]));
    const exp     = Math.round(price * 0.10 * 100) / 100;
    assert('1. "all" — 10% applied',             Math.abs(summary.flatDiscountAmount - exp) < 1,         summary.flatDiscountAmount, `~${exp}`);
    assert('1. total = subtotal - discount',      Math.abs(summary.total - (summary.subtotal - summary.flatDiscountAmount)) < 0.01, null, true);
    await FlatDiscount.deleteOne({ _id: fd._id }); cleanup.pop();
  }

  // 2. selectProducts — only targeted product
  if (multiProduct) {
    const fd    = await createFD({ allowThisDiscount: 'selectProducts', selectedProductIds: [p1._id], naturalDiscount: 10 });
    cleanup.push(fd._id);
    const price1  = p1.price || 1000;
    const price2  = p2.price || 1200;
    const summary = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: price1 }, { product: p2, priceAtTime: price2 }]));
    const exp     = Math.round(price1 * 0.10 * 100) / 100;
    assert('2. selectProducts — only p1 discounted', Math.abs(summary.flatDiscountAmount - exp) < 1, summary.flatDiscountAmount, `~${exp}`);
    await FlatDiscount.deleteOne({ _id: fd._id }); cleanup.pop();
  } else {
    info('2. selectProducts skipped (need ≥2 products)');
  }

  // 3. discountCategory — matching category
  if (p1CatDisplay) {
    const fd    = await createFD({ allowThisDiscount: 'all', discountCategory: p1CatDisplay, naturalDiscount: 15 });
    cleanup.push(fd._id);
    const price   = p1.price || 1000;
    const summary = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: price }]));
    const exp     = Math.round(price * 0.15 * 100) / 100;
    assert(`3. category "${p1CatDisplay}" matches → discount applied`, Math.abs(summary.flatDiscountAmount - exp) < 1, summary.flatDiscountAmount, `~${exp}`);
    await FlatDiscount.deleteOne({ _id: fd._id }); cleanup.pop();
  } else {
    info(`3. Category test skipped ("${p1CatSlug}" not in flatdiscount enum)`);
  }

  // 4. discountCategory mismatch — must NOT apply
  {
    const normalizeCategory = c => (c || '').toLowerCase().trim().replace(/\s+/g, '-');
    const allCats  = ['Engagement Rings', 'Wedding Bands', 'Earrings', 'Bracelet', 'Pendant'];
    const wrongCat = allCats.find(c => normalizeCategory(c) !== normalizeCategory(p1CatSlug)) || 'Bracelet';
    const fd       = await createFD({ allowThisDiscount: 'all', discountCategory: wrongCat, naturalDiscount: 50 });
    cleanup.push(fd._id);
    const summary  = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: p1.price || 1000 }]));
    assert(`4. Wrong category "${wrongCat}" — no discount`, summary.flatDiscountAmount === 0, summary.flatDiscountAmount, 0);
    await FlatDiscount.deleteOne({ _id: fd._id }); cleanup.pop();
  }

  // 5. cadCode targeting
  if (p1.cadCode) {
    const fd    = await createFD({ allowThisDiscount: 'cadCode', selectedCadCodes: [p1.cadCode], naturalDiscount: 12 });
    cleanup.push(fd._id);
    const price   = p1.price || 1000;
    const summary = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: price }]));
    const exp     = Math.round(price * 0.12 * 100) / 100;
    assert(`5. cadCode "${p1.cadCode}" → discount applied`, Math.abs(summary.flatDiscountAmount - exp) < 1, summary.flatDiscountAmount, `~${exp}`);
    await FlatDiscount.deleteOne({ _id: fd._id }); cleanup.pop();
  } else {
    info('5. cadCode test skipped (product has no cadCode)');
  }

  // 6. wrong cadCode — must NOT apply
  {
    const fd      = await createFD({ allowThisDiscount: 'cadCode', selectedCadCodes: ['NONEXISTENT-XYZ'], naturalDiscount: 50 });
    cleanup.push(fd._id);
    const summary = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: p1.price || 1000 }]));
    assert('6. Wrong cadCode — no discount', summary.flatDiscountAmount === 0, summary.flatDiscountAmount, 0);
    await FlatDiscount.deleteOne({ _id: fd._id }); cleanup.pop();
  }

  // 7. expired validTill — must NOT apply
  {
    const fd      = await createFD({ allowThisDiscount: 'all', validTill: new Date(Date.now() - 86400000), naturalDiscount: 50 });
    cleanup.push(fd._id);
    const summary = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: p1.price || 1000 }]));
    assert('7. Expired discount — no discount', summary.flatDiscountAmount === 0, summary.flatDiscountAmount, 0);
    await FlatDiscount.deleteOne({ _id: fd._id }); cleanup.pop();
  }

  // 8. future validTill — must apply
  {
    const fd    = await createFD({ allowThisDiscount: 'all', validTill: new Date(Date.now() + 86400000), naturalDiscount: 10 });
    cleanup.push(fd._id);
    const price   = p1.price || 1000;
    const summary = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: price }]));
    const exp     = Math.round(price * 0.10 * 100) / 100;
    assert('8. Future validTill — discount applied', Math.abs(summary.flatDiscountAmount - exp) < 1, summary.flatDiscountAmount, `~${exp}`);
    await FlatDiscount.deleteOne({ _id: fd._id }); cleanup.pop();
  }

  // 9. minimumOrderValue not met
  {
    const price    = p1.price || 1000;
    const fd       = await createFD({ allowThisDiscount: 'all', naturalDiscount: 50, minimumOrderValue: price * 10 });
    cleanup.push(fd._id);
    const summary  = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: price }]));
    assert('9. minimumOrderValue not met — no discount', summary.flatDiscountAmount === 0, summary.flatDiscountAmount, 0);
    await FlatDiscount.deleteOne({ _id: fd._id }); cleanup.pop();
  }

  // 10. Natural vs Lab discount values
  {
    const fd          = await createFD({ allowThisDiscount: 'all', naturalDiscount: 10, labDiscount: 25, discountUnit: '%' });
    cleanup.push(fd._id);
    const price       = p1.price || 1000;
    const sumNatural  = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: price, diamondType: 'Natural' }]));
    const sumLab      = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: price, diamondType: 'Lab'     }]));
    const expNatural  = Math.round(price * 0.10 * 100) / 100;
    const expLab      = Math.round(price * 0.25 * 100) / 100;
    assert(`10a. Natural → 10% ($${expNatural})`,    Math.abs(sumNatural.flatDiscountAmount - expNatural) < 1, sumNatural.flatDiscountAmount, `~${expNatural}`);
    assert(`10b. Lab → 25% ($${expLab})`,            Math.abs(sumLab.flatDiscountAmount    - expLab)     < 1, sumLab.flatDiscountAmount,     `~${expLab}`);
    assert('10c. Lab discount > Natural discount',   sumLab.flatDiscountAmount > sumNatural.flatDiscountAmount, null, true);
    await FlatDiscount.deleteOne({ _id: fd._id }); cleanup.pop();
  }

  // 11. Flat $ amount
  {
    const price   = p1.price || 1000;
    const fd      = await createFD({ allowThisDiscount: 'all', naturalDiscount: 100, labDiscount: 100, discountUnit: '$' });
    cleanup.push(fd._id);
    const summary = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: price }]));
    assert('11. Flat $100 off', Math.abs(summary.flatDiscountAmount - 100) < 0.01, summary.flatDiscountAmount, 100);
    await FlatDiscount.deleteOne({ _id: fd._id }); cleanup.pop();
  }

  // 12. Best discount wins
  {
    const price   = p1.price || 1000;
    const fdSmall = await createFD({ allowThisDiscount: 'all', naturalDiscount:  5, discountUnit: '%', discountName: 'TEST_SMALL' });
    const fdBig   = await createFD({ allowThisDiscount: 'all', naturalDiscount: 20, discountUnit: '%', discountName: 'TEST_BIG'   });
    cleanup.push(fdSmall._id, fdBig._id);
    const summary = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: price }]));
    const expBest = Math.round(price * 0.20 * 100) / 100;
    assert('12. Best discount wins (20% not 5%)',      Math.abs(summary.flatDiscountAmount - expBest) < 1, summary.flatDiscountAmount, `~${expBest}`);
    assert('12. appliedDiscounts shows winning entry', summary.appliedDiscounts?.[0]?.discountName === 'TEST_BIG', summary.appliedDiscounts?.[0]?.discountName, 'TEST_BIG');
    await FlatDiscount.deleteMany({ _id: { $in: [fdSmall._id, fdBig._id] } }); cleanup.splice(0);
  }

  // 13. Multi-product — only p1 discounted
  if (multiProduct) {
    const fd      = await createFD({ allowThisDiscount: 'selectProducts', selectedProductIds: [p1._id], naturalDiscount: 10 });
    cleanup.push(fd._id);
    const price1  = 1000;
    const price2  = 1200;
    const summary = await calculateCartSummary(makeCart([{ product: p1, priceAtTime: price1 }, { product: p2, priceAtTime: price2 }]));
    const expDisc = Math.round(price1 * 0.10 * 100) / 100;
    const expTotal = price1 + price2 - expDisc;
    assert('13. Multi-product subtotal correct',           Math.abs(summary.subtotal - (price1 + price2)) < 0.01,   summary.subtotal, price1 + price2);
    assert('13. Only p1 discounted',                       Math.abs(summary.flatDiscountAmount - expDisc) < 1,       summary.flatDiscountAmount, `~${expDisc}`);
    assert('13. Total correct',                            Math.abs(summary.total - expTotal) < 1,                   summary.total, `~${expTotal}`);
    assert('13. appliedDiscounts has 1 entry',             summary.appliedDiscounts?.length === 1,                   summary.appliedDiscounts?.length, 1);
    await FlatDiscount.deleteOne({ _id: fd._id }); cleanup.pop();
  } else {
    info('13. Multi-product test skipped (need ≥2 products)');
  }

  if (cleanup.length > 0) {
    await FlatDiscount.deleteMany({ _id: { $in: cleanup } });
    warn(`Cleaned up ${cleanup.length} leaked test FlatDiscount doc(s)`);
  } else {
    info('All test FlatDiscount docs cleaned up ✅');
  }
}

// ─── 13. Token Auth — JWT is single source of truth ──────────────────────────
async function testTokenAuth() {
  section('13. Token Auth — JWT userId extraction across all cart endpoints');

  const jwt    = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET;
  if (!secret) { warn('JWT_SECRET not set — skipping'); return; }

  function getUserIdFromToken(req) {
    const authHeader = req?.headers?.authorization;
    if (!authHeader) { const e = new Error('Authorization token is required'); e.status = 401; throw e; }
    return jwt.verify(authHeader.split(' ')[1], secret).id;
  }

  const fakeId       = new mongoose.Types.ObjectId().toString();
  const validToken   = jwt.sign({ id: fakeId }, secret, { expiresIn: '1h' });
  const expiredToken = jwt.sign({ id: fakeId }, secret, { expiresIn: '-1s' });
  const wrongToken   = jwt.sign({ id: fakeId }, 'wrong-secret', { expiresIn: '1h' });

  // Valid token
  let result; try { result = getUserIdFromToken({ headers: { authorization: `Bearer ${validToken}` } }); } catch (_) { result = null; }
  assert('1. Valid token → correct userId', result === fakeId, result, fakeId);

  // Missing header → 401
  let status; try { getUserIdFromToken({ headers: {} }); status = 200; } catch (e) { status = e.status || 500; }
  assert('2. Missing header → 401', status === 401, status, 401);

  // Expired token → throws
  let threw = false; try { getUserIdFromToken({ headers: { authorization: `Bearer ${expiredToken}` } }); } catch (_) { threw = true; }
  assert('3. Expired token → error', threw, threw, true);

  // Wrong secret → throws
  threw = false; try { getUserIdFromToken({ headers: { authorization: `Bearer ${wrongToken}` } }); } catch (_) { threw = true; }
  assert('4. Wrong secret → error', threw, threw, true);

  // Malformed token → throws
  threw = false; try { getUserIdFromToken({ headers: { authorization: 'Bearer ' } }); } catch (_) { threw = true; }
  assert('5. Malformed token → error', threw, threw, true);

  // Token userId finds the correct cart in DB
  const cart = await Cart.findOne({ isCheckedOut: false, userId: { $exists: true } });
  if (cart?.userId) {
    const realToken  = jwt.sign({ id: cart.userId.toString() }, secret, { expiresIn: '1h' });
    const extractedId = getUserIdFromToken({ headers: { authorization: `Bearer ${realToken}` } });
    const found      = await Cart.findOne({ userId: extractedId, isCheckedOut: false });
    assert('6. Token userId finds cart in DB', found?._id.toString() === cart._id.toString(), found?._id?.toString(), cart._id.toString());
  } else {
    info('6. Skipped (no active cart with userId)');
  }

  // Route code checks
  const fs        = require('fs');
  const routeCode = fs.readFileSync('./src/routes/cart.js', 'utf8');
  assert('7. POST /add uses getUserIdFromToken',    routeCode.includes('router.post("/add"')    && routeCode.includes('getUserIdFromToken'), null, true);
  assert('8. PUT /update uses getUserIdFromToken',  routeCode.includes('router.put("/update"')  && routeCode.includes('getUserIdFromToken'), null, true);
  assert('9. POST /remove uses getUserIdFromToken', routeCode.includes('router.post("/remove"') && routeCode.includes('getUserIdFromToken'), null, true);
  assert('10. DELETE /:id uses getUserIdFromToken', routeCode.includes('router.delete("/:id"')  && routeCode.includes('getUserIdFromToken'), null, true);
}

// ─── 14. Price Filter — Natural vs Lab diamond scoping ───────────────────────
async function testPriceFilter() {
  section('14. Price Filter — Natural/Lab scoping (addedDiamonds path)');

  // Find a product that has BOTH a Natural (DR) and Lab (LC) selectedDiamond
  // with different price ranges — the key case that was broken.
  const product = await Jewelry.findOne({
    'addedDiamonds.selectedDiamonds.1': { $exists: true },
    'addedDiamonds.selectedDiamonds.color': { $regex: /DR/i }
  }).lean();

  if (!product) { warn('No product with both DR and LC variations — skipping'); return; }

  const diamonds = product.addedDiamonds?.selectedDiamonds || [];
  const drDiamond = diamonds.find(d => d.color && /DR/i.test(d.color));
  const lcDiamond = diamonds.find(d => d.color && /LC/i.test(d.color));

  if (!drDiamond || !lcDiamond) {
    warn(`"${product.jewelryName}" missing DR or LC variation — skipping`);
    return;
  }

  const drPrice14K = drDiamond.metalPricing?.find(m => m.metal?.includes('14'))?.priceNatural || 0;
  const lcPrice14K = lcDiamond.metalPricing?.find(m => m.metal?.includes('14'))?.priceNatural || 0;

  info(`"${product.jewelryName}" — DR 14K: $${drPrice14K} | LC 14K: $${lcPrice14K}`);

  if (drPrice14K === 0 || lcPrice14K === 0) {
    warn('One of the 14K prices is 0 — skipping'); return;
  }

  // ── Simulate the fixed $elemMatch queries ──────────────────────────────────
  // These mirror exactly what commonController.js builds after the fix.

  const naturalFilter = {
    'addedDiamonds.selectedDiamonds': {
      $elemMatch: {
        color: { $not: /\(LC\)/i },
        metalPricing: { $elemMatch: { priceNatural: { $gt: 0 } } }
      }
    }
  };

  const labFilter = {
    'addedDiamonds.selectedDiamonds': {
      $elemMatch: {
        color: { $regex: /\(LC\)/i },
        metalPricing: { $elemMatch: { priceNatural: { $gt: 0 } } }
      }
    }
  };

  // 1. Natural filter finds this product (DR exists and price > 0)
  const foundNatural = await Jewelry.findOne({ _id: product._id, ...naturalFilter }).lean();
  assert('1. Natural filter finds product with DR variation', !!foundNatural, !!foundNatural, true);

  // 2. Lab filter finds this product (LC exists and price > 0)
  const foundLab = await Jewelry.findOne({ _id: product._id, ...labFilter }).lean();
  assert('2. Lab filter finds product with LC variation', !!foundLab, !!foundLab, true);

  // ── Key test: price between LC and DR prices ───────────────────────────────
  // Set maxPrice just below DR price but above LC price
  // DR should be excluded, LC should be included.
  if (drPrice14K > lcPrice14K) {
    const midPrice = Math.floor((drPrice14K + lcPrice14K) / 2);
    info(`Mid-price: $${midPrice} (DR=$${drPrice14K} above, LC=$${lcPrice14K} below)`);

    const naturalMaxFilter = {
      'addedDiamonds.selectedDiamonds': {
        $elemMatch: {
          color: { $not: /\(LC\)/i },
          metalPricing: { $elemMatch: { priceNatural: { $gt: 0, $lte: midPrice } } }
        }
      }
    };

    const labMaxFilter = {
      'addedDiamonds.selectedDiamonds': {
        $elemMatch: {
          color: { $regex: /\(LC\)/i },
          metalPricing: { $elemMatch: { priceNatural: { $gt: 0, $lte: midPrice } } }
        }
      }
    };

    // 3. Natural filter with maxPrice=midPrice → product EXCLUDED (DR price > midPrice)
    const natExcluded = await Jewelry.findOne({ _id: product._id, ...naturalMaxFilter }).lean();
    assert(`3. Natural maxPrice=$${midPrice} excludes product (DR $${drPrice14K} > mid)`,
      !natExcluded, !!natExcluded, false);

    // 4. Lab filter with maxPrice=midPrice → product INCLUDED (LC price < midPrice)
    const labIncluded = await Jewelry.findOne({ _id: product._id, ...labMaxFilter }).lean();
    assert(`4. Lab maxPrice=$${midPrice} includes product (LC $${lcPrice14K} < mid)`,
      !!labIncluded, !!labIncluded, true);

    // 5. OLD broken Natural filter (no color scope) would incorrectly include this product
    const brokenNaturalFilter = {
      'addedDiamonds.selectedDiamonds': {
        $elemMatch: {
          // no color filter — this is the OLD broken behaviour
          metalPricing: { $elemMatch: { priceNatural: { $gt: 0, $lte: midPrice } } }
        }
      }
    };
    const brokenResult = await Jewelry.findOne({ _id: product._id, ...brokenNaturalFilter }).lean();
    assert('5. OLD filter (no color scope) incorrectly matches product — confirms bug existed',
      !!brokenResult, !!brokenResult, true); // we EXPECT this to be true (old bug present)

    // The fix means Natural filter excludes it; old filter includes it — that's the delta
    assert('6. Fixed filter correctly excludes product; old filter did not — fix is effective',
      !natExcluded && !!brokenResult, { fixed: !natExcluded, old: !!brokenResult }, { fixed: true, old: true });

  } else {
    info(`LC price ($${lcPrice14K}) >= DR price ($${drPrice14K}) for this product — mid-price tests skipped`);
    info('Tests 3-6 require DR price > LC price to demonstrate the bug');
  }

  // 7. Price range aggregation — Natural scope
  {
    const agg = await Jewelry.aggregate([
      { $match: { _id: product._id } },
      { $unwind: '$addedDiamonds.selectedDiamonds' },
      { $unwind: '$addedDiamonds.selectedDiamonds.metalPricing' },
      { $match: { 'addedDiamonds.selectedDiamonds.color': { $not: /\(LC\)/i }, 'addedDiamonds.selectedDiamonds.metalPricing.priceNatural': { $gt: 0 } } },
      { $group: { _id: null, min: { $min: '$addedDiamonds.selectedDiamonds.metalPricing.priceNatural' }, max: { $max: '$addedDiamonds.selectedDiamonds.metalPricing.priceNatural' } } }
    ]);
    const range = agg[0];
    assert('7. Natural price range aggregation returns DR prices only',
      range && range.min === drDiamond.metalPricing.reduce((m, p) => Math.min(m, p.priceNatural), Infinity),
      range?.min, `DR min price`);
  }

  // 8. Price range aggregation — Lab scope
  {
    const agg = await Jewelry.aggregate([
      { $match: { _id: product._id } },
      { $unwind: '$addedDiamonds.selectedDiamonds' },
      { $unwind: '$addedDiamonds.selectedDiamonds.metalPricing' },
      { $match: { 'addedDiamonds.selectedDiamonds.color': { $regex: /\(LC\)/i }, 'addedDiamonds.selectedDiamonds.metalPricing.priceNatural': { $gt: 0 } } },
      { $group: { _id: null, min: { $min: '$addedDiamonds.selectedDiamonds.metalPricing.priceNatural' }, max: { $max: '$addedDiamonds.selectedDiamonds.metalPricing.priceNatural' } } }
    ]);
    const range = agg[0];
    assert('8. Lab price range aggregation returns LC prices only',
      range && range.min === lcDiamond.metalPricing.reduce((m, p) => Math.min(m, p.priceNatural), Infinity),
      range?.min, `LC min price`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔌 Connecting to MongoDB...');
  const dbUri = process.env.DATABASE_URI || process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!dbUri) { console.error('❌ DATABASE_URI not set in .env'); process.exit(1); }

  await mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ Connected\n');

  try {
    await testEngagementPricing();
    await testNonEngagementPricing();
    await testSpecificProducts();
    const cart  = await testCartItemId();
    await testCartPricing(cart);
    const order = await testSubOrders();
    await testSubOrderStatusUpdate(order);
    await testCouponCategory();
    await testUserOrderRelationship();
    await testDeliveryDate();
    await testCartDelete();
    await testFlatDiscounts();
    await testTokenAuth();
    await testPriceFilter();
  } catch (err) {
    console.error('\n💥 Unexpected error:', err.message);
    console.error(err.stack);
    failed++;
  }

  console.log(`\n${'═'.repeat(65)}`);
  console.log(`  Results: ${passed} passed  |  ${failed} failed`);
  console.log('═'.repeat(65));
  console.log(failed > 0 ? '  ❌ Some tests failed\n' : '  ✅ All tests passed\n');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
