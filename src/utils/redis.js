const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    tls: process.env.REDIS_URL?.startsWith('rediss://'), // enable TLS only for rediss
    keepAlive: 30000 // optional but good for cloud
  }
});

redisClient.on('error', (err) => console.error(' Redis Error:', err));

redisClient.connect()
  .then(() => console.log(' Redis connected'))
  .catch(err => console.error(' Redis connection failed:', err));

module.exports = redisClient;
