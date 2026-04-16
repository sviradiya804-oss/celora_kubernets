const axios = require('axios');
const mongoose = require('mongoose');

const models = require('../models');
const ExchangeRate = models.Exchangerate;

const getSymbolFromLib = require('currency-symbol-map');

const API_URL = 'https://open.er-api.com/v6/latest/USD';
const BASE = 'USD';

const getSymbol = (code) => {
  return getSymbolFromLib(code) || code;
};

const getFlagUrl = (currencyCode) => {
  // Map common currencies to country codes for flagcdn
  const currencyToCountry = {
    USD: 'us',
    EUR: 'eu',
    GBP: 'gb',
    INR: 'in',
    JPY: 'jp',
    AUD: 'au',
    CAD: 'ca',
    CNY: 'cn',
    HKD: 'hk',
    NZD: 'nz',
    SGD: 'sg',
    CHF: 'ch',
    ZAR: 'za',
    RUB: 'ru',
    BRL: 'br',
    MXN: 'mx',
    ILS: 'il',
    KRW: 'kr',
    PLN: 'pl',
    SEK: 'se',
    TRY: 'tr',
    AED: 'ae',
    SAR: 'sa',
    THB: 'th',
    MYR: 'my',
    IDR: 'id',
    PHP: 'ph',
    VND: 'vn',
    NGN: 'ng',
    EGP: 'eg',
    PKR: 'pk',
    BDT: 'bd'
  };

  const countryCode = currencyToCountry[currencyCode] || currencyCode.slice(0, 2).toLowerCase();
  return `https://flagcdn.com/w320/${countryCode}.png`;
};

// Retry Logic with exponential backoff
const fetchWithRetry = async (url, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🌐 Attempt ${attempt} to fetch exchange rates...`);
      const response = await axios.get(url);
      return response;
    } catch (err) {
      console.warn(`⚠️ Attempt ${attempt} failed: ${err.message}`);
      if (attempt === maxRetries) throw new Error('❌ Max retries reached. API failed.');
      await new Promise((res) => setTimeout(res, delay * attempt)); // Exponential backoff
    }
  }
};

const updateExchangeRates = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('❌ MongoDB not connected. Make sure to connect in server.js');
    }

    const records = await ExchangeRate.find({ isActive: true });
    const currencyCodes = records.map((r) => r.currencyCode).filter(Boolean);

    if (currencyCodes.length === 0) {
      console.warn('⚠️ No active currencies found.');
      return;
    }

    // Open Exchange Rate API returns all rates, no need to filter by symbols in URL
    const url = API_URL;

    const response = await fetchWithRetry(url);
    const { rates } = response.data;

    if (!rates) throw new Error('❌ Invalid response from Exchange Rate API');

    for (let item of records) {
      const code = item.currencyCode;
      let rate = rates[code];

      if (code === BASE) {
        rate = 1;
      }

      let updated = false;

      // Update flag if missing or if it's just a code (not a URL)
      if (code && (!item.flags || !item.flags.includes('://'))) {
        item.flags = getFlagUrl(code);
        updated = true;
      }

      if (code && (code === BASE || rate)) {
        item.rate = rate;
        if (!item.symbol) item.symbol = getSymbol(code);
        updated = true;
      } else {
        console.warn(`⚠️ No rate found for ${item.country} (${code})`);
      }

      if (updated) {
        item.updatedOn = new Date();
        item.updatedBy = item.updatedBy || null;
        await item.save();
        console.log(`✅ Updated ${code}: Rate=${rate || 'N/A'}, Flag=${item.flags}`);
      }
    }

    console.log('🎉 Exchange rate update complete.');
  } catch (err) {
    console.error('❌ Error updating exchange rates:', err.message);
  }
};

module.exports = updateExchangeRates;