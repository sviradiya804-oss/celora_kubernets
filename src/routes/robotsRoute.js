const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Use env variable to decide whether to allow crawlers
const ALLOW_CRAWLERS = process.env.ALLOW_CRAWLERS === 'true';

// Load the JSON config
let cachedRobotsContent;

if (!ALLOW_CRAWLERS) {
  // Block everything
  cachedRobotsContent = `User-agent: *
Disallow: /`;
} else {
  // Read the config file
  const config = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../config/robotsConfig.json'), 'utf-8')
  );

  // Build the robots.txt content
  let content = 'User-agent: *\nAllow: /\n\n';
  config.disallow.forEach((route) => {
    content += `Disallow: ${route}\n`;
  });
  content += '\n';
  config.allow.forEach((route) => {
    content += `Allow: ${route}\n`;
  });
  content += `\nSitemap: ${config.sitemap}\n`;

  cachedRobotsContent = content;
}

// Create the /robots.txt route
router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(cachedRobotsContent);
});

module.exports = router;
