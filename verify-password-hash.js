const mongoose = require('mongoose');
require('dotenv').config();

// Import User model
const User = require('./src/models/User');

async function verifyPasswordHash() {
  try {
    // Connect to MongoDB
    const dbUri = process.env.MONGODB_URI || process.env.DATABASE_URI;
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find the test admin user
    const user = await User.findById('6914705c90a5d4bd0a7798f3').select('+password');
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 USER PASSWORD VERIFICATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 User:', user.email);
    console.log('🆔 User ID:', user._id);
    console.log('\n🔐 PASSWORD STORED IN DATABASE:');
    console.log(user.password);
    
    // Check if password starts with bcrypt hash format
    const isBcryptHash = user.password.startsWith('$2a$') || user.password.startsWith('$2b$');
    console.log('\n✅ Is bcrypt hash format:', isBcryptHash ? 'YES ✓' : 'NO ✗');
    
    if (isBcryptHash) {
      console.log('✅ Password hash format: bcrypt');
      console.log('✅ Hash version:', user.password.substring(0, 4));
      console.log('✅ Salt rounds:', user.password.substring(4, 6));
      console.log('✅ Hash length:', user.password.length, 'characters');
      console.log('\n🎉 PASSWORD IS PROPERLY HASHED AND SECURE!');
    } else {
      console.log('❌ WARNING: Password is NOT properly hashed!');
      console.log('❌ This is a security risk!');
    }
    
    // Test the matchPassword method
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 TESTING PASSWORD VERIFICATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const correctPasswordMatch = await user.matchPassword('newpassword456');
    const wrongPasswordMatch = await user.matchPassword('wrongpassword');
    
    console.log('✅ Correct password (newpassword456):', correctPasswordMatch ? 'MATCH ✓' : 'NO MATCH ✗');
    console.log('❌ Wrong password (wrongpassword):', wrongPasswordMatch ? 'MATCH (BAD!)' : 'NO MATCH ✓');
    
    if (correctPasswordMatch && !wrongPasswordMatch) {
      console.log('\n🎉 PASSWORD VERIFICATION IS WORKING CORRECTLY!');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

verifyPasswordHash();
