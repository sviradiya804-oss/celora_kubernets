const mongoose = require('mongoose');
const Schema = require('../models/schema');

// Create models
const Vendor = mongoose.models.vendorModel || mongoose.model('vendorModel', Schema.vendor, 'vendors');
const VendorDiamond = mongoose.models.vendorDiamondModel || mongoose.model('vendorDiamondModel', Schema.vendorDiamond, 'vendordiamonds');

// Admin: Get vendor verification dashboard stats
const getVendorStats = async (req, res) => {
  try {
    const pendingVendors = await Vendor.countDocuments({ 
      verificationStatus: 'pending',
      isDeleted: false 
    });
    
    const approvedVendors = await Vendor.countDocuments({ 
      verificationStatus: 'approved',
      isDeleted: false 
    });
    
    const rejectedVendors = await Vendor.countDocuments({ 
      verificationStatus: 'rejected',
      isDeleted: false 
    });
    
    const pendingDiamonds = await VendorDiamond.countDocuments({ 
      verificationStatus: 'pending',
      isDeleted: false 
    });
    
    const approvedDiamonds = await VendorDiamond.countDocuments({ 
      verificationStatus: 'approved',
      isDeleted: false 
    });
    
    res.json({
      success: true,
      stats: {
        vendors: {
          pending: pendingVendors,
          approved: approvedVendors,
          rejected: rejectedVendors,
          total: pendingVendors + approvedVendors + rejectedVendors
        },
        diamonds: {
          pending: pendingDiamonds,
          approved: approvedDiamonds,
          total: pendingDiamonds + approvedDiamonds
        }
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: Get vendor details with documents
const getVendorDetails = async (req, res) => {
  try {
    const { vendorId } = req.params;
    
    const vendor = await Vendor.findById(vendorId)
      .select('-password')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email');
    
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    
    // Get vendor's diamond statistics
    const diamondStats = await VendorDiamond.aggregate([
      { $match: { vendor: new mongoose.Types.ObjectId(vendorId), isDeleted: false } },
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const diamondStatsObj = {};
    diamondStats.forEach(stat => {
      diamondStatsObj[stat._id] = stat.count;
    });
    
    res.json({
      success: true,
      vendor,
      diamondStats: {
        pending: diamondStatsObj.pending || 0,
        approved: diamondStatsObj.approved || 0,
        rejected: diamondStatsObj.rejected || 0
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: Get all vendor diamonds for verification
const getVendorDiamondsForVerification = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'pending', vendorId } = req.query;
    
    const filter = { isDeleted: false };
    
    if (status) {
      filter.verificationStatus = status;
    }
    
    if (vendorId) {
      filter.vendor = vendorId;
    }
    
    const diamonds = await VendorDiamond.find(filter)
      .populate('vendor', 'first_name last_name company_name email')
      .populate('verifiedBy', 'name email')
      .sort({ createdOn: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await VendorDiamond.countDocuments(filter);
    
    res.json({
      success: true,
      diamonds,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: Verify vendor diamond
const verifyVendorDiamond = async (req, res) => {
  try {
    const { diamondId } = req.params;
    const { status, reason } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }
    
    const updateData = {
      verificationStatus: status,
      verifiedBy: req.user._id,
      verifiedAt: new Date(),
      updatedOn: new Date()
    };
    
    if (status === 'rejected' && reason) {
      updateData.rejectionReason = reason;
    }
    
    const diamond = await VendorDiamond.findByIdAndUpdate(
      diamondId, 
      updateData, 
      { new: true }
    ).populate('vendor', 'first_name last_name company_name email');
    
    if (!diamond) {
      return res.status(404).json({ message: 'Diamond not found' });
    }
    
    res.json({
      success: true,
      message: `Diamond ${status} successfully`,
      diamond
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getVendorStats,
  getVendorDetails,
  getVendorDiamondsForVerification,
  verifyVendorDiamond
};
