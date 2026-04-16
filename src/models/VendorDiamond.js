const mongoose = require('mongoose');

const vendorDiamondSchema = new mongoose.Schema({
  vendorDiamondId: { type: String, unique: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  
  // Diamond details (similar to existing diamond schema)
  diamondId: { type: String, unique: true, required: true },
  stock_id: { type: String, unique: true, required: true },
  ReportNo: { type: String },
  shape: { type: String, required: true },
  carats: { type: Number, required: true },
  col: { type: String }, // Color grade
  clar: { type: String }, // Clarity grade
  cut: { type: String }, // Cut grade
  pol: { type: String }, // Polish grade
  symm: { type: String }, // Symmetry grade
  flo: { type: String }, // Fluorescence
  floCol: { type: String }, // Fluorescence color
  length: { type: Number },
  width: { type: Number },
  height: { type: Number },
  depth: { type: Number },
  table: { type: Number },
  culet: { type: String },
  lab: { type: String },
  girdle: { type: String },
  eyeClean: { type: String },
  brown: { type: String, enum: ["Yes", "No"] },
  green: { type: String, enum: ["Yes", "No"] },
  milky: { type: String, enum: ["Yes", "No"] },
  discount: { type: String },
  price: { type: Number },
  price_per_carat: { type: Number },
  
  // Media
  video: { type: String },
  image: { type: String },
  pdf: { type: String },
  
  // Additional details
  mine_of_origin: { type: String },
  canada_mark_eligible: { type: Boolean },
  is_returnable: { type: String, enum: ["Y", "N"] },
  lg: { type: String }, // Type/category
  markup_price: { type: Number },
  markup_currency: { type: String },
  ReturnDays: { type: Number },
  
  // Vendor specific fields
  vendorPrice: { type: Number }, // Vendor's selling price
  vendorCurrency: { type: String, default: 'USD' },
  availabilityStatus: { 
    type: String, 
    enum: ['available', 'sold', 'on_hold', 'reserved'], 
    default: 'available' 
  },
  
  // Admin verification
  verificationStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  rejectionReason: { type: String },
  
  // Timestamps
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  isDeleted: { type: Boolean, default: false }
}, { 
  timestamps: true 
});

// Generate vendorDiamondId before saving
vendorDiamondSchema.pre('save', function(next) {
  if (!this.vendorDiamondId) {
    this.vendorDiamondId = 'VND_DMD_' + Date.now() + Math.floor(Math.random() * 1000);
  }
  next();
});

module.exports = mongoose.model('VendorDiamond', vendorDiamondSchema);
