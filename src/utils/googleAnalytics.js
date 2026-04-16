// utils/analytics.js
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const path = require('path');

const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: path.join(__dirname, '../config/service-account-key.json')
});

async function getAnalyticsData(fromDate = '30daysAgo', toDate = 'today') {
  const [response] = await analyticsDataClient.runReport({
    property: 'properties/496640971', //  Your GA4 Property ID
    dateRanges: [{ startDate: fromDate, endDate: toDate }],
    dimensions: [{ name: 'country' }],
    metrics: [{ name: 'activeUsers' }]
  });

  const data = response.rows.map((row) => ({
    country: row.dimensionValues[0].value,
    activeUsers: Number(row.metricValues[0].value)
  }));

  return data;
}

module.exports = {
  getAnalyticsData
};
