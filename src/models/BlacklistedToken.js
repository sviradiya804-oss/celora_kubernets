
const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  blacklistedAt: { type: Date, default: Date.now },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Optional: For reference
  },
});

module.exports = mongoose.model('BlacklistedToken', blacklistedTokenSchema);
