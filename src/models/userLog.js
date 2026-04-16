const mongoose = require('mongoose');

const UserLogSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userEmail: { type: String }, // optional but helpful
  userRole: { type: String },  // optional but helpful for filtering
  action:   { type: String, enum: ['create', 'edit', 'update', 'delete', 'export', 'import', 'login', 'logout'], required: true },
  collection: { type: String, required: true },
  documentId: { type: String }, // Use String if your IDs aren't always ObjectId
  payload: { type: Object },    // For "CREATE" and "UPDATE", store full data or diff
  ip: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserLog', UserLogSchema);
