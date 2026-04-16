const mongoose = require('mongoose');
const Role = require('../models/Role');
const { GUEST_PUBLIC_RESOURCES, getGroupForResource } = require('../config/permissionGroups');

// Script to set up GUEST role with proper public permissions
async function setupGuestPermissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/celoradb');
    console.log('Connected to MongoDB');

    // Find or create GUEST role
    let guestRole = await Role.findOne({ name: 'GUEST' });
    
    if (!guestRole) {
      console.log('Creating GUEST role...');
      guestRole = new Role({
        name: 'GUEST',
        description: 'Public access role for unauthenticated users',
        permissions: []
      });
    } else {
      console.log('Updating existing GUEST role...');
    }

    // Clear existing permissions to rebuild
    guestRole.permissions = [];

    // Add read permissions for all public resources
    GUEST_PUBLIC_RESOURCES.forEach(resource => {
      const group = getGroupForResource(resource);
      guestRole.permissions.push({
        resource: resource,
        actions: ['read'],
        group: group
      });
    });

    // Save the role
    await guestRole.save();
    console.log(`GUEST role updated with ${guestRole.permissions.length} public permissions:`);
    
    guestRole.permissions.forEach(perm => {
      console.log(`  - ${perm.resource}: [${perm.actions.join(', ')}] (group: ${perm.group || 'none'})`);
    });

    console.log('GUEST permissions setup completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error setting up GUEST permissions:', error);
    process.exit(1);
  }
}

// Script to add group-wise permissions for admin roles
async function setupAdminGroupPermissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/celoradb');
    console.log('Connected to MongoDB');

    // Find ADMIN role
    let adminRole = await Role.findOne({ name: 'ADMIN' });
    
    if (!adminRole) {
      console.log('Creating ADMIN role...');
      adminRole = new Role({
        name: 'ADMIN',
        description: 'Administrator with full access',
        permissions: []
      });
    } else {
      console.log('Updating existing ADMIN role...');
    }

    // Add full group permissions for admin
    const adminGroups = [
      'dashboard', 'ordermanagement', 'diamonds', 'pricemanagement', 
      'jewelry', 'productmanagement', 'vendormanagement', 'contentmanagement',
      'usermanagement', 'marketing', 'configuration', 'wishlist', 'cart', 'payment'
    ];

    // Clear existing permissions to rebuild with groups
    adminRole.permissions = [];

    adminGroups.forEach(group => {
      adminRole.permissions.push({
        resource: group,
        actions: ['create', 'read', 'update', 'delete'],
        group: null // This is a parent group
      });
    });

    await adminRole.save();
    console.log(`ADMIN role updated with ${adminRole.permissions.length} group permissions`);
    
    console.log('Admin group permissions setup completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error setting up admin permissions:', error);
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'guest':
    setupGuestPermissions();
    break;
  case 'admin':
    setupAdminGroupPermissions();
    break;
  case 'all':
    setupGuestPermissions().then(() => setupAdminGroupPermissions());
    break;
  default:
    console.log('Usage:');
    console.log('  node setup-group-permissions.js guest  - Setup GUEST permissions');
    console.log('  node setup-group-permissions.js admin  - Setup ADMIN group permissions');
    console.log('  node setup-group-permissions.js all    - Setup both');
    process.exit(0);
}

module.exports = { setupGuestPermissions, setupAdminGroupPermissions };
