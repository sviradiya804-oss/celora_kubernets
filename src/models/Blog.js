const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required']
    },
    content: {
      type: String,
      required: [true, 'Content is required']
    },
    image: {
      type: String, // Local path or future S3 URL
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Blog', blogSchema);
