const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false }, // never return password in queries
    phone: { type: String }, // Add phone field for checkout
    contact: { type: String }, // Add contact field for checkout
    dateOfBirth: { type: Date },
    gender: { type: String },
    dateOfAnniversary: { type: Date },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
      default: function () {
        // Return the ObjectId of the GUEST role here
        // Example:
        return mongoose.Types.ObjectId('685ce3fd190d618f235dfb6c'); // default to GUEST role
        // Replace '60e8f6ce2e799a6cf0f4b43a' with the actual ObjectId of 'GUEST'
      }
    },
    googleId: { type: String }, // for future Google login

    // User-level permissions (overrides/additions to role permissions)
    permissions: [
      {
        resource: { type: String }, // e.g., 'blog', 'product', 'data'
        actions: [String] // e.g., ['create', 'read', 'update', 'delete']
      }
    ],

    // Stripe integration
    stripeCustomerId: { type: String }, // Store Stripe customer ID for saved payment methods

    // Billing Address
    billingAddress: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      postal_code: { type: String },
      country: { type: String, default: 'US' },
      phone: { type: String }, 
      email: { type: String, }
    },

    // Shipping Address
    shippingAddress: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      postal_code: { type: String },
      country: { type: String, default: 'US' },
      phone: { type: String }, 
      email: { type: String, }
    },

    // Currency Preferences
    preferredCurrency: {
      type: String,
      default: 'USD',
      uppercase: true
    },
    preferredCountry: {
      type: String,
      default: 'United States'
    },
    exchangeRate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'exchangerate'
    }, // Reference to user's preferred exchange rate

    // Reset password fields (moved inside schema definition)
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false }, // for email verification
    tokenVersion: { type: Number, default: 0 }, // Track token version for invalidation
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate reset token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and store in DB
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
