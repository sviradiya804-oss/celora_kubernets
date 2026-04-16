const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:5000';
const TEST_USER_ID = '68cfb58bba4299c98af66c87';
const TEST_PRODUCT_ID = '68e22c2ee0c63062982a65cd';

async function apiCall(method, endpoint, data = null) {
  try {
    const config = { method, url: `${BASE_URL}${endpoint}`, headers: { 'Content-Type': 'application/json' } };
    if (data) config.data = data;
    const resp = await axios(config);
    return { success: true, data: resp.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
}

async function run() {
  const sessionId = uuidv4();
  console.log('SessionId:', sessionId);

  console.log('\n1) Add product to cart');
  const addResp = await apiCall('POST', '/api/cart/add', {
    sessionId,
    userId: TEST_USER_ID,
    productId: TEST_PRODUCT_ID,
    quantity: 1,
    selectedOptions: { metaldetail: '68afea760686a0c9081db6ad' }
  });
  console.log('Add response:', addResp);
  if (!addResp.success) return process.exit(1);

  // If server returned an adopted sessionId, use it for subsequent requests
  const returnedSession = addResp.data?.sessionId || addResp.data?.cart?.sessionId;
  const usedSessionId = returnedSession || sessionId;
  if (usedSessionId !== sessionId) {
    console.log('Note: adopting server sessionId:', usedSessionId);
  }

  console.log('\n2) Checkout with direct card payment');
  // Use Stripe test card 4242 4242 4242 4242
  const checkoutResp = await apiCall('POST', '/api/cart/checkout-with-payment', {
  sessionId: usedSessionId,
    userId: TEST_USER_ID,
    paymentMethod: 'card',
    cardDetails: {
      // Use Stripe test token to avoid sending raw card numbers directly to the API
      // Server code accepts tokens that start with 'tok_' and will create a payment method from it.
      cardNumber: 'tok_visa',
      cardholderName: 'Test User'
    },
    billingAddress: {
      firstName: 'Test',
      lastName: 'User',
      address: '123 Test St',
      apartment: '',
      city: 'Testville',
      state: 'NY',
      zipCode: '10001',
      country: 'US'
    },
    shippingAddress: {
      firstName: 'Test',
      lastName: 'User',
      address: '123 Test St',
      apartment: '',
      city: 'Testville',
      state: 'NY',
      zipCode: '10001',
      country: 'US'
    },
    email: 'test+stripe@example.com',
    phone: '+15555555555',
    customerName: 'Test User'
  });

  console.log('Checkout-with-payment response:', checkoutResp);

  if (!checkoutResp.success) {
    console.error('Payment failed or API error:', checkoutResp.error);
    return process.exit(1);
  }

  console.log('\n3) Payment result — check status endpoint (if sessionId returned):');
  if (checkoutResp.data && checkoutResp.data.sessionId) {
    const status = await apiCall('GET', `/api/payments/status/${checkoutResp.data.sessionId}`);
    console.log('Payment status response:', status);
  } else {
    console.log('No sessionId returned; response body:', checkoutResp.data);
  }
}

run().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});