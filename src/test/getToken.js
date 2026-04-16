/**
 * Quick JWT Token Generator for Testing
 * Run this to get a valid JWT token for testing
 */

const axios = require('axios');

async function getTestToken() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  
  console.log('🔑 Getting test JWT token...');
  
  try {
    // Replace with your actual admin credentials
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'your_admin_email@example.com',  // Replace with your admin email
      password: 'your_admin_password'         // Replace with your admin password
    });
    
    if (loginResponse.data.token) {
      console.log('✅ JWT Token obtained:');
      console.log(loginResponse.data.token);
      console.log('\nCopy this token and use it in your tests:');
      console.log(`export AUTH_TOKEN="${loginResponse.data.token}"`);
    } else {
      console.log('❌ No token in response:', loginResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    console.log('\n💡 To get a JWT token:');
    console.log('1. Update the email/password in this script with your admin credentials');
    console.log('2. Or login through your web app and copy the token from browser storage');
    console.log('3. Or use an existing valid token if you have one');
  }
}

if (require.main === module) {
  getTestToken();
}

module.exports = { getTestToken };
