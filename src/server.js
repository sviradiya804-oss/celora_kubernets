console.log('[INFO] Server version 1.0.2');
console.log('[TRACE] Starting server.js...');
try {
  require('dotenv').config();
} catch (error) {
  console.warn('[TRACE] dotenv not found, assuming environment variables are set.');
}
const app = require('./app');
const connectDB = require('./config/database');

// Connect to database
connectDB(3, 3000) // 3 retries, starting delay of 3 seconds
  .then(() => {
    console.log('[TRACE] Database connected successfully');

    // Start the server
    const PORT = process.env.PORT || 5001;
    const server = app.listen(PORT, () => {
      console.log(`[TRACE] Server running on port ${PORT}`);
    });

    // Graceful shutdown on errors
    process.on('unhandledRejection', (err) => {
      console.error(`[TRACE] Unhandled Promise Rejection: ${err.message}`);
      server.close(() => process.exit(1));
    });
  })
  .catch((err) => {
    console.error('[TRACE] Database connection failed:', err);
    process.exit(1);
  });

module.exports = app;