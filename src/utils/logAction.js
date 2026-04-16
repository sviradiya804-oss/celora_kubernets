const UserLog = require('../models/userLog');

async function logAction({ userId, userEmail, userRole, action, collection, payload }) {
  try {
    await UserLog.create({
      userId,
      userEmail,
      userRole,
      action,
      collection,
      payload,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Logging failed:', err);
  }
}


module.exports = logAction;