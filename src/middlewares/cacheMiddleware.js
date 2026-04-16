const redis = require('redis');

// Initialize Redis Client
let redisClient;

(async () => {
    try {
        redisClient = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

        redisClient.on('error', (err) => console.log('Redis Client Error', err));
        redisClient.on('connect', () => console.log('Connected to Redis'));

        await redisClient.connect();
    } catch (err) {
        console.error('Failed to initialize Redis:', err.message);
    }
})();

/**
 * Express Middleware to cache API responses.
 * Caches GET requests based on their original URL (including query string).
 * @param {number} duration - Cache duration in seconds (default: 3600 / 1 hr)
 */
const cacheMiddleware = (duration = 3600) => {
    return async (req, res, next) => {
        if (!redisClient || !redisClient.isReady) {
            console.log(`[Cache] Redis not available, falling back to database for ${req.originalUrl}`);
            return next();
        }

        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Extremely strict bypass for Checkout, Carts, Orders, and Users. 
        // We ONLY want to cache product catalog data (jewelry, diamonds, categories, etc).
        const forbiddenIndexes = ['cart', 'order', 'payment', 'user', 'customer', 'login', 'checkout'];
        if (req.params.indexName && forbiddenIndexes.includes(req.params.indexName.toLowerCase())) {
            return next();
        }

        // Do not cache authenticated user-specific requests
        if (req.headers.authorization) {
            return next();
        }

        const key = `celora:cache:${req.originalUrl}`;

        try {
            const cachedResponse = await redisClient.get(key);

            if (cachedResponse) {
                console.log(`[Cache] HIT for ${req.originalUrl}`);
                return res.status(200).json(JSON.parse(cachedResponse));
            }

            console.log(`[Cache] MISS for ${req.originalUrl}`);

            // Intercept res.json to cache the output before sending it to the client
            const originalJson = res.json.bind(res);
            res.json = (body) => {
                // Only cache successful responses (HTTP 200)
                if (res.statusCode === 200 && body) {
                    try {
                        redisClient.setEx(key, duration, JSON.stringify(body))
                            .catch(err => console.error(`[Cache] Redis SetEx Error (Safe Fallback):`, err.message));
                    } catch (e) {
                        console.error(`[Cache] Redis Set Sync Error (Safe Fallback):`, e.message);
                    }
                }

                // Return original function
                return originalJson(body);
            };

            next();
        } catch (error) {
            console.error(`[Cache] Middleware Error (Safe Fallback to DB):`, error.message);
            // Crucial: Fallback to the next middleware (database fetch) if Redis fails
            next();
        }
    };
};

/**
 * Clears keys matching a specific pattern.
 * Use when products are added/updated to invalidate the old cache list.
 */
const invalidateCache = async (pattern = 'celora:cache:/api/jewelry*') => {
    if (!redisClient || !redisClient.isReady) return;

    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
            console.log(`[Cache] Invalidated ${keys.length} keys matching ${pattern}`);
        }
    } catch (error) {
        console.error('Cache Invalidation Error:', error);
    }
};

module.exports = {
    cacheMiddleware,
    invalidateCache,
    redisClient
};
