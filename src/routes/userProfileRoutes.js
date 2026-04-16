/**
 * User Profile Routes
 * Provides endpoints for user profile management including:
 * - GET /profile - Get complete user profile with addresses
 * - PUT /profile - Update profile information
 * - GET /orders - Get user's order history (previous purchases)
 * - PUT /password - Change password
 * - PUT /addresses - Update billing/shipping addresses
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { protect } = require('../middlewares/authMiddleware');
const User = require('../models/User');
const Schema = require('../models/schema');

// Get Order model
const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');

/**
 * @route   GET /api/user-profile/profile
 * @desc    Get authenticated user's complete profile
 * @access  Private
 */
router.get('/profile', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId)
            .select('-password -resetPasswordToken -resetPasswordExpire -__v')
            .populate('role', 'name permissions');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone || null,
                contact: user.contact || null,
                role: user.role,
                isActive: user.isActive,
                isVerified: user.isVerified,
                billingAddress: user.billingAddress || null,
                shippingAddress: user.shippingAddress || null,
                preferredCurrency: user.preferredCurrency || 'USD',
                preferredCountry: user.preferredCountry || 'United States',
                dateOfBirth: user.dateOfBirth,
                gender: user.gender,
                dateOfAnniversary: user.dateOfAnniversary,
                hasStripeCustomer: !!user.stripeCustomerId,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch profile',
            message: error.message
        });
    }
});

/**
 * @route   PUT /api/user-profile/profile
 * @desc    Update user profile (name, phone, contact)
 * @access  Private
 */
router.put('/profile', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            name,
            phone,
            contact,
            preferredCurrency,
            preferredCountry,
            dateOfBirth,
            gender,
            dateOfAnniversary
        } = req.body;

        // Helper to parse DD-MM-YYYY to Date object
        const parseDate = (dateStr) => {
            if (!dateStr) return undefined;
            // Check if matches DD-MM-YYYY
            if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
                const [day, month, year] = dateStr.split('-');
                return new Date(`${year}-${month}-${day}`);
            }
            return dateStr; // Let Mongoose handle other formats (ISO, etc.)
        };

        const updateData = {};
        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        if (contact) updateData.contact = contact;
        if (preferredCurrency) updateData.preferredCurrency = preferredCurrency;
        if (preferredCountry) updateData.preferredCountry = preferredCountry;

        // Add new fields
        if (dateOfBirth) updateData.dateOfBirth = parseDate(dateOfBirth);
        if (gender) updateData.gender = gender;
        if (dateOfAnniversary) updateData.dateOfAnniversary = parseDate(dateOfAnniversary);

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password -resetPasswordToken -resetPasswordExpire -__v');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                contact: updatedUser.contact,
                preferredCurrency: updatedUser.preferredCurrency,
                preferredCountry: updatedUser.preferredCountry,
                dateOfBirth: updatedUser.dateOfBirth,
                gender: updatedUser.gender,
                dateOfAnniversary: updatedUser.dateOfAnniversary
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update profile',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/user-profile/orders
 * @desc    Get user's order history (previous purchases)
 * @access  Private
 */
router.get('/orders', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            page = 1,
            limit = 10,
            status,
            sortBy = 'createdOn',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        const query = { customer: userId };
        if (status) {
            query.status = status;
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        // Fetch orders
        const orders = await Order.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .select('orderId status paymentStatus total subtotal discount shippingCost items createdOn progress shippingAddress billingAddress')
            .lean();

        // Get total count
        const totalOrders = await Order.countDocuments(query);

        // Format orders
        const formattedOrders = orders.map(order => ({
            orderId: order.orderId,
            status: order.status,
            paymentStatus: order.paymentStatus,
            total: order.total,
            subtotal: order.subtotal,
            discount: order.discount || 0,
            shippingCost: order.shippingCost || 0,
            itemCount: order.items?.length || 0,
            createdOn: order.createdOn,
            isDelivered: !!order.progress?.delivered?.date,
            shippingAddress: order.shippingAddress ? {
                name: `${order.shippingAddress.firstName || ''} ${order.shippingAddress.lastName || ''}`.trim(),
                city: order.shippingAddress.city,
                state: order.shippingAddress.state,
                country: order.shippingAddress.country
            } : null
        }));

        res.json({
            success: true,
            data: {
                orders: formattedOrders,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalOrders / parseInt(limit)),
                    totalOrders,
                    hasNextPage: skip + formattedOrders.length < totalOrders,
                    hasPrevPage: parseInt(page) > 1
                }
            }
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch orders',
            message: error.message
        });
    }
});

/**
 * @route   PUT /api/user-profile/password
 * @desc    Change user password (requires current password)
 * @access  Private
 */
router.put('/password', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'New password must be at least 6 characters long'
            });
        }

        // Get user with password
        const user = await User.findById(userId).select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Verify current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Update password (will be hashed by pre-save middleware)
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to change password',
            message: error.message
        });
    }
});

/**
 * @route   PUT /api/user-profile/addresses
 * @desc    Update billing and/or shipping address
 * @access  Private
 */
router.put('/addresses', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const { billingAddress, shippingAddress, sameAsShipping = false } = req.body;

        const updateData = {};

        if (shippingAddress) {
            updateData.shippingAddress = {
                line1: shippingAddress.line1 || shippingAddress.address1 || shippingAddress.address,
                line2: shippingAddress.line2 || shippingAddress.address2 || shippingAddress.apartment || '',
                city: shippingAddress.city,
                state: shippingAddress.state,
                postal_code: shippingAddress.postal_code || shippingAddress.zipCode,
                country: shippingAddress.country || 'US'
            };
        }

        if (billingAddress) {
            updateData.billingAddress = {
                line1: billingAddress.line1 || billingAddress.address1 || billingAddress.address,
                line2: billingAddress.line2 || billingAddress.address2 || billingAddress.apartment || '',
                city: billingAddress.city,
                state: billingAddress.state,
                postal_code: billingAddress.postal_code || billingAddress.zipCode,
                country: billingAddress.country || 'US'
            };
        }

        // If sameAsShipping is true, copy shipping to billing
        if (sameAsShipping && updateData.shippingAddress) {
            updateData.billingAddress = { ...updateData.shippingAddress };
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No address data provided'
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('billingAddress shippingAddress');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Addresses updated successfully',
            data: {
                billingAddress: updatedUser.billingAddress,
                shippingAddress: updatedUser.shippingAddress
            }
        });
    } catch (error) {
        console.error('Update addresses error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update addresses',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/user-profile/addresses
 * @desc    Get user's saved addresses
 * @access  Private
 */
router.get('/addresses', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId)
            .select('billingAddress shippingAddress');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                billingAddress: user.billingAddress || null,
                shippingAddress: user.shippingAddress || null
            }
        });
    } catch (error) {
        console.error('Get addresses error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch addresses',
            message: error.message
        });
    }
});

module.exports = router;
