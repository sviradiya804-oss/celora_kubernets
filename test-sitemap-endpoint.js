/**
 * Test Script for Sitemap.xml Endpoint
 * Tests the dynamic sitemap generation with blog and jewelry slugs
 */

const mongoose = require('mongoose');
const { generateSitemap, getJewelryItems, getBlogPosts } = require('./src/controllers/sitemapController');

require('dotenv').config();

async function testSitemapEndpoint() {
  try {
    console.log('🚀 Testing Sitemap.xml Endpoint...\n');

    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Test getting jewelry items
    console.log('💎 Fetching jewelry items with slugs...');
    const jewelryItems = await getJewelryItems();
    console.log(`✅ Found ${jewelryItems.length} jewelry items with slugs`);
    if (jewelryItems.length > 0) {
      console.log('📋 Sample jewelry items:');
      jewelryItems.slice(0, 3).forEach((item, index) => {
        console.log(`   ${index + 1}. Slug: ${item.slug}, Priority: ${item.priority}, ChangeFreq: ${item.changefreq}`);
      });
    } else {
      console.log('⚠️  No jewelry items found with slugs!');
    }
    console.log('');

    // Test getting blog posts
    console.log('📝 Fetching blog posts with slugs...');
    const blogPosts = await getBlogPosts();
    console.log(`✅ Found ${blogPosts.length} blog posts with slugs`);
    if (blogPosts.length > 0) {
      console.log('📋 Sample blog posts:');
      blogPosts.slice(0, 3).forEach((item, index) => {
        console.log(`   ${index + 1}. Slug: ${item.slug}, Priority: ${item.priority}, ChangeFreq: ${item.changefreq}`);
      });
    } else {
      console.log('⚠️  No blog posts found with slugs!');
    }
    console.log('');

    // Generate full sitemap XML
    console.log('🗺️  Generating sitemap.xml...');
    const sitemap = await generateSitemap();
    console.log(`✅ Sitemap generated successfully!`);
    console.log(`📊 Sitemap size: ${(sitemap.length / 1024).toFixed(2)} KB\n`);

    // Show XML header and first few URLs
    console.log('📄 First 800 characters of sitemap.xml:');
    console.log('─'.repeat(80));
    console.log(sitemap.substring(0, 800));
    console.log('...\n');
    console.log('─'.repeat(80));

    // Summary
    console.log('\n📊 Summary:');
    console.log('─'.repeat(80));
    console.log(`Total Static Pages: 15`);
    console.log(`Total Jewelry Items: ${jewelryItems.length}`);
    console.log(`Total Blog Posts: ${blogPosts.length}`);
    console.log(`Total URLs in Sitemap: ${15 + jewelryItems.length + blogPosts.length}`);
    console.log(`Sitemap Size: ${(sitemap.length / 1024).toFixed(2)} KB`);
    console.log('─'.repeat(80));

    // Validation checks
    console.log('\n✅ Validation Checks:');
    console.log('─'.repeat(80));
    
    const hasXmlDeclaration = sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>');
    console.log(`XML Declaration: ${hasXmlDeclaration ? '✅ Valid' : '❌ Missing'}`);
    
    const hasUrlsetTag = sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    console.log(`URLset Tag: ${hasUrlsetTag ? '✅ Valid' : '❌ Missing'}`);
    
    const hasClosingTag = sitemap.endsWith('</urlset>');
    console.log(`Closing Tag: ${hasClosingTag ? '✅ Valid' : '❌ Missing'}`);
    
    const jewelryUrlCount = (sitemap.match(/\/jewelry\//g) || []).length;
    console.log(`Jewelry URLs: ${jewelryUrlCount} (Expected: ${jewelryItems.length})`);
    
    const blogUrlCount = (sitemap.match(/\/blog\//g) || []).length;
    console.log(`Blog URLs: ${blogUrlCount} (Expected: ${blogPosts.length})`);
    
    console.log('─'.repeat(80));

    // Endpoint information
    console.log('\n🌐 Endpoint Information:');
    console.log('─'.repeat(80));
    console.log('Main Sitemap: GET /sitemap.xml');
    console.log('Statistics: GET /sitemap-stats');
    console.log('Base URL: https://celorajewelry.com');
    console.log('\nSample URLs in sitemap:');
    console.log('  - https://celorajewelry.com/');
    console.log('  - https://celorajewelry.com/shop');
    if (jewelryItems.length > 0) {
      console.log(`  - https://celorajewelry.com/jewelry/${jewelryItems[0].slug}`);
    }
    if (blogPosts.length > 0) {
      console.log(`  - https://celorajewelry.com/blog/${blogPosts[0].slug}`);
    }
    console.log('─'.repeat(80));

    console.log('\n✨ Test completed successfully!\n');
    console.log('💡 To test the endpoint, run your server and visit:');
    console.log('   http://localhost:3000/sitemap.xml');
    console.log('   http://localhost:3000/sitemap-stats\n');

    // Close connection
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during sitemap test:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run test
testSitemapEndpoint();
