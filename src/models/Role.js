const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  permissions: [{
    resource: {
      type: String,
      required: true
    },
    actions: [{
      type: String,
      required: true
    }],
    group: {
      type: String // Parent group for hierarchical permissions
    }
  }]
});

// Export both the schema and the model to prevent overwrite errors
module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema);
