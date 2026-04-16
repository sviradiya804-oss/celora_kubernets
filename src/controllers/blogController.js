const Blog = require('../models/Blog');
const fs = require('fs');
const path = require('path');

// Create a new blog
exports.createBlog = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    const blog = new Blog({
      title,
      content,
      createdBy: req.user._id,
      image: req.file ? req.file.path : ''
    });

    const saved = await blog.save();
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
};

// Get all blogs
exports.getAllBlogs = async (req, res, next) => {
  try {
    const blogs = await Blog.find().populate('createdBy', 'name email');
    res.status(200).json(blogs);
  } catch (err) {
    next(err);
  }
};

// Get blog by ID
exports.getBlogById = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id).populate('createdBy', 'name email');
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.status(200).json(blog);
  } catch (err) {
    next(err);
  }
};

// Update a blog
exports.updateBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });

    // Optional: Only the creator can update
    if (blog.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    blog.title = req.body.title || blog.title;
    blog.content = req.body.content || blog.content;

    if (req.file) {
      // delete old image (optional)
      if (blog.image && fs.existsSync(blog.image)) {
        fs.unlinkSync(blog.image);
      }
      blog.image = req.file.path;
    }

    const updated = await blog.save();
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

// Delete a blog
exports.deleteBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });

    if (blog.image && fs.existsSync(blog.image)) {
      fs.unlinkSync(blog.image);
    }

    await blog.deleteOne();
    res.status(200).json({ message: 'Blog deleted' });
  } catch (err) {
    next(err);
  }
};
