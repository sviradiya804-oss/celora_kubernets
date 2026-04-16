# Admin Authentication & Password Management Guide

## 📦 Overview

This guide covers the admin authentication and user password management functionality for the Celora admin panel.

---

## 🔐 Admin Login

### Endpoint
```http
POST /api/auth/admin/login
```

### Request Body
```json
{
  "email": "admin@example.com",
  "password": "admin_password"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "user": {
      "_id": "user_id",
      "name": "Admin Name",
      "email": "admin@example.com",
      "role": {
        "_id": "role_id",
        "name": "SUPERADMIN"
      }
    },
    "token": "jwt_token_here",
    "permissions": [...],
    "effectivePermissions": [...],
    "permissionsSource": "role",
    "isAdmin": true
  }
}
```

### Response (Failure - Not Admin)
```json
{
  "success": false,
  "error": "Access denied. Admin privileges required."
}
```

### Admin Roles
The following roles are considered admin roles:
- `SUPERADMIN`
- `ADMIN`
- `GHB Admin`
- Any role containing these keywords (case-insensitive)

---

## 🔑 Update User Password (Admin Only)

### Endpoint
```http
PUT /api/auth/admin/update-password/:userId
```

### Headers
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

### Request Body
```json
{
  "password": "newSecurePassword123",
  "sendEmail": false
}
```

### Parameters
- **password** (required): New password for the user (min 6 characters)
- **sendEmail** (optional): Whether to send notification email to user (default: false)

### Response (Success)
```json
{
  "success": true,
  "message": "Password updated successfully",
  "userId": "user_id",
  "email": "user@example.com"
}
```

### Response (Error)
```json
{
  "success": false,
  "error": "Password must be at least 6 characters long"
}
```

---

## 🔄 Complete Admin Workflow

### 1. Admin Login
```bash
curl -X POST http://localhost:3000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "pureyou@gmail.com",
    "password": "your_password"
  }'
```

### 2. Get User List
```bash
curl -X GET http://localhost:3000/api/user \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 3. Update User Password
```bash
curl -X PUT http://localhost:3000/api/auth/admin/update-password/USER_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "newPassword123",
    "sendEmail": false
  }'
```

---

## 📱 Integration with Admin Panel

### Frontend Implementation Example

#### Admin Login Form
```javascript
const handleAdminLogin = async (email, password) => {
  try {
    const response = await fetch('http://localhost:3000/api/auth/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success) {
      // Store token
      localStorage.setItem('adminToken', data.data.token);
      localStorage.setItem('adminUser', JSON.stringify(data.data.user));
      
      // Check if user is admin
      if (data.data.isAdmin) {
        // Redirect to admin dashboard
        window.location.href = '/admin/dashboard';
      } else {
        alert('Access denied. Admin privileges required.');
      }
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('An error occurred during login');
  }
};
```

#### Update Password Modal
```javascript
const handleUpdatePassword = async (userId, newPassword, sendEmail = false) => {
  const adminToken = localStorage.getItem('adminToken');

  try {
    const response = await fetch(
      `http://localhost:3000/api/auth/admin/update-password/${userId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          password: newPassword,
          sendEmail: sendEmail
        })
      }
    );

    const data = await response.json();

    if (data.success) {
      alert('Password updated successfully!');
      // Close modal, refresh user list, etc.
    } else {
      alert(data.error || 'Failed to update password');
    }
  } catch (error) {
    console.error('Error updating password:', error);
    alert('An error occurred');
  }
};
```

---

## 🎨 UI/UX Recommendations

### Admin Login Page
- Separate login page for admins: `/admin/login`
- Display "Admin Access" prominently
- Show error if non-admin tries to access
- Remember me functionality

### User Management Panel (as shown in screenshot)
- Display user list with actions
- "Update Password" button/icon in Actions column
- Modal dialog for password update with:
  - Password input field
  - Confirm password field
  - "Send email notification" checkbox
  - "Update" and "Cancel" buttons

### Password Update Modal Example
```html
<!-- Modal triggered by clicking password icon in user list -->
<div class="modal">
  <h3>Update Password for [User Name]</h3>
  
  <form onsubmit="handleUpdatePassword()">
    <div class="form-group">
      <label>New Password</label>
      <input type="password" 
             id="newPassword" 
             placeholder="Enter new password" 
             minlength="6" 
             required />
    </div>
    
    <div class="form-group">
      <label>Confirm Password</label>
      <input type="password" 
             id="confirmPassword" 
             placeholder="Confirm new password" 
             minlength="6" 
             required />
    </div>
    
    <div class="form-group">
      <label>
        <input type="checkbox" id="sendEmail" />
        Send notification email to user
      </label>
    </div>
    
    <div class="modal-actions">
      <button type="button" onclick="closeModal()">Cancel</button>
      <button type="submit">Update Password</button>
    </div>
  </form>
</div>
```

---

## 🔒 Security Features

### Password Validation
- Minimum 6 characters required
- Automatically hashed using bcrypt (salt rounds: 10)
- Never stored in plain text

### Authorization
- Admin login requires admin role
- Password update requires valid admin JWT token
- Token-based authentication for all admin actions

### Audit Trail (Recommended)
Consider logging password changes:
```javascript
{
  action: 'PASSWORD_UPDATE',
  adminId: 'admin_user_id',
  targetUserId: 'user_id',
  timestamp: new Date(),
  ipAddress: req.ip
}
```

---

## 📊 Postman Collection

**File**: `Admin_Authentication.postman_collection.json`

### How to Use:
1. Import collection into Postman
2. Set environment variables:
   - `base_url`: http://localhost:3000
   - `admin_token`: (auto-set after login)
   - `user_id`: User ID to update

3. Run requests in order:
   - **1. Admin Login** → Gets admin token
   - **2. Get All Users** → Lists users
   - **3. Update User Password** → Changes password

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Test admin login with valid admin credentials
- [ ] Test admin login with non-admin credentials (should fail)
- [ ] Test password update functionality
- [ ] Verify password is hashed in database
- [ ] Test email notification (if enabled)
- [ ] Verify JWT token expiration
- [ ] Test rate limiting on login endpoint
- [ ] Add admin activity logging
- [ ] Set up monitoring for failed login attempts
- [ ] Configure CORS for admin panel domain

---

## 🐛 Troubleshooting

### Issue: "Access denied. Admin privileges required"
**Solution**: Ensure the user's role is set to SUPERADMIN, ADMIN, or GHB Admin

### Issue: "Invalid email or password"
**Solution**: Verify credentials, check if password is correct in database

### Issue: "Password must be at least 6 characters"
**Solution**: Use a longer password (minimum 6 characters)

### Issue: Token expired
**Solution**: Login again to get a new token

---

## 📞 Support

For additional support or questions:
- Check the codebase documentation
- Review error logs in the server console
- Contact the development team

---

## ✅ Summary

You now have:
1. ✅ Admin login endpoint (`POST /api/auth/admin/login`)
2. ✅ Update password endpoint (`PUT /api/auth/admin/update-password/:userId`)
3. ✅ Role-based access control (admin roles only)
4. ✅ Password hashing and security
5. ✅ Optional email notifications
6. ✅ Postman collection for testing
7. ✅ Complete API documentation

**Ready for integration with your admin panel!** 🎉
