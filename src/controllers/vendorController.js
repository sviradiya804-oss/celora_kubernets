const { v4: uuidv4 } = require('uuid'); // Import UUID package
// Admin: Approve/Reject Vendor KYC
exports.verifyVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { status, reason } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved, rejected, or pending' });
    }
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    vendor.verificationStatus = status;
    if (status === 'rejected' && reason) {
      vendor.rejectionReason = reason;
    } else if (status === 'approved') {
      vendor.rejectionReason = undefined;
    }
    vendor.updatedOn = new Date();
    await vendor.save();
    res.json({
      success: true,
      message: `Vendor ${status} successfully`,
      vendor: {
        id: vendor._id,
        verificationStatus: vendor.verificationStatus,
        rejectionReason: vendor.rejectionReason
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const mongoose = require('mongoose');
const Schema = require('../models/schema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');
const { uploadToAzureBlob } = require('../services/azureStorageService');

// Create models
const Vendor = mongoose.models.vendorModel || mongoose.model('vendorModel', Schema.vendor, 'vendors');
const VendorDiamond = mongoose.models.vendorDiamondModel || mongoose.model('vendorDiamondModel', Schema.vendorDiamond, 'vendordiamonds');

// Register/Add Vendor
exports.registerVendor = async (req, res) => {
  try {
    const { 
      first_name, last_name, email, company_name, contact_number, origin, 
      operating_From, vendor_Type, password, adminVendorPassword, businessDetails 
    } = req.body;
    
    const existingVendor = await Vendor.findOne({ email });
    if (existingVendor) {
      return res.status(400).json({ message: 'Vendor already exists with this email' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    let hashedAdminPassword = null;
    if (adminVendorPassword) {
      hashedAdminPassword = await bcrypt.hash(adminVendorPassword, 10);
    }
    
    const vendor = new Vendor({
      first_name, 
      last_name, 
      email, 
      company_name, 
      contact_number, 
      origin, 
      operating_From, 
      vendor_Type, 
      password: hashedPassword,
      adminVendorPassword: hashedAdminPassword,
      businessDetails: businessDetails || {},
      vendorId: 'VND' + Date.now() + Math.floor(Math.random() * 1000)
    });
    
    await vendor.save();
    
    res.status(201).json({ 
      success: true,
      message: 'Vendor registered successfully',
      vendorId: vendor.vendorId 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Vendor Login
exports.loginVendor = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const vendor = await Vendor.findOne({ email, isDeleted: false });
    if (!vendor) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Allow login with either vendor password or adminVendorPassword
    const isMatch = await bcrypt.compare(password, vendor.password);
    const isAdminMatch = vendor.adminVendorPassword ? await bcrypt.compare(password, vendor.adminVendorPassword) : false;
    if (!isMatch && !isAdminMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Always return token for valid credentials, include type: 'vendor'
    const token = jwt.sign({ id: vendor._id, email: vendor.email, type: 'vendor' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({
      message: vendor.verificationStatus !== 'approved'
        ? `Your account is ${vendor.verificationStatus === 'pending' ? 'pending approval. Please wait for admin verification.' : 'rejected. Please re-upload documents.'}`
        : 'Login successful',
      status: vendor.verificationStatus,
      token,
      vendor: {
        id: vendor._id,
        email: vendor.email,
        vendor_Type: vendor.vendor_Type,
        verificationStatus: vendor.verificationStatus
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get Vendor Profile
exports.getVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendorId).select('-password');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    
    res.json({ success: true, vendor });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update Vendor Profile
exports.updateVendorProfile = async (req, res) => {
  try {
    const updates = req.body;
    
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    
    updates.updatedOn = new Date();
    
    const vendor = await Vendor.findByIdAndUpdate(
      req.vendorId, 
      updates, 
      { new: true }
    ).select('-password');
    
    res.json({ success: true, vendor });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Upload Documents with key-value structure

// Alternative method for handling multiple specific fields
exports.uploadMultipleDocuments = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const processedDocuments = [];
    const errors = [];

    // Helper to process individual file
    const processFile = async (file, documentType) => {
      try {
        let documentUrl = null;

        if (file.location) {
          documentUrl = file.location;
        } else if (file.path) {
          documentUrl = file.path;
        } else if (file.buffer && uploadToAzureBlob) {
          const filename = file.originalname || `${vendor.vendorId}_${documentType}_${Date.now()}`;
          documentUrl = await uploadToAzureBlob(file.buffer, filename);
        }

        if (!documentUrl) {
          throw new Error(`Failed to upload ${documentType}`);
        }

        // Update or add document
        const existingDocIndex = vendor.documents.findIndex(
          doc => doc.documentType === documentType
        );

        const newDoc = {
          documentType,
          documentUrl,
          uploadedAt: new Date(),
          verificationStatus: 'pending'
        };

        if (existingDocIndex !== -1) {
          vendor.documents[existingDocIndex] = {
            ...vendor.documents[existingDocIndex],
            ...newDoc,
            rejectionReason: undefined
          };
        } else {
          vendor.documents.push(newDoc);
        }

        processedDocuments.push({
          documentType,
          documentUrl,
          verificationStatus: 'pending'
        });

      } catch (error) {
        errors.push(`Error processing ${documentType}: ${error.message}`);
      }
    };

    // Process files by field name
    const documentTypes = ['businessCard', 'ownerProof', 'passport', 'pancard'];
    
    for (const docType of documentTypes) {
      if (req.files && req.files[docType]) {
        const files = Array.isArray(req.files[docType]) ? req.files[docType] : [req.files[docType]];
        
        // Process the first file for each document type
        if (files.length > 0) {
          await processFile(files[0], docType);
        }
      }
    }

    if (processedDocuments.length === 0) {
      return res.status(400).json({ 
        message: 'No valid documents were uploaded',
        errors: errors
      });
    }

    vendor.updatedOn = new Date();
    await vendor.save();

    res.json({
      success: true,
      message: `${processedDocuments.length} document(s) uploaded successfully`,
      documents: processedDocuments,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('Multi-upload error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Vendor Dashboard - Get Statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    
    // Get vendor diamond statistics
    const totalDiamonds = await VendorDiamond.countDocuments({ 
      vendor: vendorId, 
      isDeleted: false 
    });
    
    const approvedDiamonds = await VendorDiamond.countDocuments({ 
      vendor: vendorId, 
      verificationStatus: 'approved',
      isDeleted: false 
    });
    
    const pendingDiamonds = await VendorDiamond.countDocuments({ 
      vendor: vendorId, 
      verificationStatus: 'pending',
      isDeleted: false 
    });
    
    const rejectedDiamonds = await VendorDiamond.countDocuments({ 
      vendor: vendorId, 
      verificationStatus: 'rejected',
      isDeleted: false 
    });
    
    // Get orders related to vendor diamonds (you'll need to modify based on your order structure)
    const Order = mongoose.models.orderModel || mongoose.model('orderModel', Schema.order, 'orders');
    
    // This is a placeholder - adjust based on how orders are linked to vendors
    const totalOrders = await Order.countDocuments({
      // Add vendor-specific filter when order schema supports vendor linkage
      isDeleted: false
    });
    
    // Revenue calculation (placeholder)
    const totalRevenue = await VendorDiamond.aggregate([
      { $match: { vendor: new mongoose.Types.ObjectId(vendorId), isDeleted: false } },
      { $group: { _id: null, total: { $sum: '$vendorPrice' } } }
    ]);
    
    const vendor = await Vendor.findById(vendorId).select('verificationStatus profileCompleteness');
    
    res.json({
      success: true,
      stats: {
        vendor: {
          verificationStatus: vendor.verificationStatus,
          profileCompleteness: vendor.profileCompleteness
        },
        diamonds: {
          total: totalDiamonds,
          approved: approvedDiamonds,
          pending: pendingDiamonds,
          rejected: rejectedDiamonds
        },
        orders: {
          total: totalOrders
        },
        revenue: {
          total: totalRevenue[0]?.total || 0
        }
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add Single Diamond
exports.addDiamond = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    
    // Only allow adding diamonds if vendor KYC is approved
    const vendor = await Vendor.findById(vendorId);
    if (!vendor || vendor.verificationStatus !== 'approved') {
      return res.status(403).json({ 
        message: 'KYC not approved. You can only update profile, upload/change documents, and check dashboard until admin approves your KYC.' 
      });
    }
    
    const diamondData = {
      ...req.body,
      vendor: vendorId,
      createdBy: vendorId,
      vendorDiamondId: 'VND_DMD_' + Date.now() + Math.floor(Math.random() * 1000)
    };
    const diamond = new VendorDiamond(diamondData);
    await diamond.save();
    res.status(201).json({
      success: true,
      message: 'Diamond added successfully',
      diamond
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Import Diamonds from Excel/CSV
exports.importDiamonds = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    
    // Only allow importing diamonds if vendor KYC is approved
    const vendor = await Vendor.findById(vendorId);
    if (!vendor || vendor.verificationStatus !== 'approved') {
      return res.status(403).json({ 
        message: 'KYC not approved. You can only update profile, upload/change documents, and check dashboard until admin approves your KYC.' 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty' });
    }
    
    const diamondsToInsert = [];
    const errors = [];
    
    rows.forEach((row, index) => {
      try {
        // Normalize keys to lowercase, remove spaces, %, / for easier access
        const normalizedRow = {};
        for (let key in row) {
          const lowerKey = key.toLowerCase().replace(/ /g, '').replace(/%/g, '').replace(/\//g, '');
          normalizedRow[lowerKey] = row[key];
        }
        
        // Validate required fields (using normalized keys)
        if (!normalizedRow.shape || !normalizedRow.carats) {
          errors.push(`Row ${index + 2}: Missing required fields (shape, carats)`);
          return;
        }
        
        diamondsToInsert.push({
          vendor: vendorId,
          createdBy: vendorId,
          vendorDiamondId: 'VND_DMD_' + Date.now() + Math.floor(Math.random() * 1000),
          diamondId: uuidv4(),
          stock_id: normalizedRow.stoneno,
          ReportNo: normalizedRow.reportno,
          shape: normalizedRow.shape,
          carats: parseFloat(normalizedRow.carats),
          col: normalizedRow.color,
          clar: normalizedRow.clarity,
          cut: normalizedRow.cut,
          pol: normalizedRow.polish,
          symm: normalizedRow.sym,
          flo: normalizedRow.flour, // Assuming 'Flour' is fluorescence
          floCol: normalizedRow.floc || '', // Not in data, default empty
          length: parseFloat(normalizedRow.length) || 0,
          width: parseFloat(normalizedRow.width) || 0,
          height: parseFloat(normalizedRow.height) || 0, // Not in data
          depth: parseFloat(normalizedRow.depth) || 0, // Not in data
          table: parseFloat(normalizedRow.table) || 0, // Not in data
          culet: normalizedRow.culet,
          lab: normalizedRow.lab,
          girdle: normalizedRow.girdle || '', // Not in data
          eyeClean: normalizedRow.eyeclean || '', // Not in data
          brown: normalizedRow.brown || '', // Not in data
          green: normalizedRow.green || '', // Not in data
          milky: normalizedRow.milky || '', // Not in data
          discount: normalizedRow.disc,
          price: parseFloat(normalizedRow.amount) || 0,
          price_per_carat: parseFloat(normalizedRow.pricect) || 0,
          video: normalizedRow.videolink,
          image: normalizedRow.imagelink,
          pdf: normalizedRow.reportlink,
          mine_of_origin: normalizedRow.location,
          vendorPrice: parseFloat(normalizedRow.amount) || parseFloat(normalizedRow.pricect) * parseFloat(normalizedRow.carats) || 0,
          vendorCurrency: normalizedRow.vendorcurrency || 'USD', // Not in data, default USD
          diamondType: req.body.vendor_Type || 'Unknown' // Use vendor type if not specified
        });
      } catch (err) {
        errors.push(`Row ${index + 2}: ${err.message}`);
      }
    });
    
    if (diamondsToInsert.length === 0) {
      return res.status(400).json({ 
        message: 'No valid diamonds to import',
        errors 
      });
    }
    
    // Insert diamonds
    const insertedDiamonds = await VendorDiamond.insertMany(diamondsToInsert);
    res.json({
      success: true,
      message: `${insertedDiamonds.length} diamonds imported successfully`,
      imported: insertedDiamonds.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: Get All Vendors
exports.getAllVendors = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    
    const filter = { isDeleted: false };
    
    if (status) {
      filter.verificationStatus = status;
    }
    
    if (search) {
      filter.$or = [
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company_name: { $regex: search, $options: 'i' } }
      ];
    }
    
    const vendors = await Vendor.find(filter)
      .select('-password')
      .sort({ createdOn: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Vendor.countDocuments(filter);
    
    res.json({
      success: true,
      vendors,
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

// Admin: Verify Vendor
exports.getVendorDiamonds = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = { vendor: vendorId, isDeleted: false };
    if (status) {
      filter.verificationStatus = status;
    }
    if (search) {
      filter.$or = [
        { diamondId: { $regex: search, $options: 'i' } },
        { stock_id: { $regex: search, $options: 'i' } },
        { shape: { $regex: search, $options: 'i' } }
      ];
    }
    const diamonds = await VendorDiamond.find(filter)
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
// Admin: Verify Document
exports.verifyDocument = async (req, res) => {
  try {
    const { vendorId, documentType } = req.params;
    const { status, reason } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be verified or rejected' });
    }
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    const documentIndex = vendor.documents.findIndex(doc => doc.documentType === documentType);
    if (documentIndex === -1) {
      return res.status(404).json({ message: 'Document not found' });
    }
    vendor.documents[documentIndex].verificationStatus = status;
    if (status === 'rejected' && reason) {
      vendor.documents[documentIndex].rejectionReason = reason;
    }
    vendor.updatedOn = new Date();
    await vendor.save();
    res.json({
      success: true,
      message: `Document ${status} successfully`,
      document: vendor.documents[documentIndex]
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
