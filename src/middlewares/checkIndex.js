const Schema = require('../models/schema');

exports.checkIndex = async (req, res, next) => {
  const indexName = req.params.indexName;
  console.log(indexName)

  if ( indexName === "user" || indexName === "product" || indexName === "payments" || indexName === "test-email")
  {
    return next();
  }
  if (Schema.hasOwnProperty(indexName)) {
    next();
  } else {
    res.status(404).json({
      statusCode: 404,
      error: 'Not Found',
      message: 'This endpoint has not been registered',
      details: {
        indexName: indexName
      },
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method
    });
  }
};
