// require('dotenv').config();
const cron = require("node-cron");
const updateExchangeRates = require("../utils/exchangeRateUpdater");

// Runs every day at 12:00 AM server time
cron.schedule("0 0 * * *", async () => {
  console.log("🔁 CRON: Updating exchange rates...");
  await updateExchangeRates();
});

// Keep process alive if running standalone (e.g., PM2)
console.log("🕒 Exchange rate CRON scheduler started.");
