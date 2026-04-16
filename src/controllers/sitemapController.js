const mongoose = require('mongoose');
const Schema = require('../models/schema');

/**
 * Dynamic Sitemap Controller
 * Generates sitemap.xml with all jewelry and blog slugs
 * Optimized for SEO and search engine ranking
 */

/**
 * Get all active jewelry items with slugs
 * @returns {Promise<Array>} - Array of jewelry items with slug and update date
 */
async function getJewelryItems() {
  try {
    const JewelryModel =
      mongoose.models['jewelryModel'] ||
      mongoose.model('jewelryModel', Schema['jewelry'], 'jewelrys');

    const jewelryItems = await JewelryModel.find(
      {
        isDeleted: { $ne: true },
        slug: { $exists: true, $ne: null, $ne: '' }
      },
      {
        slug: 1,
        updatedOn: 1,
        createdOn: 1,
        _id: 0
      }
    )
      .sort({ updatedOn: -1 })
      .lean();

    return jewelryItems.map((item) => ({
      slug: item.slug,
      lastmod: item.updatedOn || item.createdOn,
      changefreq: 'weekly',
      priority: 0.8
    }));
  } catch (error) {
    console.error('Error fetching jewelry items for sitemap:', error);
    return [];
  }
}

/**
 * Get all active blog posts with slugs
 * @returns {Promise<Array>} - Array of blog posts with slug and update date
 */
async function getBlogPosts() {
  try {
    const BlogModel =
      mongoose.models['blogModel'] ||
      mongoose.model('blogModel', Schema['blog'], 'blogs');

    const blogPosts = await BlogModel.find(
      {
        isDeleted: { $ne: true },
        isActive: true,
        slug: { $exists: true, $ne: null, $ne: '' }
      },
      {
        slug: 1,
        updatedOn: 1,
        createdOn: 1,
        _id: 0
      }
    )
      .sort({ updatedOn: -1 })
      .lean();

    return blogPosts.map((post) => ({
      slug: post.slug,
      lastmod: post.updatedOn || post.createdOn,
      changefreq: 'monthly',
      priority: 0.7
    }));
  } catch (error) {
    console.error('Error fetching blog posts for sitemap:', error);
    return [];
  }
}

/**
 * Generate sitemap XML
 * @returns {Promise<String>} - XML string for sitemap
 */
async function generateSitemap() {
  const baseUrl = 'https://celorajewelry.com';

  // Static pages
  const staticPages = [
    { url: '/', changefreq: 'daily', priority: 1.0 },
    { url: '/about', changefreq: 'monthly', priority: 0.6 },
    { url: '/contact', changefreq: 'monthly', priority: 0.6 },
    { url: '/shop', changefreq: 'daily', priority: 0.9 },
    { url: '/engagement-rings', changefreq: 'weekly', priority: 0.9 },
    { url: '/wedding-bands', changefreq: 'weekly', priority: 0.9 },
    { url: '/pendants', changefreq: 'weekly', priority: 0.8 },
    { url: '/earrings', changefreq: 'weekly', priority: 0.8 },
    { url: '/bracelets', changefreq: 'weekly', priority: 0.8 },
    { url: '/blog', changefreq: 'weekly', priority: 0.7 },
    { url: '/customization', changefreq: 'monthly', priority: 0.7 },
    { url: '/ring-size-guide', changefreq: 'monthly', priority: 0.5 },
    { url: '/privacy-policy', changefreq: 'yearly', priority: 0.3 },
    { url: '/terms-of-service', changefreq: 'yearly', priority: 0.3 },
    { url: '/faq', changefreq: 'monthly', priority: 0.5 }
  ];

  // Fetch dynamic content
  const [jewelryItems, blogPosts] = await Promise.all([
    getJewelryItems(),
    getBlogPosts()
  ]);

  console.log(`Sitemap: Found ${jewelryItems.length} jewelry items and ${blogPosts.length} blog posts`);

  // Build XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Add static pages
  staticPages.forEach((page) => {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  });

  // Add jewelry items
  jewelryItems.forEach((item) => {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/jewelry/${item.slug}</loc>\n`;
    if (item.lastmod) {
      const lastmodDate = new Date(item.lastmod).toISOString().split('T')[0];
      xml += `    <lastmod>${lastmodDate}</lastmod>\n`;
    }
    xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
    xml += `    <priority>${item.priority}</priority>\n`;
    xml += '  </url>\n';
  });

  // Add blog posts
  blogPosts.forEach((post) => {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/blog/${post.slug}</loc>\n`;
    if (post.lastmod) {
      const lastmodDate = new Date(post.lastmod).toISOString().split('T')[0];
      xml += `    <lastmod>${lastmodDate}</lastmod>\n`;
    }
    xml += `    <changefreq>${post.changefreq}</changefreq>\n`;
    xml += `    <priority>${post.priority}</priority>\n`;
    xml += '  </url>\n';
  });

  xml += '</urlset>';

  return xml;
}

/**
 * Sitemap request handler
 */
const getSitemap = async (req, res) => {
  try {
    const xml = await generateSitemap();

    res.header('Content-Type', 'application/xml');
    res.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
};

/**
 * Get sitemap statistics (for admin/debugging)
 */
const getSitemapStats = async (req, res) => {
  try {
    const [jewelryItems, blogPosts] = await Promise.all([
      getJewelryItems(),
      getBlogPosts()
    ]);

    res.json({
      success: true,
      stats: {
        totalJewelryItems: jewelryItems.length,
        totalBlogPosts: blogPosts.length,
        totalUrls: 15 + jewelryItems.length + blogPosts.length, // 15 static pages
        lastGenerated: new Date().toISOString()
      },
      sampleJewelry: jewelryItems.slice(0, 5),
      sampleBlogs: blogPosts.slice(0, 5)
    });
  } catch (error) {
    console.error('Error getting sitemap stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting sitemap statistics'
    });
  }
};

/**
 * Get visual sitemap data (JSON)
 */
const getVisualSitemap = async (req, res) => {
  try {
    const fetchModelData = async (modelName, schemaKey, collectionName, query = { isDeleted: { $ne: true } }) => {
      const Model = mongoose.models[modelName] || mongoose.model(modelName, Schema[schemaKey], collectionName);
      return Model.find(query).sort({ sequence: 1 }).lean();
    };

    // Fetch all required data in parallel
    const [
      engagementStyles,
      weddingBandStyles,
      pendantStyles,
      earringStyles,
      braceletStyles,
      shapes,
      relations,
      occasions,
      jewelryProducts
    ] = await Promise.all([
      fetchModelData('engagementsubtypelistModel', 'engagementsubtypelist', 'engagementsubtypelists'),
      fetchModelData('weddingbandssubtypelistModel', 'weddingbandssubtypelist', 'weddingbandssubtypelists'),
      fetchModelData('pendentsubtypelistModel', 'pendentsubtypelist', 'pendentsubtypelists'),
      fetchModelData('earringssubtypelistModel', 'earringssubtypelist', 'earringssubtypelists'),
      fetchModelData('braceletsubtypelistModel', 'braceletsubtypelist', 'braceletsubtypelists'),
      fetchModelData('shapeModel', 'shape', 'shapes'),
      fetchModelData('relationModel', 'relation', 'relations'),
      fetchModelData('occasionModel', 'occasion', 'occasions'),
      fetchModelData('jewelryModel', 'jewelry', 'jewelrys', { isDeleted: { $ne: true } })
    ]);

    // Helper to format links
    const formatLink = (name, prefix) => ({
      name,
      url: `${prefix}/${name.toLowerCase().replace(/\s+/g, '-')}`
    });

    // Helper to get products by type
    const getProductsByType = (typeOrTypes, prefix) => {
      const types = Array.isArray(typeOrTypes) ? typeOrTypes : [typeOrTypes];
      return jewelryProducts
        .filter(p => types.includes(p.jewelryType))
        .slice(0, 10) // Limit to 10 products per category for the sitemap view
        .map(p => {
          // Convert slug to properly formatted title
          // e.g., "sylva-aara-diamond-earrings" => "Sylva Aara Diamond Earrings"
          const formattedName = p.slug
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          return {
            name: formattedName,
            url: `${prefix}/product-view/${p.slug}`
          };
        });
    };

    const sitemapData = [
      {
        title: "Engagement Rings",
        columns: [
          {
            subtitle: "Style",
            links: engagementStyles.map(s => formatLink(s.name, '/engagement-rings'))
          },
          {
            subtitle: "Shape",
            links: shapes.map(s => ({
              name: `${s.name} Engagement Rings`,
              url: `/engagement-rings/${s.name.toLowerCase()}`
            }))
          },
          {
            subtitle: "Products",
            links: getProductsByType(['Engagement Ring', 'Engagement Rings'], '/engagement-ring')
          }
        ]
      },
      {
        title: "Wedding Ring Bands",
        columns: [
          {
            subtitle: "Style",
            links: weddingBandStyles.map(s => formatLink(s.name, '/wedding-bands'))
          },
          {
            subtitle: "Shape",
            links: shapes.map(s => ({
              name: `${s.name} Wedding Ring Bands`,
              url: `/wedding-bands/${s.name.toLowerCase()}`
            }))
          },
          {
            subtitle: "Products",
            links: getProductsByType(['Wedding Ring', 'Wedding Bands', 'Wedding Band'], '/wedding-bands')
          }
        ]
      },
      {
        title: "Diamond Earrings",
        columns: [
          {
            subtitle: "Style",
            links: earringStyles.map(s => formatLink(s.name, '/earrings'))
          },
          {
            subtitle: "Shape",
            links: shapes.map(s => ({
              name: `${s.name} Diamond Earrings`,
              url: `/earrings/${s.name.toLowerCase()}`
            }))
          },
          {
            subtitle: "Products",
            links: getProductsByType(['Earrings', 'Earring'], '/diamond-earring')
          }
        ]
      },
      {
        title: "Diamond Bracelets",
        columns: [
          {
            subtitle: "Style",
            links: braceletStyles.map(s => formatLink(s.name, '/bracelets'))
          },
          {
            subtitle: "Shape",
            links: shapes.map(s => ({
              name: `${s.name} Diamond Bracelets`,
              url: `/bracelets/${s.name.toLowerCase()}`
            }))
          },
          {
            subtitle: "Products",
            links: getProductsByType(['Bracelet', 'Bracelets'], '/bracelets')
          }
        ]
      },
      {
        title: "Necklaces",
        columns: [
          {
            subtitle: "Style",
            links: pendantStyles.map(s => formatLink(s.name, '/necklace'))
          },
          {
            subtitle: "Shape",
            links: shapes.map(s => ({
              name: `${s.name} Necklaces`,
              url: `/necklace/${s.name.toLowerCase()}`
            }))
          },
          {
            subtitle: "Products",
            links: getProductsByType(['Necklace', 'Necklaces'], '')
          }
        ]
      },
      {
        title: "Pendants",
        columns: [
          {
            subtitle: "Style",
            links: pendantStyles.map(s => formatLink(s.name, '/pendants'))
          },
          {
            subtitle: "Shape",
            links: shapes.map(s => ({
              name: `${s.name} Pendants`,
              url: `/pendants/${s.name.toLowerCase()}`
            }))
          },
          {
            subtitle: "Products",
            links: getProductsByType(['Pendant', 'Pendants'], '/pendants')
          }
        ]
      },
      {
        title: "Gifting",
        columns: [
          {
            subtitle: "Shop By Relationship",
            links: relations.map(r => formatLink(r.name, ''))
          },
          {
            subtitle: "Shop By Occasion",
            links: occasions.map(o => formatLink(o.name, ''))
          },
          {
            subtitle: "Shop By Category",
            links: [
              { name: "Rings", url: "/rings" },
              { name: "Earrings", url: "/earrings" },
              { name: "Bracelets", url: "/bracelets" },
              { name: "Necklaces", url: "/necklaces" },
              { name: "Pendants", url: "/pendants" }
            ]
          },
          {
            subtitle: "Shop By Price",
            links: [
              { name: "Under $500", url: "/jewelry-all/under-five-hundred-dollars" },
              { name: "Under $1000", url: "/jewelry-all/under-one-thousand-dollars" },
              { name: "Under $1500", url: "/jewelry-all/under-one-thousand-five-hundred-dollars" },
              { name: "Over $2000", url: "/jewelry-all/over-two-thousand-dollars" }
            ]
          }
        ]
      },
      {
        title: "Customization",
        columns: [
          {
            subtitle: "",
            links: [
              { name: "Start With Ring Setting", url: "/customization/start-with-setting" },
              { name: "Select Your Flawless Diamond", url: "/customization/select-diamond" }
            ]
          }
        ]
      },
      {
        title: "Others",
        columns: [
          {
            subtitle: "",
            links: [
              { name: "About Us", url: "/about-us" },
              { name: "FAQs", url: "/faqs" },
              { name: "Find Your Ring Size", url: "/ring-size-guide" },
              { name: "CSR", url: "/csr" },
              { name: "Blog", url: "/blog" },
              { name: "Wishlist", url: "/wishlist" },
              { name: "Virtual Appointment", url: "/virtual-appointment" },
              { name: "Careers", url: "/careers" }
            ]
          }
        ]
      }
    ];

    res.json({ success: true, data: sitemapData });
  } catch (error) {
    console.error('Error generating visual sitemap:', error);
    res.status(500).json({ success: false, message: 'Error generating visual sitemap' });
  }
};

module.exports = {
  getSitemap,
  getSitemapStats,
  generateSitemap,
  getJewelryItems,
  getBlogPosts,
  getVisualSitemap
};
