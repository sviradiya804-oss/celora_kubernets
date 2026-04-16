const axios = require('axios');

const BASE = process.env.BASE_URL || 'http://localhost:5000';

async function run() {
  // Replace these with a real sessionId/userId present in your DB
  const sessionId = process.env.TEST_SESSION_ID || 'test-session-123';
  const userId = process.env.TEST_USER_ID || '';

  const scenarios = [
    {
      name: 'tok_visa token success',
      body: { sessionId, userId, token: 'tok_visa' }
    },
    {
      name: 'tok_chargeDeclined card',
      body: { sessionId, userId, token: 'tok_chargeDeclined' }
    },
    {
      name: 'raw card success (4242)',
      body: { sessionId, userId, cardNumber: '4242424242424242', expiryMonth: '12', expiryYear: '2026', cvv: '123', cardholderName: 'Test User' }
    },
    {
      name: 'expired card',
      body: { sessionId, userId, cardNumber: '4000000000000069', expiryMonth: '12', expiryYear: '2019', cvv: '123' }
    },
    {
      name: 'invalid cvv',
      body: { sessionId, userId, cardNumber: '4000000000000127', expiryMonth: '12', expiryYear: '2026', cvv: '12' }
    }
  ];

  for (const s of scenarios) {
    try {
      console.log('\n===', s.name, '===');
      const resp = await axios.post(`${BASE}/api/cart/checkout-with-payment`, s.body, { headers: { 'Content-Type': 'application/json' } });
      console.log('Response:', resp.data);
    } catch (err) {
      if (err.response) console.log('Error:', err.response.status, err.response.data);
      else console.log('Error:', err.message);
    }
  }
}

run().catch(e => { console.error('Test runner error', e); process.exit(1); });
