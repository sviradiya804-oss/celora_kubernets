/**
 * Test Script for Sitemap Generation
 * Run this to validate sitemap functionality
 */

const mongoose = require('mongoose');
const { generateSitemap, getJewelryItems, getBlogPosts } = require('./src/controllers/sitemapController');

require('dotenv').config();

async function testSitemap() {
  try {
    console.log('🚀 Starting Sitemap Test...\n');

    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Test getting jewelry items
    console.log('💎 Fetching jewelry items...');
    const jewelryItems = await getJewelryItems();
    console.log(`✅ Found ${jewelryItems.length} jewelry items`);
    if (jewelryItems.length > 0) {
      console.log('Sample jewelry item:', jewelryItems[0]);
    }
    console.log('');

    // Test getting blog posts
    console.log('📝 Fetching blog posts...');
    const blogPosts = await getBlogPosts();
    console.log(`✅ Found ${blogPosts.length} blog posts`);
    if (blogPosts.length > 0) {
      console.log('Sample blog post:', blogPosts[0]);
    }
    console.log('');

    // Generate full sitemap
    console.log('🗺️  Generating sitemap XML...');
    const sitemap = await generateSitemap();
    console.log(`✅ Sitemap generated (${sitemap.length} characters)`);
    console.log('\nFirst 500 characters of sitemap:');
    console.log(sitemap.substring(0, 500));
    console.log('...\n');

    // Summary
    console.log('📊 Summary:');
    console.log('─────────────────────────────');
    console.log(`Total Jewelry Items: ${jewelryItems.length}`);
    console.log(`Total Blog Posts: ${blogPosts.length}`);
    console.log(`Total URLs in Sitemap: ${15 + jewelryItems.length + blogPosts.length}`);
    console.log(`Sitemap Size: ${(sitemap.length / 1024).toFixed(2)} KB`);
    console.log('─────────────────────────────\n');

    // Check for items without slugs
    const JewelryModel = mongoose.models['jewelryModel'] || mongoose.model('jewelryModel', require('./src/models/schema')['jewelry'], 'jewelrys');
    const BlogModel = mongoose.models['blogModel'] || mongoose.model('blogModel', require('./src/models/schema')['blog'], 'blogs');
    
    const jewelryWithoutSlug = await JewelryModel.countDocuments({
      isDeleted: { $ne: true },
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: '' }
      ]
    });

    const blogsWithoutSlug = await BlogModel.countDocuments({
      isDeleted: { $ne: true },
      isActive: true,
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: '' }
      ]
    });

    if (jewelryWithoutSlug > 0 || blogsWithoutSlug > 0) {
      console.log('⚠️  Warning:');
      if (jewelryWithoutSlug > 0) {
        console.log(`   - ${jewelryWithoutSlug} jewelry items are missing slugs`);
      }
      if (blogsWithoutSlug > 0) {
        console.log(`   - ${blogsWithoutSlug} blog posts are missing slugs`);
      }
      console.log('   These items will not appear in the sitemap!\n');
    } else {
      console.log('✅ All items have slugs!\n');
    }

    console.log('✨ Test completed successfully!\n');

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
testSitemap();
