const mongoose = require('mongoose');

const connectDB = async (maxRetries = 5, retryDelay = 5000) => {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      await mongoose.connect(process.env.DATABASE_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // Added: Timeout for server selection
        connectTimeoutMS: 10000,        // Added: Timeout for initial connection
      });
      console.log('MongoDB Connected');
      return; // Success: Exit the function
    } catch (err) {
      attempts++;
      console.error(`MongoDB Connection Attempt ${attempts} Failed: ${err.message}`);
      if (attempts >= maxRetries) {
        console.error('All retry attempts failed. Exiting process.');
        process.exit(1); // Exit if all retries fail
      }
      // Exponential backoff: Wait longer each time (e.g., 5s, 10s, 20s, etc.)
      const waitTime = retryDelay * Math.pow(2, attempts - 1);
      console.log(`Retrying in ${waitTime / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

module.exports = connectDB;
