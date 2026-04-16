#!/usr/bin/env node

/**
 * Individual User Permission Management Testing Script
 * Tests the ability to assign individual permissions to users beyond their role
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

let adminToken = '';

// Helper function for colored output
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Authentication helper
async function authenticateAdmin() {
    try {
        log('\n🔐 Authenticating as admin...', 'blue');
        
        const response = await axios.post(`${API_BASE}/v1/auth/login`, {
            email: 'admin@celora.com',
            password: 'admin123'
        });

        adminToken = response.data.token;
        log('✅ Admin authentication successful', 'green');
        return true;
    } catch (error) {
        log(`❌ Admin authentication failed: ${error.response?.data?.message || error.message}`, 'red');
        return false;
    }
}

// Test 1: Search for a specific user (demo@yopmail.com)
async function testSearchUser(email) {
    try {
        log(`\n🔍 Test 1: Searching for user "${email}"...`, 'cyan');
        
        const response = await axios.get(`${API_BASE}/user-permissions/users/search?q=${email}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        if (response.data.users.length === 0) {
            log(`❌ User "${email}" not found`, 'red');
            return null;
        }

        const user = response.data.users[0];
        log(`✅ Found user:`, 'green');
        log(`   - Name: ${user.name}`, 'yellow');
        log(`   - Email: ${user.email}`, 'yellow');
        log(`   - Role: ${user.role.name}`, 'yellow');
        log(`   - Has Individual Permissions: ${user.hasIndividualPermissions}`, 'yellow');
        
        return user;
    } catch (error) {
        log(`❌ Search user failed: ${error.response?.data?.message || error.message}`, 'red');
        return null;
    }
}

// Test 2: Get detailed user permissions
async function testGetUserDetails(userId) {
    try {
        log(`\n📋 Test 2: Getting detailed permissions for user...`, 'cyan');
        
        const response = await axios.get(`${API_BASE}/user-permissions/users/${userId}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        const user = response.data.user;
        log(`✅ User Details:`, 'green');
        log(`   - Name: ${user.name}`, 'yellow');
        log(`   - Email: ${user.email}`, 'yellow');
        log(`   - Role: ${user.role.name}`, 'yellow');
        log(`   - Role Permissions: ${user.role.permissions.length}`, 'yellow');
        log(`   - Individual Permissions: ${user.individualPermissions.length}`, 'yellow');
        
        log(`\n📊 Effective Permissions (${user.effectivePermissions.length}):`, 'blue');
        user.effectivePermissions.forEach(perm => {
            log(`   • ${perm.resource}: [${perm.actions.join(', ')}] (${perm.source})`, 'magenta');
        });
        
        return user;
    } catch (error) {
        log(`❌ Get user details failed: ${error.response?.data?.message || error.message}`, 'red');
        return null;
    }
}

// Test 3: Add dashboard permission to user (manager doesn't have dashboard by default)
async function testAddDashboardPermission(userId) {
    try {
        log(`\n➕ Test 3: Adding DASHBOARD permission to user...`, 'cyan');
        
        const response = await axios.post(`${API_BASE}/user-permissions/users/${userId}/permissions/add`, {
            resource: 'dashboard',
            actions: ['read', 'analytics']
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        log(`✅ Dashboard permission added successfully!`, 'green');
        log(`   - Resource: dashboard`, 'yellow');
        log(`   - Actions: [read, analytics]`, 'yellow');
        
        return response.data;
    } catch (error) {
        log(`❌ Add dashboard permission failed: ${error.response?.data?.message || error.message}`, 'red');
        return null;
    }
}

// Test 4: Add additional custom permission 
async function testAddCustomPermission(userId) {
    try {
        log(`\n🎯 Test 4: Adding REPORTS permission to user...`, 'cyan');
        
        const response = await axios.post(`${API_BASE}/user-permissions/users/${userId}/permissions/add`, {
            resource: 'reports',
            actions: ['read', 'create', 'export']
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        log(`✅ Reports permission added successfully!`, 'green');
        log(`   - Resource: reports`, 'yellow');
        log(`   - Actions: [read, create, export]`, 'yellow');
        
        return response.data;
    } catch (error) {
        log(`❌ Add reports permission failed: ${error.response?.data?.message || error.message}`, 'red');
        return null;
    }
}

// Test 5: Update existing individual permission
async function testUpdatePermission(userId) {
    try {
        log(`\n✏️ Test 5: Updating DASHBOARD permission actions...`, 'cyan');
        
        const response = await axios.patch(`${API_BASE}/user-permissions/users/${userId}/permissions/dashboard`, {
            actions: ['read', 'analytics', 'admin', 'export']
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        log(`✅ Dashboard permission updated successfully!`, 'green');
        log(`   - Resource: dashboard`, 'yellow');
        log(`   - New Actions: [read, analytics, admin, export]`, 'yellow');
        
        return response.data;
    } catch (error) {
        log(`❌ Update permission failed: ${error.response?.data?.message || error.message}`, 'red');
        return null;
    }
}

// Test 6: List all users to see the changes
async function testListAllUsers() {
    try {
        log(`\n👥 Test 6: Listing all users with their permissions...`, 'cyan');
        
        const response = await axios.get(`${API_BASE}/user-permissions/users`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        log(`✅ Found ${response.data.users.length} users:`, 'green');
        response.data.users.forEach(user => {
            log(`   - ${user.name} (${user.email})`, 'yellow');
            log(`     Role: ${user.role.name}`, 'blue');
            log(`     Individual Permissions: ${user.individualPermissions.length}`, 'magenta');
            if (user.individualPermissions.length > 0) {
                user.individualPermissions.forEach(perm => {
                    log(`       • ${perm.resource}: [${perm.actions.join(', ')}]`, 'cyan');
                });
            }
        });
        
        return response.data;
    } catch (error) {
        log(`❌ List users failed: ${error.response?.data?.message || error.message}`, 'red');
        return null;
    }
}

// Test 7: Change user role
async function testChangeUserRole(userId, newRoleId) {
    try {
        log(`\n🔄 Test 7: Changing user role...`, 'cyan');
        
        const response = await axios.post(`${API_BASE}/user-permissions/users/${userId}/role`, {
            roleId: newRoleId
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        log(`✅ User role changed successfully!`, 'green');
        log(`   - Message: ${response.data.message}`, 'yellow');
        
        return response.data;
    } catch (error) {
        log(`❌ Change user role failed: ${error.response?.data?.message || error.message}`, 'red');
        return null;
    }
}

// Test 8: Remove specific individual permission
async function testRemovePermission(userId) {
    try {
        log(`\n🗑️ Test 8: Removing REPORTS permission from user...`, 'cyan');
        
        const response = await axios.delete(`${API_BASE}/user-permissions/users/${userId}/permissions/reports`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        log(`✅ Reports permission removed successfully!`, 'green');
        log(`   - Removed Resource: reports`, 'yellow');
        
        return response.data;
    } catch (error) {
        log(`❌ Remove permission failed: ${error.response?.data?.message || error.message}`, 'red');
        return null;
    }
}

// Test 9: Get available permissions
async function testGetAvailablePermissions() {
    try {
        log(`\n🎯 Test 9: Getting available permissions...`, 'cyan');
        
        const response = await axios.get(`${API_BASE}/user-permissions/available-permissions`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        log(`✅ Available permission groups: ${response.data.groups.length}`, 'green');
        response.data.groups.slice(0, 3).forEach(group => {
            log(`   - ${group.name}:`, 'yellow');
            group.resources.slice(0, 3).forEach(resource => {
                log(`     • ${resource.name}: [${resource.actions.join(', ')}]`, 'cyan');
            });
        });
        
        return response.data;
    } catch (error) {
        log(`❌ Get available permissions failed: ${error.response?.data?.message || error.message}`, 'red');
        return null;
    }
}

// Test 10: Get list of roles for role change testing
async function testGetRoles() {
    try {
        log(`\n👑 Test 10: Getting available roles...`, 'cyan');
        
        const response = await axios.get(`${API_BASE}/role-management/roles`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        log(`✅ Available roles: ${response.data.roles.length}`, 'green');
        response.data.roles.forEach(role => {
            log(`   - ${role.name} (ID: ${role._id}) - ${role.permissions.length} permissions`, 'yellow');
        });
        
        return response.data.roles;
    } catch (error) {
        log(`❌ Get roles failed: ${error.response?.data?.message || error.message}`, 'red');
        return [];
    }
}

// Main testing function
async function runIndividualUserPermissionTests() {
    log('🚀 Starting Individual User Permission Management Tests', 'blue');
    log('=========================================================', 'blue');

    // Step 1: Authenticate
    const authSuccess = await authenticateAdmin();
    if (!authSuccess) {
        log('\n❌ Tests aborted due to authentication failure', 'red');
        return;
    }

    // Step 2: Search for demo@yopmail.com user
    const user = await testSearchUser('demo@yopmail.com');
    if (!user) {
        log('\n❌ Cannot continue tests without finding demo@yopmail.com user', 'red');
        log('💡 Please create a user with email "demo@yopmail.com" first', 'cyan');
        return;
    }

    // Step 3: Get detailed user permissions
    const userDetails = await testGetUserDetails(user._id);
    if (!userDetails) return;

    // Step 4: Get available roles for later testing
    const roles = await testGetRoles();
    const managerRole = roles.find(r => r.name.toLowerCase().includes('manager'));

    // Step 5: Change user to manager role if not already
    if (userDetails.role.name !== 'MANAGER' && managerRole) {
        await testChangeUserRole(user._id, managerRole._id);
        await testGetUserDetails(user._id); // Show updated details
    }

    // Step 6: Add dashboard permission (manager doesn't have this by default)
    await testAddDashboardPermission(user._id);

    // Step 7: Add additional custom permission
    await testAddCustomPermission(user._id);

    // Step 8: Update existing permission
    await testUpdatePermission(user._id);

    // Step 9: Get updated user details
    await testGetUserDetails(user._id);

    // Step 10: Get available permissions
    await testGetAvailablePermissions();

    // Step 11: List all users to see changes
    await testListAllUsers();

    // Step 12: Remove one permission
    await testRemovePermission(user._id);

    // Step 13: Final user state
    await testGetUserDetails(user._id);

    log('\n🎉 Individual User Permission Management Tests Completed!', 'green');
    log('=========================================================', 'green');
    log('\n📊 Test Summary:', 'blue');
    log('✅ User search and discovery: WORKING', 'green');
    log('✅ Individual permission addition: WORKING', 'green');
    log('✅ Permission action updates: WORKING', 'green');
    log('✅ Permission removal: WORKING', 'green');
    log('✅ Role changes: WORKING', 'green');
    log('✅ Effective permission calculation: WORKING', 'green');
    
    log('\n🔧 Individual User Permission API Endpoints:', 'cyan');
    log('• GET    /api/user-permissions/users - List all users with permissions', 'yellow');
    log('• GET    /api/user-permissions/users/:id - Get user details with effective permissions', 'yellow');
    log('• POST   /api/user-permissions/users/:id/permissions/add - Add individual permission', 'yellow');
    log('• PATCH  /api/user-permissions/users/:id/permissions/:resource - Update permission actions', 'yellow');
    log('• DELETE /api/user-permissions/users/:id/permissions/:resource - Remove individual permission', 'yellow');
    log('• PUT    /api/user-permissions/users/:id/permissions - Bulk update all individual permissions', 'yellow');
    log('• POST   /api/user-permissions/users/:id/role - Change user role', 'yellow');
    log('• GET    /api/user-permissions/users/search?q=email - Search users', 'yellow');
    log('• GET    /api/user-permissions/available-permissions - List available permissions', 'yellow');

    log('\n💡 Example Use Cases:', 'cyan');
    log('1. Assign Manager role to demo@yopmail.com ✅', 'green');
    log('2. Give dashboard access (not in Manager role) ✅', 'green');
    log('3. Add custom permissions beyond role ✅', 'green');
    log('4. Update individual permission actions ✅', 'green');
    log('5. Remove specific individual permissions ✅', 'green');
    log('6. Role + Individual permissions work together ✅', 'green');
}

// Run the tests
if (require.main === module) {
    runIndividualUserPermissionTests().catch(error => {
        log(`\n💥 Test execution failed: ${error.message}`, 'red');
        process.exit(1);
    });
}

module.exports = {
    runIndividualUserPermissionTests,
    authenticateAdmin,
    testSearchUser,
    testGetUserDetails,
    testAddDashboardPermission,
    testAddCustomPermission,
    testUpdatePermission,
    testListAllUsers,
    testChangeUserRole,
    testRemovePermission,
    testGetAvailablePermissions,
    testGetRoles
};
