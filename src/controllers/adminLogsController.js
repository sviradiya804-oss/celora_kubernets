const UserLog = require('../models/userLog'); // Adjust path accordingly

exports.getAdminLogs = async (req, res) => {
  try {
    let { userId, actionType, modelName, limit = 50, skip = 0 } = req.query;

    limit = Math.min(parseInt(limit) || 50, 100); // max 100 to prevent abuse
    skip = parseInt(skip) || 0;

    const filter = {};

    if (userId) filter.userId = userId;
    if (actionType) filter.action = actionType;
    if (modelName) filter.collection = modelName;

    const logs = await UserLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .populate('userId', 'name email');

    res.status(200).json({ success: true, message: 'Fetched logs successfully', logs });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
};
