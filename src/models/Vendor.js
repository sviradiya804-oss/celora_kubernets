const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  vendorId: { type: String, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  contact: { type: String, required: true },
  origin: { type: String },
  operatingFrom: { type: String },
  vendorType: { 
    type: String, 
    enum: [
      'Natural Diamond', 
      'Lab Grown Diamond', 
      'Natural Melle Diamond', 
      'Lab Grown Melle Diamond', 
      'Jewelry'
    ],
    required: true 
  },
  password: { type: String, required: true },
  gstNumber: { type: String },

  // Enhanced documents structure with key-value pairs and strict allowed types
  documents: [{
    documentType: { 
      type: String, 
      required: true, 
      enum: ['businessCard', 'ownerProof', 'passport', 'pancard'] // Only allow these types
    },
    documentUrl: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    verificationStatus: { 
      type: String, 
      enum: ['pending', 'verified', 'rejected'], 
      default: 'pending' 
    },
    rejectionReason: { type: String }
  }],

  // Overall vendor verification status
  verificationStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },

  // KYC and availability data
  availability: {
    is24x7: { type: Boolean, default: false },
    workingDays: [{
      day: { type: String, enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
      startTime: { type: String },
      endTime: { type: String },
      isActive: { type: Boolean, default: true }
    }]
  },

  // Business details
  businessDetails: {
    gstNumber: { type: String },
    companyAddress: { type: String },
    phoneNumber: { type: String },
    passportNumber: { type: String }
  },

  // Admin approval
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },

  // Profile completion
  profileCompleteness: { type: Number, default: 0 }, // Percentage

  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { 
  timestamps: true 
});

// Generate vendorId before saving
vendorSchema.pre('save', function(next) {
  if (!this.vendorId) {
    this.vendorId = 'VND' + Date.now() + Math.floor(Math.random() * 1000);
  }
  next();
});

module.exports = mongoose.model('Vendor', vendorSchema);
