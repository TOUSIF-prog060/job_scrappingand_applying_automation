#!/usr/bin/env node
/**
 * Standalone scraper runner — run from root:
 *   node backend/scripts/runScraper.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { runGreenhouseScraper } = require('../../scraper/greenhouseScraper');

runGreenhouseScraper()
  .then((result) => {
    console.log('\n✅ Scrape complete:', result);
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Scrape failed:', err.message);
    process.exit(1);
  });
