const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    statusCode,
    error: err.name || 'Error',
    message: err.message || 'An unexpected error occurred',
    details: err.details || null,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    requestId: req.id || null // if using request ID middleware
  });
};

module.exports = errorHandler;
