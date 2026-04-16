// Permission  // Price Management Group
// 'pricemanagement': ['exchangerate', 'metalPrice', 'otherPrice', 'labourcost', 'diamondmarkup', 'diamondrate'],roups Configuration
// Maps page groups to their child APIs/resources

const PAGE_GROUPS = {
  // Dashboard Group
  'dashboard': ['dashboard'],

  // Order Management Group  
  'ordermanagement': ['order', 'ordertracking', 'orderhistory', 'orderupdate', 'orderstatus'],

  // Shape Group
  'shape': ['shape'],

  // Diamonds Group
  'diamonds': ['diamond', 'helddiamond', 'shape', 'diamondimport', 'diamondexport', 'helddiamond'],

  // Held Diamonds Group
  'helddiamonds': ['helddiamond'],

  // Price Management Group
  'pricemanagement': ['shape', 'exchangerate', 'metalPrice', 'otherPrice', 'labourcost', 'diamondmarkup', 'diamondrate', 'shapegemstoneDR', 'shapegemstoneLC', 'ringsize'],

  // Jewelry Style Group
  'jewelrystyle': ['braceletsubtypelist', 'occasion', 'relation', 'engagementsubtypelist', 'weddingbandssubtypelist', 'pendentsubtypelist', 'earringssubtypelist', 'braceletsubtypelist'],

  // Add Jewelry Group
  'addjewelry': ['addjewelry', 'productcategory', 'productsubcategory', 'collection'],

  // Jeweleries Group
  'jeweleries': ['jewelry', 'jewelrystyle'],

  // Highlight Products Group
  'highlightproducts': ['highlight-engagement-products', 'highlight-earrings-products', 'highlight-pendant-products', 'highlight-bracelet-products', 'highlight-weddingbands-products'],

  // Vendors Group
  'vendors': ['vendor', 'vendorverification', 'vendordocument', 'admin'],

  // KYC Group
  'kyc': ['kyc'],

  // Category Group
  'category': ['category', 'productcategory'],

  // Subcategory Group
  'subcategory': ['subcategory', 'productsubcategory', 'inventory', 'product'],

  // FAQs Group
  'faqs': ['faq'],

  // Inquiry Group
  'inquiry': ['inquiry'],

  // Add Banners Group
  'addbanners': ['banner'],

  // Retailer Group
  'retailer': ['retailer'],

  // Coupons Group
  'coupons': ['coupon'],

  // Full Discount Group
  'full-discount': ['fulldiscount', 'discount', 'flatdiscount'],

  // Top Header Intro Group
  'top-header-intro': ['topheaderintro'],

  // Intro Popup Group
  'intro-popup': ['intropropup', 'introPopup'],

  // Promotional Stripe Group
  'promotional-stripe': ['promotionalstripe', 'promotionalStrip'],

  // Carat Size Group
  'carat-size': ['caratsize', 'carat-size'],

  // Subscribers Group
  'subscribers': ['subscribers', 'newsletter'],

  // User List Group
  'user-list': ['userlist'],

  // Packaging Group
  'packaging': ['packaging'],

  // Social Post Group
  'virtual-appointment': ['virtualappointments', 'virtualappointment'],

  // Add Blog Group
  'add-blog': ['addblog'],

  // Blog List Group
  'blog-list': ['blog', 'bloglist'],

  // Users Group
  'users': ['user', 'auth'],

  // Role & Permissions Group
  'role&permission': ['role', 'permission'],

  // Wishlist Group
  'wishlist': ['wishlist'],

  // Cart Group  
  'cart': ['cart'],

  // Payment Group
  'payment': ['payment', 'stripe', 'checkout'],

  // Contact Us Group
  'contactus': ['contactus']
};

// Reverse mapping: API/Resource -> Group
const RESOURCE_TO_GROUP = {};
Object.keys(PAGE_GROUPS).forEach(group => {
  PAGE_GROUPS[group].forEach(resource => {
    RESOURCE_TO_GROUP[resource] = group;
  });
});

// Public resources that GUEST users should have READ access to
const GUEST_PUBLIC_RESOURCES = [
  'jewelry', 'product', 'category', 'subcategory', 'collection',
  'blog', 'blog-list', 'faq', 'banner', 'highlightproducts',
  'relation', 'occasion', 'topheaderintro', 'intropopup',
  'promotionalstripe', 'pricemanagement', 'socialpost', 'packaging', 'carat-size', 'promotional-stripe', 'intro-popup', 'top-header-intro', 'full-discount', 'coupons', 'retailer', 'addbanners', 'inquiry', 'faqs', 'subcategory', 'category', 'jeweleries', 'addjewelry', 'shape', 'diamonds', 'helddiamonds',
  'dashboard', 'ordermanagement', 'shape', 'diamonds', 'helddiamonds', 'pricemanagement', 'jewelrystyle',
  'weddingbandssubtypelist', 'engagementsubtypelist',
  'productCategory', 'productcategory', 'earringssubtypelist', 'braceletsubtypelist', 'pendentsubtypelist', 'highlight-engagement-products', 'highlight-earrings-products', 'highlight-pendant-products', 'highlight-bracelet-products', 'highlight-weddingbands-products', 'metalprice',
  'addjewelry', 'jeweleries', 'highlightproducts', 'vendors', 'kyc', 'category', 'subcategory', 'faqs',
  'inquiry', 'addbanners', 'retailer', 'coupons', 'full-discount', 'top-header-intro', 'intro-popup',
  'promotional-stripe', 'carat-size', 'subscribers', 'user-list', 'packaging', 'socialpost',
  'virtual-appointment', 'add-blog', 'blog-list', 'users', 'role&permission', 'wishlist', 'cart',
  'payment', 'contactus', 'diamond', 'vendordiamond', 'vendorDiamond', 'promotionalStrip', 'promotionalStrip', 'exchangerate', 'shapegemstonedr',
  'promotionalimage', 'intropopup', 'intro_line'
];

// Get group for a resource
const getGroupForResource = (resource) => {
  return RESOURCE_TO_GROUP[resource] || null;
};

// Check if resource is public for GUEST users
const isPublicResource = (resource, action = 'read') => {
  const normalizedResource = (resource || '').toLowerCase();
  if (action === 'read' || (action === 'create' && normalizedResource === 'retailer')) {
    return GUEST_PUBLIC_RESOURCES.includes(normalizedResource);
  }
  return false;
};

// Get all resources in a group
const getResourcesInGroup = (group) => {
  return PAGE_GROUPS[group] || [];
};

module.exports = {
  PAGE_GROUPS,
  RESOURCE_TO_GROUP,
  GUEST_PUBLIC_RESOURCES,
  getGroupForResource,
  isPublicResource,
  getResourcesInGroup
};
