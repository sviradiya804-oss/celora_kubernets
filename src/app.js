require('dotenv').config();
require("./cron/exchangeRateCron");
require("./cron/dbBackupCron");

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const morgan = require('morgan');
const errorHandler = require('./middlewares/errorMiddleware');
const authRoutes = require('./routes/authRoutes');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const fs = require('fs');
const path = require('path');
const passport = require('passport');
require('./strategy/googleStrategy'); // Load strategy

const swaggerPath = path.resolve(__dirname, '../swagger.yaml');
const healthRouter = require('./routes/health');
const verifyRoute = require('./routes/verify');
const sitemapRoute = require("./routes/sitemapRoute");
const robotsRoute = require("./routes/robotsRoute");
const wishlistRoute = require('./routes/wishlistRoute');
const exportRoutes = require('./routes/exportRoutes');
const paymentRoutes = require('./routes/payment')
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/order');
const customerOrderRoutes = require('./routes/customerOrder');
const customerOrderAPI = require('./routes/customerOrderAPI');
const publicOrderTracking = require('./routes/publicOrderTracking');
const checkoutDirectRoutes = require('./routes/checkout-direct');
const checkoutWithPaymentRoutes = require('./routes/checkout-with-payment');
const dashboardRoutes = require("./routes/dashboard");
const logRoutes = require('./routes/adminLogRoutes');
const testEmailRoutes = require('./routes/testEmailRoutes');
const diamondRateRoute = require('./routes/diamondrateimportRoute');
const rbacRoutes = require('./routes/rbacRoutes');
const roleManagementRoutes = require('./routes/roleManagementRoutes');
const userPermissionRoutes = require('./routes/userPermissionRoutes');
const currencyRoutes = require('./routes/currencyRoutes');
const userProfileRoutes = require('./routes/userProfileRoutes');


// Currency conversion middlewares
const { resolveCurrency } = require('./middlewares/currencyMiddleware');
const { convertResponse } = require('./middlewares/responseConversionMiddleware');

const swaggerDocument = YAML.parse(fs.readFileSync(swaggerPath, 'utf8'));
const client = require('prom-client');
const protect = require('./middlewares/protect');
client.collectDefaultMetrics();

// Create custom counters if needed
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const app = express();

// Middlewares
app.use(helmet());

// Mount webhook route FIRST before JSON middleware
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// JSON parser for all other routes
app.use(express.json());

app.use(mongoSanitize());
app.use(xss());
app.use(hpp({
  whitelist: [
    'subType', 'category', 'diamondType', 'style', 'shape',
    'metal', 'metalType', 'metalColor', 'collection', 'occasion',
    'jewelryType', 'subCategory', 'width', 'carat'
  ]
}));

// Allow all origins for CORS
// Configure CORS to allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

// Prevent caching of authenticated API responses
app.use('/api', (req, res, next) => {
  if (req.headers.authorization) {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }
  next();
});

app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100
});
app.use(limiter);

// Apply currency resolution middleware globally to all /api routes
// This extracts currency preferences from query/headers/user profile
app.use('/api', resolveCurrency);
// Middleware to increment counter
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.labels(req.method, req.path, res.statusCode).inc();
  });
  next();
});

// Swagger Docs
app.get('/swagger.yaml', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../swagger.yaml'));
});

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(null, {
    swaggerUrl: '/swagger.yaml'
  })
);

// Routes
app.use('/api/v1/auth', authRoutes);

app.get('/api/status', protect, (req, res) => {
  res.json({ status: 'API is up and running' });
});
app.use('/', healthRouter);
app.use('/api', verifyRoute);
app.use("/", sitemapRoute);
app.use('/', robotsRoute);
app.use('/api/export', exportRoutes)
app.use('/api/currency', currencyRoutes)
app.use('/api/public', publicOrderTracking)
app.use('/api/payments', convertResponse, paymentRoutes)
app.use('/api/cart', convertResponse, cartRoutes)
app.use('/api/orders', convertResponse, orderRoutes)
app.use('/api/customer-order', convertResponse, customerOrderRoutes)
app.use('/api/customer/orders', convertResponse, customerOrderAPI)
app.use('/api/checkout-direct', convertResponse, checkoutDirectRoutes)
app.use('/api/cart/checkout-with-payment', convertResponse, checkoutWithPaymentRoutes)
app.use('/api/test-email', testEmailRoutes)
app.use('/invoices', express.static(path.join(__dirname, 'uploads/invoices')));
app.use("/api/dashboard", convertResponse, dashboardRoutes);
app.use('/api', logRoutes);
app.use('/api/wishlist', convertResponse, wishlistRoute);
app.use('/api/diamondrate', diamondRateRoute);
app.use('/api/v1/rbac', rbacRoutes);
const vendorRoutes = require('./routes/vendor.routes');
app.use('/api/vendor', vendorRoutes);
const groupPermissionRoutes = require('./routes/groupPermissionRoutes');
app.use('/api/permissions', groupPermissionRoutes);
app.use('/api/role-management', roleManagementRoutes);
app.use('/api/user-permissions', userPermissionRoutes);
app.use('/api/user-profile', userProfileRoutes);

app.use('/api', require('./routes/route'));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Error Middleware
app.use(errorHandler);

module.exports = app;
