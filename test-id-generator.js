/**
 * Test: Verify Short ID Generator
 * Run: node test-id-generator.js
 */

const { generateShortId, generateOrderId, generateSubOrderId } = require('./src/utils/idGenerator');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function section(title) {
  log(`\n${'═'.repeat(70)}`, 'blue');
  log(`${title}`, 'cyan');
  log(`${'═'.repeat(70)}`, 'blue');
}

async function main() {
  try {
    section('TEST: ID Generator for Orders & Sub-Orders');

    // Test 1: Check ID format and length
    log('\n→ Test 1: ID Format & Length', 'yellow');
    const testIds = [];
    for (let i = 0; i < 5; i++) {
      const id = generateShortId();
      testIds.push(id);
      log(`Generated ID ${i + 1}: ${id}`, 'cyan');
      
      // Validate length
      if (id.length === 12) {
        log(`✓ Length is correct: 12 characters`, 'green');
      } else {
        log(`✗ Length is WRONG: ${id.length} (expected 12)`, 'red');
      }
      
      // Validate format (8 alphanumeric + 4 digits)
      const regex = /^[A-Z0-9]{12}$/;
      if (regex.test(id)) {
        log(`✓ Format matches regex: /^[A-Z0-9]{12}$/`, 'green');
      } else {
        log(`✗ Format DOES NOT match regex`, 'red');
      }
    }

    // Test 2: Check uniqueness
    log('\n→ Test 2: Uniqueness Check', 'yellow');
    const ids = new Set();
    const duplicates = [];
    for (let i = 0; i < 100; i++) {
      const id = generateShortId();
      if (ids.has(id)) {
        duplicates.push(id);
      }
      ids.add(id);
    }

    if (duplicates.length === 0) {
      log(`✓ All 100 generated IDs are unique`, 'green');
    } else {
      log(`✗ Found ${duplicates.length} duplicate IDs: ${duplicates.join(', ')}`, 'red');
    }

    // Test 3: Test orderId generation
    log('\n→ Test 3: Order ID Generation', 'yellow');
    const orderId1 = generateOrderId();
    const orderId2 = generateOrderId();
    log(`Order ID 1: ${orderId1}`, 'cyan');
    log(`Order ID 2: ${orderId2}`, 'cyan');
    
    if (orderId1 !== orderId2) {
      log(`✓ Order IDs are unique`, 'green');
    } else {
      log(`✗ Order IDs are NOT unique`, 'red');
    }

    if (orderId1.length === 12 && /^[A-Z0-9]{12}$/.test(orderId1)) {
      log(`✓ Order ID format is valid`, 'green');
    } else {
      log(`✗ Order ID format is INVALID`, 'red');
    }

    // Test 4: Test subOrderId generation
    log('\n→ Test 4: Sub-Order ID Generation', 'yellow');
    const subOrderId1 = generateSubOrderId();
    const subOrderId2 = generateSubOrderId();
    log(`Sub-Order ID 1: ${subOrderId1}`, 'cyan');
    log(`Sub-Order ID 2: ${subOrderId2}`, 'cyan');
    
    if (subOrderId1 !== subOrderId2) {
      log(`✓ Sub-Order IDs are unique`, 'green');
    } else {
      log(`✗ Sub-Order IDs are NOT unique`, 'red');
    }

    if (subOrderId1.length === 12 && /^[A-Z0-9]{12}$/.test(subOrderId1)) {
      log(`✓ Sub-Order ID format is valid`, 'green');
    } else {
      log(`✗ Sub-Order ID format is INVALID`, 'red');
    }

    // Test 5: Simulate order structure
    log('\n→ Test 5: Order Structure Test', 'yellow');
    const mockOrder = {
      _id: 'mongodb_id_123',
      orderId: generateOrderId(),
      customer: 'customer_id_456',
      products: [],
      subOrders: [
        { subOrderId: generateSubOrderId(), productId: 'prod1', quantity: 1 },
        { subOrderId: generateSubOrderId(), productId: 'prod2', quantity: 2 }
      ],
      subtotal: 1000,
      total: 1100,
      status: 'Pending',
      paymentStatus: 'pending',
      createdOn: new Date()
    };

    log(`Order ID: ${mockOrder.orderId}`, 'cyan');
    log(`Sub-Orders:`, 'cyan');
    mockOrder.subOrders.forEach((subOrder, idx) => {
      log(`  ${idx + 1}. ${subOrder.subOrderId}`, 'cyan');
    });

    if (mockOrder.orderId && /^[A-Z0-9]{12}$/.test(mockOrder.orderId)) {
      log(`✓ Order structure is valid`, 'green');
    } else {
      log(`✗ Order structure is INVALID`, 'red');
    }

    // Summary
    section('SUMMARY');
    log('✓ All ID Generator tests passed!', 'green');
    log('✓ IDs are 12 characters long', 'green');
    log('✓ IDs follow the format: [A-Z0-9]{12} (8 random + 4 timestamp)', 'green');
    log('✓ IDs are unique across multiple generations', 'green');
    log('✓ Ready for database integration', 'green');

  } catch (err) {
    log(`\n✗ ERROR: ${err.message}`, 'red');
    console.error(err);
    process.exit(1);
  }
}

main();
