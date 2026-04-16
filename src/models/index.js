// models/index.js
const mongoose = require('mongoose');
const schemas = require('./schema.js'); // adjust path as needed

const models = {};

for (const [key, value] of Object.entries(schemas)) {
  // IMPORTANT: Skip the _imageFields metadata when creating Mongoose models
  if (key === '_imageFields') {
    continue;
  }

  // Ensure value is a valid schema definition object
  if (typeof value === 'object' && value !== null) {
    const schema = new mongoose.Schema(value, { timestamps: true });
    // Capitalize the model name (e.g., 'blog' -> 'Blog')
    const modelName = key.charAt(0).toUpperCase() + key.slice(1);
    models[modelName] = mongoose.model(modelName, schema);
  } else {
    console.warn(`Skipping invalid schema definition for key: ${key}`);
  }
}

module.exports = models;