// schema.js
const mongoose = require('mongoose');
const { ref } = require('pdfkit');
const schemas = {
  data: {
    dataId: { type: String },
    title: { type: String },
    summray: { type: String },
    Participants: [{ type: String }],
    date: { type: String },
    tags: [{ type: String }],
    link: { type: String },
    createdOn: { type: String, default: Date.now() }
  },

  signup: {
    name: { type: String },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    googleId: String,
  },
  login: {
    email: { type: String, required: true },
    password: { type: String, required: true }
  },
  contactus: {
    contactusId: { type: String },
    name: { type: String }, // Full Name
    email: { type: String }, // Email Address
    phone: { type: String }, // Phone Number
    subject: { type: String }, // Subject of the message
    message: { type: String }, // Message content
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed'],
      default: 'Pending'
    }
  },
  role: {
    roleId: { type: String },
    name: { type: String, required: true, unique: true },
    permissions: [
      {
        resource: { type: String }, // e.g., 'blog', 'product', 'data'
        actions: [String], // e.g., ['create', 'read', 'update', 'delete']
        group: { type: String } // e.g., 'contentmanagement', 'pricemanagement'
      }
    ]
  },

  // --- Order Pages ---
  order: {
    orderId: {
      type: String,
      required: true,
      unique: true,
      maxlength: 12,
      minlength: 12,
      match: /^[A-Z0-9]{12}$/ // 8 random chars + 4 timestamp digits
    },
    date: { type: Date, default: Date.now },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isRetailerOrder: { type: Boolean, default: false },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // Sub-orders: one per cart item — each tracks its own status & progress independently
    subOrders: [
      {
        subOrderId: {
          type: String,
          required: true,
          unique: true,
          maxlength: 12,
          minlength: 12,
          match: /^[A-Z0-9]{12}$/ // 8 random chars + 4 timestamp digits
        },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
        quantity: { type: Number, required: true },
        type: {
          type: String,
          enum: ['Premade', 'Custom'],
          default: 'Premade'
        },
        priceAtTime: { type: Number },
        imageUrl: { type: String },
        productDetails: {
          title: { type: String },
          name: { type: String },
          description: { type: String },
          category: { type: String },
          material: { type: String },
          metalType: { type: String },
          ringSize: { type: String },
          diamondType: { type: String },
          packaging: { type: mongoose.Schema.Types.ObjectId, ref: 'packaging' },
          price: { type: Number },
          cadCode: { type: String },
          slug: { type: String },           // SEO slug for product URL
          images: { type: [String] },
          selectedVariant: { type: mongoose.Schema.Types.Mixed },
          // Diamond/Stone Details
          diamondDetails: {
            stock_id: { type: String },      // Custom diamond stock ID
            shape: { type: String },
            diamondType: { type: String },
            carats: { type: Number },        // Carat weight
            caratSize: { type: String },     // Carat size range
            cut: { type: String },
            clarity: { type: String },
            clar: { type: String },          // Clarity abbreviation from inventory
            color: { type: String },
            col: { type: String },           // Color abbreviation from inventory
            lab: { type: String },           // Lab certification (IGI, GIA) or true/false
            price: { type: Number },         // Base price
            priceWithMargin: { type: Number }, // Markup price
            markup_price: { type: Number }   // Customer-facing price
          },
          estimatedDeliveryDays: { type: Number },
          packagingType: { type: String }
        },
        engravingDetails: {
          hasEngraving: { type: Boolean, default: false },
          engravingText: { type: String },
          font: { type: String },
          engravingType: {
            type: String,
            enum: ['Text', 'Symbol', 'Date', 'Initials', 'Custom Design']
          },
          engravingLocation: {
            type: String,
            enum: ['Inside Band', 'Outside Band', 'Back', 'Front', 'Side', 'Custom Location']
          },
          customDesignFile: { type: String },
          specialInstructions: { type: String },
          engravingCost: { type: Number, default: 0 },
          estimatedDeliveryDays: { type: Number },
          engravingStatus: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed', 'Approved', 'Cancelled'],
            default: 'Pending'
          }
        },
        status: {
          type: String,
          enum: ['Pending', 'Confirmed', 'Manufacturing', 'Quality Assurance', 'Out For Delivery', 'Delivered', 'Cancelled'],
          default: 'Pending'
        },
        progress: {
          confirmed: {
            date: { type: Date },
            confirmedImages: { type: [String] },
            status: { type: String }
          },
          manufacturing: {
            date: { type: Date },
            manufacturingImages: { type: [String] }
          },
          qualityAssurance: {
            date: { type: Date },
            qualityAssuranceImages: { type: [String] }
          },
          outForDelivery: {
            date: { type: Date },
            outForDeliveryImages: { type: [String] },
            trackingId: { type: String },
            trackingLink: { type: String }
          },
          delivered: {
            date: { type: Date }
          }
        }
      }
    ],

    total: { type: Number, required: true }, //amount for the order
    paymetmethod: {
      type: String,
      default: 'stripe'
    }, // e.g., 'Credit Card', 'PayPal', etc.
    orderedOn: { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date }, // Computed at checkout: now + max(estimatedDeliveryDays across items)
    estimatedDeliveryDays: { type: Number }, // Easy access for frontend - number of days until delivery
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Manufacturing', 'Quality Assurance', 'Out For Delivery', 'Delivered', 'Cancelled'],
      default: 'Pending'
    },
    stripeSessionId: { type: String }, // Stripe checkout session ID
    invoicePath: { type: String }, // Path to generated invoice
    emailLog: [{
      stage: String,
      sentAt: Date,
      success: Boolean,
      error: String
    }],
    progress: {
      confirmed: {
        date: { type: Date },
        confirmedImages: { type: [String] }, // URLs or file names
        status: { type: String }
      },
      manufacturing: {
        date: { type: Date },
        manufacturingImages: { type: [String] }
      },
      qualityAssurance: {
        date: { type: Date },
        qualityAssuranceImages: { type: [String] }
      },
      outForDelivery: {
        date: { type: Date },
        outForDeliveryImages: { type: [String] },
        trackingId: { type: String },
        trackingLink: { type: String }
      },
      delivered: {
        date: { type: Date }
        // no image needed
      }
    },
    // Additional fields for better order management
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    // Customer addresses
    billingAddress: {
      firstName: { type: String },
      lastName: { type: String },
      address1: { type: String },
      address2: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String },
      email: { type: String },
      phone: { type: String },
    },
    shippingAddress: {
      firstName: { type: String },
      lastName: { type: String },
      address1: { type: String },
      address2: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String },
      email: { type: String },
      phone: { type: String }
    },
    // Customer contact data
    customerData: {
      email: { type: String },
      phone: { type: String },
      name: { type: String }
    },
    // Discount information
    discount: { type: Number },
    subtotal: { type: Number },
    coupon: {
      code: { type: String },
      discountType: { type: String },
      discountValue: { type: Number },
      discount: { type: Number }
    },
    paymentDetails: {
      // Stripe identifiers
      stripeSessionId: { type: String },
      stripePaymentIntentId: { type: String },
      chargeId: { type: String },

      // Amount and currency
      amountPaid: { type: Number },
      currency: { type: String, default: 'usd' },

      // Payment method information
      paymentMethod: { type: String }, // 'card', 'affirm', 'bank_transfer', etc.
      paymentMethodDetails: { type: mongoose.Schema.Types.Mixed }, // Detailed payment method info from Stripe

      // Card details (only last 4 and brand, NEVER store full card number)
      cardLast4: { type: String },
      cardBrand: { type: String }, // 'visa', 'mastercard', 'amex', etc.

      // Payment status and timing
      paymentStatus: { type: String },
      paymentCreatedAt: { type: Date },
      paymentConfirmedAt: { type: Date },
      paymentIntentStatus: { type: String },

      // Customer information from payment
      customerStripeId: { type: String },
      customerEmail: { type: String },
      customerName: { type: String },
      customerPhone: { type: String },

      // Address information
      billingAddress: {
        line1: { type: String },
        line2: { type: String },
        city: { type: String },
        state: { type: String },
        postal_code: { type: String },
        country: { type: String }
      },
      shippingAddress: {
        line1: { type: String },
        line2: { type: String },
        city: { type: String },
        state: { type: String },
        postal_code: { type: String },
        country: { type: String }
      },

      // Financial details
      applicationFee: { type: Number },
      stripeFee: { type: Number },
      netAmount: { type: Number },

      // Risk assessment
      riskLevel: { type: String }, // 'normal', 'elevated', 'highest'
      riskScore: { type: Number },
      networkStatus: { type: String },
      sellerMessage: { type: String },

      // Receipt and transaction tracking
      receiptEmail: { type: String },
      receiptUrl: { type: String },
      balanceTransaction: { type: String },

      // Processing details
      processingMethod: { type: String }, // 'automatic', 'manual'
      confirmationMethod: { type: String },
      captureMethod: { type: String },

      // Metadata from Stripe
      sessionMetadata: { type: mongoose.Schema.Types.Mixed },
      paymentIntentMetadata: { type: mongoose.Schema.Types.Mixed },

      // Tracking and audit
      paymentSource: { type: String }, // 'checkout_session', 'payment_intent_webhook', etc.
      lastUpdated: { type: Date, default: Date.now }
    },
    refundDetails: [{
      refundId: { type: String },
      amount: { type: Number },
      reason: { type: String },
      processedAt: { type: Date },
      processedBy: { type: String }, // Admin email or user ID who processed the refund
      stripeRefundStatus: { type: String },
      refundMethod: { type: String }, // How the refund was processed
      refundMetadata: { type: mongoose.Schema.Types.Mixed } // Additional refund information
    }],
    customerData: {
      email: { type: String },
      name: { type: String },
      phone: { type: String }
    },
    subtotal: { type: Number },
    discount: { type: Number, default: 0 },
    coupon: {
      code: { type: String },
      discount: { type: Number }
    },
    shippingDetails: {
      estimatedDeliveryDays: { type: Number }, // Number of days for delivery
      deliveryDateRange: {
        start: { type: Date }, // Earliest delivery date
        end: { type: Date } // Latest delivery date
      },
      shippingMethod: { type: String }, // e.g., 'Standard', 'Express', 'Overnight'
      shippingCost: { type: Number, default: 0 }, // Cost of shipping
      trackingNumber: { type: String }, // To be added later when shipped
      carrier: { type: String } // e.g., 'FedEx', 'UPS', 'USPS'
    },
    createdOn: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false }
  },

  // --- Diamonds  ---
  //shapes Diamond
  shape: {
    shapeId: { type: String },
    sequence: { type: Number },
    name: { type: String, required: true },
    shapeCode: { type: String }, //shapecode
    shapesubCode: [{ type: String, required: true }], // e.g., 'R' for Round, 'O' for Oval

    //Remove in future
    shapeImgeurl: [{ type: String }], // URL to the image of the shape(both vector& Normal)
    shapeWithColorurl: [{ type: String }], // URL for color& cut variations(g,h,i,j,k)
    shapecuturl: [{ type: String }], //excelent,verygood etc
    shapeMeasurementurl: [{ type: String }], // e.g front view ,side view

    /// Image field
    EX: { type: String },
    F: { type: String },
    G: { type: String },
    GD: { type: String },
    H: { type: String },
    HI: { type: String },
    I: { type: String },
    J: { type: String },
    K: { type: String },
    PVT: { type: String },
    VG: { type: String },
    image: { type: String },
    image2: { type: String },
    diamond_front_image: { type: String },
    diamond_side_image: { type: String },

    isActive: { type: Boolean, default: true }, // Web Display
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  //Gemstone
  shapegemstoneLC: {
    sequence: { type: Number },
    shapegemstoneLCId: { type: String },
    sequence: { type: Number },
    name: { type: String, required: true },
    shapeCode: { type: String }, //shapecode
    shapesubCode: [{ type: String, required: true }], // e.g., 'R' for Round, 'O' for Oval
    shapeImgeurl: { type: String }, // URL to the image of the shape(both vector& Normal)
    subTitle: { type: String },
    description: { type: String },
    Option: { type: String },
    isActive: { type: Boolean, default: true }, // Web Display
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  shapegemstoneDR: {
    sequence: { type: Number },
    shapegemstoneDRId: { type: String },
    sequence: { type: Number },
    name: { type: String, required: true },
    shapeCode: { type: String }, //shapecode
    shapesubCode: [{ type: String, required: true }], // e.g., 'R' for Round, 'O' for Oval
    shapeImgeurl: { type: String }, // URL to the image of the shape(both vector& Normal)
    subTitle: { type: String },
    description: { type: String },
    Option: { type: String },
    isActive: { type: Boolean, default: true }, // Web Display
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  diamond: {
    diamondId: { type: String, unique: true, required: true }, // Unique diamond ID
    stock_id: { type: String, unique: true, required: true }, // Unique diamond stock ID
    ReportNo: { type: String, unique: true }, // Certificate report number
    shape: { type: String, required: true }, // Shape of the diamond
    carats: { type: Number, required: true }, // Carat weight
    col: { type: String }, // Color grade
    clar: { type: String }, // Clarity grade
    cut: { type: String }, // Cut grade
    pol: { type: String }, // Polish grade
    symm: { type: String }, // Symmetry grade
    flo: { type: String }, // Fluorescence
    floCol: { type: String }, // Fluorescence color
    length: { type: Number }, // Length in mm
    width: { type: Number }, // Width in mm
    height: { type: Number }, // Height in mm
    depth: { type: Number }, // Depth percentage
    table: { type: Number }, // Table percentage
    culet: { type: String }, // Culet description
    lab: { type: String }, // Lab name
    girdle: { type: String }, // Girdle description
    eyeClean: { type: String }, // Eye clean status
    brown: { type: String, enum: ["Yes", "No"] }, // Brown hue presence
    green: { type: String, enum: ["Yes", "No"] }, // Green hue presence
    milky: { type: String, enum: ["Yes", "No"] }, // Milky presence
    discount: { type: String }, // Discount percentage
    price: { type: Number }, // Price in the specified currency
    price_per_carat: { type: Number }, // Price per carat
    video: { type: String }, // Video URL
    image: { type: String }, // Image URL
    pdf: { type: String }, // PDF certificate URL
    mine_of_origin: { type: String }, // Origin of the mine
    canada_mark_eligible: { type: Boolean }, // Canada mark eligible
    is_returnable: { type: String, enum: ["Y", "N"] }, // Returnable status
    lg: { type: String }, // Type/category
    markup_price: { type: Number }, // Markup price
    markup_currency: { type: String }, // Markup price currency
    ReturnDays: { type: Number }, // Return days allowed
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  helddiamond: {

    helddiamondId: { type: String, unique: true, required: true }, // Unique diamond ID
    stock_id: { type: String, unique: true, required: true }, // Unique diamond stock ID
    ReportNo: { type: String, unique: true }, // Certificate report number
    shape: { type: String, required: true }, // Shape of the diamond
    carats: { type: Number, required: true }, // Carat weight
    col: { type: String }, // Color grade
    clar: { type: String }, // Clarity grade
    cut: { type: String }, // Cut grade
    pol: { type: String }, // Polish grade
    symm: { type: String }, // Symmetry grade
    flo: { type: String }, // Fluorescence
    floCol: { type: String }, // Fluorescence color
    length: { type: Number }, // Length in mm
    width: { type: Number }, // Width in mm
    height: { type: Number }, // Height in mm
    depth: { type: Number }, // Depth percentage
    table: { type: Number }, // Table percentage
    culet: { type: String }, // Culet description
    lab: { type: String }, // Lab name
    girdle: { type: String }, // Girdle description
    eyeClean: { type: String }, // Eye clean status
    brown: { type: String, enum: ["Yes", "No"] }, // Brown hue presence
    green: { type: String, enum: ["Yes", "No"] }, // Green hue presence
    milky: { type: String, enum: ["Yes", "No"] }, // Milky presence
    discount: { type: String }, // Discount percentage
    price: { type: Number }, // Price in the specified currency
    price_per_carat: { type: Number }, // Price per carat
    video: { type: String }, // Video URL
    image: { type: String }, // Image URL
    pdf: { type: String }, // PDF certificate URL
    mine_of_origin: { type: String }, // Origin of the mine
    canada_mark_eligible: { type: Boolean }, // Canada mark eligible
    is_returnable: { type: String, enum: ["Y", "N"] }, // Returnable status
    lg: { type: String }, // Type/category
    markup_price: { type: Number }, // Markup price
    markup_currency: { type: String }, // Markup price currency
    ReturnDays: { type: Number }, // Return days allowed
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  // --- Price Management ---
  metals: {
    Metal: { type: String, enum: ['Gold', 'Silver', 'Platinium'] }, // e.g., Gold, Silver
    MetalType: { type: String, enum: ['Yellow Gold', 'White Gold', 'Rose Gold'] },
    CaratType: { type: String, enum: ['6K', '8K', '10K', '12K', '14K', '18K', '22K', '24K'] },
    variants: [{ type: String }], // e.g., '18k White Gold', 'Yellow Gold Plated'
    price: { type: Number, required: true } // Price per gram
  },

  otherPrice: {
    otherPriceId: { type: String },
    Usduty: { type: Number, required: true }, // Price in %
    ShippingCharges: { type: Number, required: true }, // Shipping charges in %
    Packaging: { type: Number, required: true }, // Packaging charges in %
    silver925: { type: Number },
    Rate10K: { type: Number },
    Rate14k: { type: Number },
    Rate18k: { type: Number },
    Labour925: { type: Number },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  //diamondrates
  diamondrate: {
    //  diamondrateId: { type: String, unique: true }, // Fixed: use diamondRateId and make it unique
    Shapename: { type: mongoose.Schema.Types.ObjectId, ref: 'Shape' }, // e.g., 'Premium Diamonds', 'Value Diamonds'
    diamondType: {
      type: String,
      enum: ['Natural', 'Labgrown', 'NaturalGemStone', 'LabGrownGemStone'],
      required: true
    },
    //  color: { type:mongoose.Schema.Types.ObjectId, ref: 'shapegemstoneDR' }, 
    // // e.g., 'D', 'E', 'F'
    color: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'colorModel'
    },
    colorName: { type: String },
    colorModel: {
      type: String,
      enum: ['shapegemstoneDR', 'shapegemstonelc'], // list all possible referenced collections
      required: true
    },
    shape: {
      type: String
    },
    size: { type: String, required: true }, // e.g., '0.5-1.0 Carat', '1.0-2.0 Carat'
    weight: { type: Number, required: true }, // Weight in carats
    Price: { type: Number, required: true }, // Price per carat
    createdOn: { type: Date, default: Date.now }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date }, // Timestamp of last update
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false }
  },

  // //--- add diamond
  // addDiamond: {
  //   shapeName: {
  //     type: String,
  //     enum: ['Round', 'Oval', 'Pear', 'Cushion', 'Emerald', 'Asscher', 'Heart', 'Princess'],
  //     required: true
  //   },
  //   diamondType: {
  //     type: String,
  //     enum: ['Natural', 'Labgrown', 'NaturalGemStone', 'LabGrownGemStone'],
  //     required: true
  //   },
  //   color: {
  //     type: String, //comes from the shape
  //     enum: [
  //       'Red Diamonf(DRRD)',
  //       'Amethyst (DRAM)',
  //       'Aquamarine (DRAQ)',
  //       'Blue Topaz(DRBT)',
  //       'Blue Sapphire (DRBS)',
  //       'Pink Sapphire (DRPS)',
  //       'White Sapphire (DRWS)',
  //       'Black Sapphire (DRBLS)',
  //       'Champagne Diamond(DRCD)',
  //       'Blue Diamond(DRBD)',
  //       'Black Diamond(DRBLD)',
  //       'Yellow Diamond(DRYD)',
  //       'Citrine(DRCT)',
  //       'Peridot (DRPD)',
  //       'Morganite (DRMG)',
  //       'Garnet(DRGN)',
  //       'Tanzanite (DRTZ)',
  //       'Yellow Sapphire (DRYS)',
  //       'White Diamond(K)',
  //       'Blue Sapphire (LCBS)',
  //       'Pink Sapphire (LCPS)',
  //       'White Sapphire(LCWS)',
  //       'Ruby (DRRY)',
  //       'Emerald (DREM)',
  //       'Peridot (DRPD)',
  //       'Morganite(DRMG)',
  //       'Ruby(LCRY)',
  //       'Citrine (DRCT)',
  //       'Lab White Diamond (CV)'
  //     ],
  //     required: true
  //   },
  //   size: { type: String, required: true }, // e.g., '0.5 Carat', '1.0 Carat'
  //   weight: { type: Number, required: true }, // Weight in carats
  //   price: { type: Number, required: true } // Price per carat
  // },

  labourcost: {
    labourcostId: { type: String },
    Name: { type: String, required: true }, // e.g., 'Basic Setting', 'Premium Setting'
    price: { type: Number, required: true }, // Labour cost in usd
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  diamondmarkup: {
    diamondmarkupId: { type: String },
    Name: { type: String, required: true }, // e.g., 'Diamond Markup', ' Labgrown Diamond Markup'
    price: { type: Number, required: true }, // Markup price in  %
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  //metalPrice
  metalPrice: {
    metalPriceId: { type: String },
    MetalName: { type: String, required: true }, // e.g., 'Gold', 'Silver', 'Platinum'  
    MetalType: { type: String, required: true }, // e.g., '18K', '14K', '925 Silver'
    MetalPrice: { type: Number, required: true }, // Price per gram
    isActive: { type: Boolean, default: true }, // Web Display
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false },
  },

  Discounts: {
    Types: { type: String, enum: ['Natural', 'Lab', 'Both'] }, // Type of discount
    discount: { type: Number, required: true }, // Discount percentage
    labDiscount: { type: Number, required: true } // Lab discount percentage
  },
  //--- Jewelry Styles ---/
  engagementsubtypelist: {
    engagementsubtypelistId: { type: String },
    sequence: { type: Number },
    name: { type: String, required: true }, // e.g., 'Solitaire', 'Halo', 'Vintage'
    subName: { type: String, required: true }, // Unique identifier for the
    imageUrl: { type: String }, // URL to the image of the style
    isActive: { type: Boolean, default: true }, // Web Display
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  weddingbandssubtypelist: {
    weddingbandssubtypelistId: { type: String },
    sequence: { type: Number },
    name: { type: String, required: true }, // e.g., 'Classic', 'Eternity', 'Custom'
    subName: { type: String, required: true },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true }, // Web Display
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  pendentsubtypelist: {
    pendentsubtypelistId: { type: String },
    sequence: { type: Number },
    name: { type: String, required: true }, // e.g., 'Classic', 'Eternity', 'Custom'
    subName: { type: String, required: true },
    imageUrl: { type: String }, // URL to the image of the style
    isActive: { type: Boolean, default: true }, // Web Display
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  earringssubtypelist: {
    earringssubtypelistId: { type: String },
    sequence: { type: Number },
    name: { type: String, required: true }, // e.g., 'Classic', 'Eternity', 'Custom'
    subName: { type: String, required: true },
    imageUrl: { type: String }, // URL to the image of the style
    isActive: { type: Boolean, default: true }, // Web Display
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  braceletsubtypelist: {
    braceletsubtypelistId: { type: String },
    sequence: { type: Number },
    name: { type: String, required: true }, // e.g., 'Classic', 'Eternity', 'Custom'
    subName: { type: String, required: true },
    imageUrl: { type: String }, // URL to the image of the style
    isActive: { type: Boolean, default: true }, // Web Display
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  relation: {
    relationId: { type: String },
    sequence: { type: Number },
    name: { type: String, required: true }, // e.g., 'Sister', 'Wife', 'Mother', 'Daughter'
    isLike: { type: Boolean, default: false }, // Whether the relation is liked
    isActive: { type: Boolean, default: true }, // Web Display
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  occasion: {
    occasionId: { type: String },
    sequence: { type: Number },
    name: { type: String, required: true }, // e.g., 'Birthday', 'Anniversary', 'Wedding'
    isLike: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }, // Web Display
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  //-- Add Jewelry --//
  jewelry: {
    jewelryId: { type: String, unique: true, required: true },
    sequence: { type: Number },
    title: { type: String, required: true },
    jewelryName: { type: String, required: true },
    description: { type: String },
    slug: { type: String, unique: true },

    // Categories and Classification
    category: { value: { type: String } },
    subCategory: { type: mongoose.Schema.Types.ObjectId, value: { type: String } },
    // collection: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
    jewelryType: { type: String, enum: ['Engagement Rings', 'Wedding Bands', 'Necklace', 'Earrings', 'Bracelet', 'Pendant', 'Other'] },
    length: { type: Number },
    caratWeight: { type: Number },
    sale: {
      saleActive: { type: Boolean, default: false },
      percentage: { type: Number }
    },

    type: {
      type: String,
      required: true,
      enum: [
        'engagement',
        'weddingbands',
        'pendents',
        'earrings',
        'bracelets'
      ]
    },
    subType: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'subTypeModel'
    },
    subTypeModel: {
      type: String,
      required: true,
      enum: [
        'engagementsubtypelist',
        'weddingbandssubtypelist',
        'pendentsubtypelist',
        'earringssubtypelist',
        'braceletsubtypelist'
      ]
    },
    // Subtypes - References to existing schemas
    // subType: { type: mongoose.Schema.Types.ObjectId, ref: 'engagementsubtypelist' }, // For engagement rings
    // Alternative references for other types:
    // subType: { type: mongoose.Schema.Types.ObjectId, ref: 'weddingbandssubtypelist' }, // For wedding bands
    // subType: { type: mongoose.Schema.Types.ObjectId, ref: 'pendentsubtypelist' }, // For pendants
    // subType: { type: mongoose.Schema.Types.ObjectId, ref: 'earringssubtypelist' }, // For earrings
    // subType: { type: mongoose.Schema.Types.ObjectId, ref: 'braceletsubtypelist' }, // For bracelets

    // Type Classification
    type: {
      type: String,
      enum: ['Premade', 'Custom'],
      default: 'Premade'
    },

    // Specifications
    cadCode: { type: String, unique: true },

    // Metal Weight Configuration with specific parameters
    metalWeight: [
      {
        weight: { type: Number }, // in grams
        metalType: {
          type: String,
          required: true
        }
      }
    ],

    averageWidth: { type: Number }, // in mm
    vintageNumber: { type: String },

    // SEO Meta Details
    metaDetails: {
      metaTitle: { type: String },
      metaDescription: { type: String },
      metaKeywords: [{ type: String }]
    },

    // Relationships and Occasions
    relationship: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Relation' }],
    relationshipNames: [{
      type: String
    }],
    occasion: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Occasion' }],
    occasionNames: [{
      type: String
    }],

    // Diamond Type Configuration
    diamondType: {
      type: String,
      enum: ['Natural', 'Lab', 'Both'],
      default: 'Both'
    },

    // Stone Configuration
    stoneConfiguration: {
      // Stone Shape from shape table
      stoneShape: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'shape'
      },
      shapeValue: { type: String }, // Store the shape value/name

      // Stone Size from carat-size table
      stoneSize: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'caratSize'
      },
      sizeValue: { type: String } // Store the size value
    },

    // Customization Options
    customizedJewelry: { type: Boolean, default: false },
    isLabGrown: { type: Boolean, default: false },
    estimatedDeliveryDays: { type: Number, default: 5 },

    // Engraving Options
    engravingOptions: {

      engravingText: { type: String }, // Placeholder/Example text

      isEngravingAvailable: { type: Boolean, default: false },

      maxCharacters: { type: Number, default: 20 },

      engravingCost: {
        baseCost: { type: Number, default: 0 },
        costPerCharacter: { type: Number, default: 0 },
        rushOrderCost: { type: Number, default: 0 }
      },
      additionalDeliveryDays: { type: Number, default: 3 },
      engravingInstructions: { type: String }, // Special instructions for engraving

    },

    // Available Metals
    // availableMetals: {
    //   gold: {
    //     enabled: { type: Boolean, default: false },
    //     types: [{
    //       type: String,
    //       enum: ['18k WhiteGold', '18k RoseGold', '18k YellowGold', '14k WhiteGold', '14k RoseGold', '14k YellowGold']
    //     }]
    //   },
    //   silver: {
    //     enabled: { type: Boolean, default: false },
    //     types: [{ type: String, enum: ['2k White'] }]
    //   },
    //   vermeil: {
    //     enabled: { type: Boolean, default: false },
    //     types: [{ type: String, enum: ['YellowGold', 'WhiteGold', 'RoseGold'] }]
    //   }
    // },

    //  Available Metals
    availableMetals: [{
      metal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MetalDetail',

      },
      metalType: { type: String },
      metalCode: { type: String }, // e.g., '18K'

    }],



    // Default metal selection
    defaultMetal: { type: String },

    // Available Shapes
    availableShapes: [{
      enabled: { type: Boolean, default: false },

      shape: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ShapeDetail',
      },
      shapeCode: { type: String }, // e.g., 'RD' for Round
      name: { type: String }, // e.g., 'Round', 'Oval'
    }],
    defaultShape: { type: String },

    // Available Ring Sizes (if applicable)
    availableRingSizes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RingSize' }],
    stoneSize: [{
      stonesizeValue: { type: String }, // e.g., "0.5 Carat"
      stonesizeid: { type: mongoose.Schema.Types.ObjectId, ref: 'diamondRate' },


    }], // Default stone size
    centerStoneVariation: [{
      // Select all option
      selectAll: { type: Boolean, default: false },

      // Dynamic stones from shapegemstoneDR
      selectedStones: [{
        stoneReference: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'stoneReferenceType' // Dynamic reference to shapegemstoneLC or shapegemstoneDR 
        },
        stoneName: { type: String }, // Store the actual name for quick access
        stoneCode: { type: String }, // Store the stone code for quick access
        isSelected: { type: Boolean, default: false },
        stoneShape: { type: String },
        caratSize: { type: String },
        pricePerCarat: { type: Number },
        rate: { type: Number },
        weight: { type: Number },
        stoneReferenceType: { type: String, enum: ['shapegemstoneLC', 'shapegemstoneDR'] },
      }],

      // Accent stones configuration
      accentStones: [{
        stoneName: { type: String }, // e.g., "Blue Topaz(DRBT)"
        stoneReference: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'stoneReferenceType' // Dynamic reference to shapegemstoneLC or shapegemstoneDR
        },
        stoneShape: { type: mongoose.Schema.Types.ObjectId, ref: 'shape' },
        caratSize: { type: String },
        pricePerCarat: { type: Number },
        rate: { type: Number },
        weight: { type: Number },
        stoneCount: { type: Number },
        stoneType: { type: String },
        stoneReferenceType: { type: String, enum: ['shapegemstoneLC', 'shapegemstoneDR'] } // Specify the type of reference
      }]
    }],

    // LC Variations (Lab Created Variations)
    lcVariations: [{
      selectAll: { type: Boolean, default: false },
      selectedStones: [{
        stoneReference: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'shapegemstoneLC'
        },
        stoneName: { type: String }, // Store the actual name for quick access
        stoneCode: { type: String }, // Store the stone code for quick access
        isSelected: { type: Boolean, default: false }
      }]
    }],


    // Stone Rate Data (From screenshot example)
    stoneRateData: [{
      shape: { type: String }, // e.g., "Heart"
      color: { type: String }, // e.g., "Lab White Diamond", "Amethyst"
      size: { type: String }, // e.g., "6x6mm"
      weight: { type: Number }, // in ct
      pricePerCarat: { type: Number },
      rate: { type: Number },
      isAvailable: { type: Boolean, default: true }
    }],

    // Other Diamonds (Based on screenshot)
    otherDiamonds: [{
      shape: { type: mongoose.Schema.Types.ObjectId, ref: 'shape' }, // e.g., "Asscher"
      caratSize: { type: mongoose.Schema.Types.ObjectId, ref: 'caratSize' }, // e.g., "8mm (3 ct)"
      diamondCount: { type: Number, default: 1 },
      color: { type: String }, // e.g., "Lab White Diamond(CV)"

      // Diamond Rate Data for this specific diamond
      diamondRateData: [{
        shape: { type: String },
        color: { type: String },
        caratSize: { type: String },
        weight: { type: Number }, // in ct
        pricePerCarat: { type: Number },
        rate: { type: Number }
      }]
    }],

    // Diamond Configuration - Reference to dynamic diamond rates
    diamondRates: [{
      rateReference: { type: mongoose.Schema.Types.ObjectId, ref: 'diamondRate' }, // Reference to dynamic diamond rate schema
      groupName: { type: String, required: true }, // e.g., "Group 1", "Group 2"
      sizeRange: { type: String }, // e.g., "0.8mm to 1.25mm"
      minimumQuantity: { type: Number, default: 0 }, // Minimum quantity (0 or 1 as requested)
      pricePerCarat: {
        natural: { type: Number, default: 0 },
        lab: { type: Number, default: 0 }
      },
      costPerCarat: {
        natural: { type: Number, default: 0 },
        lab: { type: Number, default: 0 }
      },
      // Diamond size subgroups within this group
      subGroups: [{
        variable: { type: String }, // e.g., "0.8mm", "0.9mm", "1mm"
        carat: { type: Number }, // e.g., 0.0033, 0.004, 0.005
        numberOfDiamonds: { type: Number, default: 0 },
        estimatedCost: {
          natural: { type: Number, default: 0 },
          lab: { type: Number, default: 0 }
        }
      }],
      totalEstimatedCost: {
        natural: { type: Number, default: 0 },
        lab: { type: Number, default: 0 }
      }
    }],

    // Added Diamonds Summary (from the interface)
    addedDiamonds: {
      totalCostNatural: { type: Number, default: 0 },
      totalCostLab: { type: Number, default: 0 },
      selectedDiamonds: [{
        group: { type: String },
        size: { type: String },
        color: { type: String },
        caratWeight: { type: Number },
        costNatural: { type: Number },
        costLab: { type: Number },

        metalPricing: [{
          metal: { type: String },          // e.g., "14K", "18K", "Platinum"
          priceNatural: { type: Number },   // Final price for natural diamond
          priceLab: { type: Number }        // Final price for lab diamond
        }]
      }],

    },

    // Pricing Structure
    pricing: {
      // Currency and exchange rate reference
      baseCurrency: { type: String, default: 'USD' }, // Base currency
      exchangeRate: { type: mongoose.Schema.Types.ObjectId, ref: 'Exchangerate' }, // Reference to exchange rate schema

      // Variations Array
      variations: [{
        metal: {
          id: { type: mongoose.Schema.Types.ObjectId, ref: 'MetalDetail' },
          name: { type: String },   // e.g. 14K, 18K, 22K
        },
        diamond: {
          id: { type: mongoose.Schema.Types.ObjectId, ref: 'diamondRate' },
          shape: { type: String },
          color: { type: String },
          size: { type: String },       // e.g. "10x5 mm"
          weight: { type: Number },     // carat weight
          pricePerCt: { type: Number }, // from diamondRate
          totalRate: { type: Number }   // computed: weight * pricePerCt
        },
        labourCost: {
          id: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourRate' },
          pricePerGram: { type: Number, default: 0 },
          totalCost: { type: Number, default: 0 }
        },
        totalPrice: { type: Number, default: 0 }, // final computed price for this variation
        isAvailable: { type: Boolean, default: true }
      }],
      // Array so each metal type (14K, 18K, etc.) can have its own pricing
      metalPricing: [{
        metal: {
          id: { type: mongoose.Schema.Types.ObjectId, ref: 'MetalDetail' },
          name: { type: String } // e.g., "14K", "18K", "Platinum"
        },

        // Final Price (quick filter)
        finalPrice: {
          natural: { type: Number, default: 0 },
          lab: { type: Number, default: 0 }
        },

        // Base cost
        cost: { type: Number, default: 0 },

        // Profit margin
        profit: {
          natural: { type: Number, default: 0 },
          lab: { type: Number, default: 0 }
        },

        // Metal pricing
        metalCost: {
          pricePerGram: {
            natural: { type: Number, default: 0 },
            lab: { type: Number, default: 0 }
          },
          totalCost: {
            natural: { type: Number, default: 0 },
            lab: { type: Number, default: 0 }
          }
        },

        // Labour cost (same for natural & lab if not specified)
        labourCost: {
          pricePerGram: { type: Number, default: 0 },
          totalCost: { type: Number, default: 0 }
        },

        // Total Metal + Labour
        totalMetalLabour: {
          natural: { type: Number, default: 0 },
          lab: { type: Number, default: 0 }
        },

        // Metal + Labour + GST
        totalMetalLabourGst: {
          natural: { type: Number, default: 0 },
          lab: { type: Number, default: 0 }
        },

        // Diamond costs
        diamondRateCost: {
          natural: { type: Number, default: 0 },
          lab: { type: Number, default: 0 }
        },

        totalDiamondRate: {
          natural: { type: Number, default: 0 },
          lab: { type: Number, default: 0 }
        },

        // Totals
        totalAmount: {
          natural: { type: Number, default: 0 },
          lab: { type: Number, default: 0 }
        },

        // Additional charges
        shippingCharges: { type: Number, default: 90 },
        packagingCharges: { type: Number, default: 20 },

        // Grand Total
        grandTotal: {
          natural: { type: Number, default: 0 },
          lab: { type: Number, default: 0 }
        }
      }]
    },


    // Discounts
    discounts: {
      specialDiscount: { type: Number, default: 0 }, // percentage
      specialLabDiscount: { type: Number, default: 0 }, // percentage
      applicableDiscounts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Discount' }]
    },
    favourite: { type: Boolean, default: false },
    bestseller: { type: Boolean, default: false },

    // Images - Comprehensive image support (PNG, JPEG, GIF, etc.)
    images: {
      // Main product images by shape
      oval: [{ type: String }], // Shape-specific images
      round: [{ type: String }],
      pear: [{ type: String }],
      cushion: [{ type: String }],
      emerald: [{ type: String }],
      asscher: [{ type: String }],
      heart: [{ type: String }],
      princess: [{ type: String }],
      marquise: [{ type: String }],
      radiant: [{ type: String }],

      // Image variations by metal and color
      variationImages: [{
        metalType: { type: String }, // e.g., '18k WhiteGold', '18k RoseGold'
        shape: { type: String }, // e.g., 'oval', 'round'
        images: [{ type: String }] // Multiple images for this variation
      }],

      // Additional image types

      model: [{ type: String }], // Model wearing images


      // 360 model support (for future implementation)
      model360: {
        enabled: { type: Boolean, default: false },
        modelUrl: { type: String }, // URL to 3D model file
        viewerConfig: { type: mongoose.Schema.Types.Mixed } // Configuration for 360 viewer
      }
    },

    // SEO and Marketing
    metaTitle: { type: String },
    metaDescription: { type: String },
    tags: [{ type: String }],

    // Inventory and Availability
    status: { type: String, enum: ['draft', 'active', 'inactive', 'discontinued'], default: 'draft' },
    inventory: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
    inStock: { type: Boolean, default: true },
    stockQuantity: { type: Number, default: 0 },

    // Business Relations
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    retailer: { type: mongoose.Schema.Types.ObjectId, ref: 'Retailer' },

    // Featured and Highlights
    isFeatured: { type: Boolean, default: false },
    isHighlighted: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },

    // Analytics
    viewCount: { type: Number, default: 0 },
    purchaseCount: { type: Number, default: 0 },
    wishlistCount: { type: Number, default: 0 },

    // Audit Trail
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdOn: { type: Date, default: Date.now },
    updatedOn: { type: Date, default: Date.now }
  },

  // Highlight Products
  'highlight-engagement-products': {
    'highlight-engagement-productsId': { type: String },
    sequence: { type: Number },
    name: { type: String, required: true },
    desktopImage: { type: String }, // Image URL or file path (21:9 aspect ratio)
    mobileImage: { type: String }, // Image URL or file path (1:1 aspect ratio)
    redirectUrl: { type: String }, // URL to redirect when clicked
    isActive: { type: Boolean, default: true }, // Web Display
    isDeleted: { type: Boolean, default: false }
  },

  'highlight-earrings-products': {
    'highlight-earrings-productsId': { type: String },
    sequence: { type: Number },
    name: { type: String, required: true },
    desktopImage: { type: String },
    mobileImage: { type: String },
    redirectUrl: { type: String },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
  },
  'highlight-pendant-products': {
    'highlight-pendant-productsId': { type: String },
    sequence: { type: Number },
    name: { type: String, required: true },
    desktopImage: { type: String },
    mobileImage: { type: String },
    redirectUrl: { type: String },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
  },
  'highlight-bracelet-products': {
    'highlight-bracelet-productsId': { type: String },
    sequence: { type: Number },
    name: { type: String, required: true },
    desktopImage: { type: String },
    mobileImage: { type: String },
    redirectUrl: { type: String },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
  },
  'highlight-weddingbands-products': {
    'highlight-weddingbands-productsId': { type: String },
    sequence: { type: Number },
    name: { type: String, required: true },
    desktopImage: { type: String },
    mobileImage: { type: String },
    redirectUrl: { type: String },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
  },

  //---vendor Portal ---//
  vendor: {
    vendorId: { type: String, unique: true },
    first_name: { type: String, required: true }, // Vendor's first name
    last_name: { type: String, required: true }, // Vendor's last name
    email: { type: String, required: true, unique: true }, // Vendor's email address
    company_name: { type: String, required: true }, // Vendor's company name
    contact_number: { type: String, required: true }, // Vendor's contact number
    origin: { type: String, required: true }, // Vendor's origin (e.g., country)
    operating_From: { type: String, required: true }, // e.g., 'USA', 'India', etc.
    vendor_Type: {
      type: String,
      required: true,
      enum: [
        'Natural Diamond',
        'Lab Grown Diamond',
        'Natural Melle Diamond',
        'Lab Grown Melle Diamond',
        'Jewelry'
      ]
      ,
      immutable: true
    },
    password: { type: String, required: true }, // Vendor's password
    adminVendorPassword: { type: String, required: false }, // Admin-as-vendor password

    // Enhanced documents structure with key-value pairs
    documents: [{
      documentType: { type: String, required: true }, // 'passport', 'pancard', 'businessCard', 'ownerProof', etc.
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
    isDeleted: { type: Boolean, default: false },
    createdOn: { type: Date, default: Date.now },
    updatedOn: { type: Date, default: Date.now }
  },

  // Vendor Diamond Schema
  vendorDiamond: {
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
    brown: { type: String, enum: ["Yes", "No", ''], default: 'No' },
    green: { type: String, enum: ["Yes", "No", ''], default: 'No' },
    milky: { type: String, enum: ["Yes", "No", ''], default: 'No' },
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
    diamondType: { type: String },
    // Timestamps
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    isDeleted: { type: Boolean, default: false },
    createdOn: { type: Date, default: Date.now },
    updatedOn: { type: Date, default: Date.now }
  },

  //--Add Product Catagory--//
  product: {
    productId: { type: String },
    name: { type: String, required: true }, // Name of the product
    description: { type: String }, // Description of the product
    price: { type: Number, required: true }, // Price of the product
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductCategory' }, // Reference to the product category
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductSubCategory' }, // Reference to the product sub-category
    images: [{ type: String }], // Array of image URLs for the product
    createdOn: { type: Date, default: Date.now }, // Timestamp of creation
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  productCategory: {
    productCategoryId: { type: String },
    name: { type: String, required: true }, // Name of the product category
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  //sub catagory
  productSubCategory: {
    productSubCategoryId: { type: String },
    name: { type: String, required: true }, // Name of the product sub-category
    productCategoryId: { type: String, ref: 'productCategory' },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  //---Inquiry Page(contact us) ---//
  Inquiry: {
    contactusId: { type: String },
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    status: { enum: ['pending', 'In Progress', 'completed'] },
    Description: { type: String },
    createdOn: { type: Date, default: Date.now }
  },

  //---banner Page---//
  banner: {
    category: {
      type: String,
      enum: [
        'Home',
        'Engagement ring',
        'Wedding Band',
        'Collection',
        'Earring',
        'Pendant',
        'Bracelet',
        'Constallation'
      ]
    },
    bannerId: { type: String },
    bannerType: { type: String, enum: ['Image', 'Video'] }, // Type of banner
    webMedia: { type: String, required: false }, // Web aspect ratio 32:9
    mobileMedia: { type: String, required: false },
    webMediaAltText: { type: String },
    mobileMediaAltText: { type: String },
    buttonText: { type: String }, // Text for the button
    buttonUrl: { type: String },
    buttonX: { type: Number },
    buttonY: { type: Number }, // Y coordinate for the button
    desktophotspots: {
      type: [
        {
          productName: { type: String },
          productPrice: { type: String },
          productUrl: { type: String },
          x: { type: Number, required: true },
          y: { type: Number, required: true }
        }
      ],

    },
    mobilehotspots: {
      type: [
        {

          productUrl: { type: String },
          x: { type: Number, required: true },
          y: { type: Number, required: true }
        }
      ],

    },
    isActive: { type: Boolean, default: true },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  //---retailer
  retailer: {
    retailerId: { type: String },
    Firstname: { type: String, required: true },
    Lastname: { type: String, required: true },
    Mobilenumber: { type: String },
    companyname: { type: String, required: true }, // Retailer's company name
    ownername: { type: String, required: true }, // Owner's name
    BusinessType: { type: String, enum: ['Manufacturer', 'Wholesaler', 'retailer', 'Others'] }, // Business address
    Comapnyemail: { type: String, required: true, unique: true },
    websiteUrl: { type: String }, // Website URL
    identityproofUrl: { type: String }, // URL for identity proof
    companylicenceUrl: { type: String }, // URL for company license
    status: { type: String, enum: ['Pending', 'Allowed', 'Denied'], default: 'Pending' },
    selectedCoupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' }, // Optional
    couponDetails: {
      couponCode: { type: String },
      discountType: { type: String, enum: ['Percentage', 'Flat'] },
      discountValue: { type: Number },
      minimumAmount: { type: Number },
      validFrom: { type: Date },
      validTo: { type: Date },
      isActive: { type: Boolean, default: true }
    },
    createdOn: { type: Date, default: Date.now }, // Timestamp of creation
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  //---Discount section---//
  flatdiscount: {
    flatdiscountId: { type: String },
    status: { type: Boolean, default: true }, // Active or Inactive

    // Category-wise like 'Engagement Rings', etc.
    discountCategory: { type: String, enum: ['Engagement Rings', 'Wedding Bands', 'Earrings', 'Bracelet', 'Pendant', 'Diamond'] },

    // Allow for all, selected products, or CAD code targeting
    allowThisDiscount: {
      type: String,
      enum: ['all', 'selectProducts', 'cadCode'],
      required: true
    },

    // Array of product ObjectIds (used when allowThisDiscount === 'selectProducts')
    selectedProductIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'jewelry'
      }
    ],

    // Array of CAD codes (used when allowThisDiscount === 'cadCode')
    selectedCadCodes: [{ type: String }],

    // Display fields
    discountName: { type: String, required: true },
    description: { type: String, required: true },

    // %, $ type
    discountUnit: {
      type: String,
      enum: ['%', '$'],
      required: true
    },

    // Actual discount values
    naturalDiscount: {
      type: Number,
      required: true,
      validate: function (value) {
        return this.discountUnit === '%' ? value <= 100 : value >= 0;
      }
    },
    labDiscount: {
      type: Number,
      required: true,
      validate: function (value) {
        return this.discountUnit === '%' ? value <= 100 : value >= 0;
      }
    },

    minimumOrderValue: { type: Number, default: 1 }, // Minimum order in $

    // Optional: expiry logic
    validTill: { type: Date },

    createdOn: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  coupon: {

    couponId: { type: String },
    couponName: { type: String },
    couponCode: { type: String },
    minimumAmount: { type: Number },
    dateRange: {
      start: { type: Date },
      end: { type: Date }
    },
    discountType: { type: String, enum: ['Percentage', 'Flat'] },

    discountValue: { type: Number },
    // allowThisCoupon
    categoryWise: { type: Boolean },
    productWise: { type: Boolean },
    selectedCategory: [{ type: String }], // Ex: ['Engagement Rings', 'Wedding Rings']
    selectedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'jewelry' }],

    couponImage: { type: String }, // Image URL or path
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
  },

  //--- Intro Line ---//
  intro_line: {
    intro_lineId: { type: String },
    Headerintroline: { type: String, required: true }, // Header text for the intro line
    headerurl: { type: String, required: true } // URL for the header link
  },
  //---blog Page---//
  // blog: {
  //   blogId: { type: String },
  //   title: { type: String, required: true },
  //   subtitle: { type: String },
  //   blogType: { type: mongoose.Schema.Types.ObjectId, ref: 'blogType' } // Reference to blogType schema
  // },
  // --- CMS Pages ---
  aboutUs: {
    aboutUsId: { type: String },
    title: { type: String },
    content: { type: String },
    lastUpdated: { type: Date, default: Date.now }
  },
  faq: {
    faqId: { type: String },
    title: { type: String },
    qa: [
      {
        question: [String], // multiple question variations
        answer: [String] // multiple answers to those questions
      }
    ],
    isActive: { type: Boolean, default: true }
  },
  jewelCare: {
    jewelCareId: { type: String },
    title: { type: String },
    description: { type: String },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  blog: {
    blogId: { type: String },
    title: { type: String, required: true },
    subtitle: { type: String },
    slug: { type: String, unique: true }, // SEO-friendly URL
    tags: [{ type: String }],
    metaTitle: { type: String },
    metaDescription: { type: String },
    bannerdescription: { type: String }, // Description for the banner
    category: {
      type: String,
      enum: ['Joy', 'Love', 'Surprise', 'Sadness', 'Fear', 'Anger', 'Other']
    }, // Select Category in admin it is blogtype
    author: { type: String },
    bannerImage: {
      type: String, // URL or file path
      validate: {
        validator: function (v) {
          return /\.(jpg|jpeg|png|webp)$/i.test(v);
        },
        message: 'Invalid image format for bannerImage.'
      }
    },
    thumbnailImage: {
      type: String, // URL or file path
      validate: {
        validator: function (v) {
          return /\.(jpg|jpeg|png|webp)$/i.test(v);
        },
        message: 'Invalid image format for thumbnailImage.'
      }
    },
    content: { type: String }, // main blog content
    blogImage: { type: String },
    hotspots: {
      type: [
        {
          productName: { type: String },
          productPrice: { type: String },
          productUrl: { type: String },
          x: { type: Number, required: true },
          y: { type: Number, required: true }
        }
      ],
      default: undefined //
    },
    blogdescription: { type: String }, // Description for the blog
    isActive: { type: Boolean, default: true },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  //---subscribers ---//
  subscriber: {
    subscriberId: { type: String },
    email: { type: String, unique: true, required: true }, // Subscriber's email address
    subscribedOn: { type: Date, default: Date.now } // Timestamp of subscription
  },

  //--packaging list --//
  packaging: {
    packagingId: { type: String },
    title: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  //--social post --//
  socialpost: {
    socialpostId: { type: String },
    sequence: { type: Number }, // Order of the post
    title: { type: String, required: true }, // Title of the social post
    description: { type: String, required: true }, // Description of the post
    video: { type: String, required: true },
    postsource: {
      type: String,
      required: true,
      enum: ['INSTAGRAM', 'FACEBOOK', 'LINKDIN', 'TWITTER', 'YOUTUBE', 'PINTREST', 'GOOGLE_PLUS']
    },
    AccountUrl: { type: String, required: true }, // URL to the video
    productUrl: { type: String },

    // Array of product ObjectIds
    selectedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'jewelry'
      }
    ],
    isDeleted: { type: Boolean, default: false }
  },

  //virtual Appointments
  virtualappointment: {
    //something about you
    virtualappointmentId: { type: String },
    appointmentId: { type: String, unique: true }, // Custom human-readable ID
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'In_Progress', 'Completed'] },
    jewelryType: { type: String, required: true }, // what are you looking for
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    message: { type: String },
    timezone: { type: String },
    scheduleTime: { type: String },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  //----------------------------------------------------------------------------------------------------------------------//
  // --- CMS Pages ---//
  aboutUs: {
    aboutUsId: { type: String },
    title: { type: String },
    content: { type: String },
    lastUpdated: { type: Date, default: Date.now }
  },

  faq: {
    faqId: { type: String },
    title: { type: String },
    qa: [
      {
        question: [String], // multiple question variations
        answer: [String] // multiple answers to those questions
      }
    ],
    isActive: { type: Boolean, default: true }
  },

  blogType: {
    blogTypeId: { type: String },
    name: { type: String }
  },
  education: {
    educationId: { type: String },
    title: { type: String },
    content: { type: String }
  },
  diamondCircle: {
    diamondCircleId: { type: String },
    title: { type: String },
    content: { type: String }
  },

  // --- Master Settings ---
  shape123: {
    sequence: { type: Number },
    name: { type: String, required: true },
    shapeId: { type: String, required: true }, //shapecode
    shapesubCode: { type: String, required: true }, // e.g., 'R' for Round, 'O' for Oval
    shapeVectorurl: { type: String }, // URL to the vector image of the shape
    shapeImgeUrl: { type: String }, // URL to the image of the shape
    drVariation: { type: String },
    lcVariation: { type: String }
  },
  'carat-size': {
    'carat-sizeId': { type: String },
    sequence: { type: Number, required: true },
    stoneSize: { type: Number, required: true },
    isVisible: { type: Boolean, default: true },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  'blog-type': {
    'blog-typeId': { type: String },
    sequence: { type: Number },
    name: { type: String, required: true },
    blogId: { type: String, required: true }, // blogtypecode
    isVisible: { type: Boolean, default: true } // Web Display
  },
  'education-type': {
    'education-typeId': { type: String },
    sequence: { type: Number },
    name: { type: String, required: true },
    educationtypeId: { type: String, required: true }, // educationtypecode
    isVisible: { type: Boolean, default: true }, // Web Display
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // --- Jewelry Categories ---
  jewelryCategory: {
    jewelryCategoryId: { type: String },
    name: { type: String },
    type: {
      type: String,
      enum: [
        'Engagement Rings',
        'Wedding Bands',
        'Earrings',
        'Necklaces',
        'Bracelets',
        'Relation',
        'Occasion'
      ]
    },
    imageUrl: { type: String }
  },

  // --- Mega Menu ---
  megaMenu: {
    megaMenuId: { type: String },
    header: { type: String },
    links: [{ name: String, url: String }]
  },

  // --- Ring Size ---
  ringsize: {
    ringsizeId: { type: String },
    size: { type: String, immutable: true },
    prices: {
      gold10k: { type: Number, default: 0 },
      gold14k: { type: Number, default: 0 },
      gold18k: { type: Number, default: 0 },
      silver925: { type: Number, default: 0 }
    },
    isDefault: {
      men: { type: Boolean, default: false },
      women: { type: Boolean, default: false }
    },
    gender: {
      men: { type: Boolean, default: false },
      women: { type: Boolean, default: false }
    },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  // --- Customers ---
  customer: {
    customerId: { type: String },
    name: { type: String },
    email: { type: String, unique: true },
    phone: { type: String },
    address: { type: String }
  },
  newsletter: {
    newsletterId: { type: String },
    email: { type: String, unique: true }
  },


  // --- Marketing ---
  promotionalStrip: {
    promotionalStripId: { type: String },
    title: { type: String, required: true },
    prefixtext: { type: String },
    promotionalUrl: { type: String },
    enableTimer: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    timerDateTime: {
      type: Date,
      required: function () {
        return this.enableTimer;
      },
      prefixText: { type: String }
    },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  promotionalImage: {
    promotionalImageId: { type: String },
    imageUrl: { type: String },
    category: { type: String } // engagement rings, earrings, etc.
  },
  introPopup: {
    introPopupId: { type: String },
    content: { type: String },
    isActive: { type: Boolean, default: false },
    imageUrl: { type: String },
    popupCategory: { type: String, enum: ['offer', 'signup'] },
    title: { type: String },
    button1Content: { type: String },
    button2Content: { type: String },
    couponCodeId: { type: String, ref: 'Coupon' },
    link: { type: String },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  // --- Pricing & Discounts ---
  flatDiscount: {
    flatDiscountId: { type: String },
    jewelryType: { type: String }, // e.g., Ring, Necklace, etc.
    allowThisDiscount: { type: Boolean }, // Whether discount is allowed
    siteWide: { type: Boolean }, // If the discount applies site-wide
    product: { type: String }, // Product ID or name
    options: [{ type: String }], // Selected options or variants
    discountName: { type: String },
    description: { type: String },
    discountType: {
      type: String,
      enum: ['Natural Discount', 'Lab Discount']
    },
    flatDiscount: {
      percentage: { type: Number },
      validTill: { type: Date }
    }
  },
  // coupon: {
  //   couponId: { type: String },
  //   couponName: { type: String },
  //   couponCode: { type: String },
  //   minimumAmount: { type: Number },
  //   dateRange: {
  //     start: { type: Date },
  //     end: { type: Date }
  //   },
  //   discountType: { type: String }, // e.g., 'Percentage', 'Flat', etc.
  //   discountValue: { type: Number },
  //   allowThisCoupon: { type: Boolean },
  //   categoryWise: { type: Boolean },
  //   productWise: { type: Boolean },

  //   options: [{ type: String }], // Selected options or product variants
  //   couponImage: { type: String } // Image URL or path
  // },
  exchangerate: {
    exchangerateId: { type: String },
    country: { type: String },
    currencyCode: { type: String },
    rate: { type: Number },
    symbol: { type: String },
    flags: { type: String }, // e.g., 'us'
    isActive: { type: Boolean, default: true },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  metaldetail: {
    metaldetailId: { type: String },
    metalType: { type: String, required: true }, // Gold, Silver, Platinum
    metalCode: { type: String, required: true }, // e.g., GOLD, SILVER
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  metalcolor: {
    metalcolorId: { type: String },
    metalType: { type: String, immutable: true }, // e.g., Gold
    metalColor: { type: String }, // e.g., Yellow Gold
    metalColorCode: { type: String }, // e.g., YG
    metalColorImage: { type: String },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },
  otherprice: {
    otherpriceId: { type: String },
    name: { type: String },
    price: { type: Number },
    createdOn: { type: Date }, // Timestamp of submission
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedOn: { type: Date },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: { type: Boolean, default: false }
  },

  pricemanagement: {
    pricemanagementId: { type: String },
    exchangerates: [
      {
        exchangeratesId: { type: String },
        country: { type: String },
        currencyCode: { type: String },
        rate: { type: Number },
        symbol: { type: String },
        flags: { type: String }, // e.g., 'us'
        active: { type: Boolean }
      }
    ],
    metalDetails: [
      {
        metaldetailsId: { type: String },
        metalType: { type: String }, // e.g., Gold, Silver
        metalCode: { type: String } // e.g., GOLD, SILVER
      }
    ],
    metalColors: [
      {
        metalType: { type: String }, // e.g., Gold
        metalColor: { type: String }, // e.g., Yellow Gold
        metalColorCode: { type: String } // e.g., YG
      }
    ],
    otherPrice: { type: Number },
    diamondRates: { type: Number }
  },

  // --- Products ---
  inventory: {
    inventoryId: { type: String },
    jewelryType: { type: String, required: true },
    averageWidth: { type: Number, required: true }, // in mm
    relationship: { type: String }, // e.g., Sister, Wife, etc.
    cadCode: { type: String, required: true },
    occasion: { type: String }, // e.g., Festival
    title: { type: String, required: true },
    subType: { type: String, required: true }, // e.g., Vintage
    subTitle: { type: String },
    slug: { type: String },
    description: { type: String },

    metaDetails: {
      metaDetailsId: { type: String },
      metaTitle: { type: String },
      metaDescription: { type: String }
    },

    estimatedShippingDays: { type: Number, required: true },

    metals: {
      category: { type: String }, // e.g., Gold, Silver
      variants: [{ type: String }] // e.g., '18k White Gold', 'Yellow Gold Plated'
    },

    metalsWeight: {
      metalsWeightId: { type: String },
      '10k': { type: Number },
      '14k': { type: Number },
      '18k': { type: Number },
      'Silver 925': { type: Number }
    },

    jewelryTypeMode: {
      jewelryTypeModeId: { type: String },
      premadeJewelry: { type: Boolean },
      customJewelry: { type: Boolean }
    },

    diamondType: { type: String, enum: ['Natural', 'Lab', 'Both', 'None'] },

    pricingMode: {
      autoPricing: { type: Boolean },
      manualPricing: { type: Boolean },
      Price: { type: Number, required: true },

    },

    centerStone: {
      centerStoneId: { type: String },
      stoneShapes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shape' }], // e.g., Round, Oval, etc.
      stoneSizes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'carat-size' }], // Carat sizes
      variations: [{ type: String }] // e.g., Red Diamond, Ruby, etc.
    },

    lcVariations: [{ lcVariationId: { type: String }, value: { type: String } }], // Lab-Created stones

    defaultMetal: { type: String }, // e.g., 14K Yellow Gold
    defaultShape: { type: String },
    // e.g., Oval
    otherDiamonds: {
      otherDiamondsId: { type: String },
      shape: { type: String }, // e.g., Round, Oval, etc.
      size: { type: Number }, // Carat size
      diamondcount: { type: Number }, // Number of diamonds
      color: { type: String }, // lc variations and dr variations anme
    },
  },
  collection: {
    collectionId: { type: String },
    name: { type: String },
    description: { type: String },
    desktopImage: { type: String }, // Image URL or file path (21:9 aspect ratio)
    mobileImage: { type: String }, // Image URL or file path (1:1 aspect ratio)
    jewelrySkus: [{ type: String }]
  },

  // --- Dynamic Diamond Rates ---
  // diamondRate: {
  //   diamondRateId: { type: String, unique: true},
  //   groupName: { type: String}, // e.g., "Group 1", "Group 2"
  //   description: { type: String },
  //   sizeRange: { type: String }, // e.g., "0.8mm to 1.25mm"
  //   minimumQuantity: { type: Number, default: 0 }, // Minimum quantity (0 or 1)
  //   maximumQuantity: { type: Number }, // Optional maximum quantity

  //   // Default pricing structure
  //   defaultPricing: {
  //     pricePerCarat: {
  //       natural: { type: Number, default: 0 },
  //       lab: { type: Number, default: 0 }
  //     },
  //     costPerCarat: {
  //       natural: { type: Number, default: 0 },
  //       lab: { type: Number, default: 0 }
  //     }
  //   },

  //   // Available diamond sizes in this group
  //   availableSizes: [{
  //     variable: { type: String, required: true }, // e.g., "0.8mm", "0.9mm", "1mm"
  //     carat: { type: Number, required: true }, // e.g., 0.0033, 0.004, 0.005
  //     pricePerCarat: {
  //       natural: { type: Number, default: 0 },
  //       lab: { type: Number, default: 0 }
  //     }
  //   }],

  //   // Status and availability
  //   isActive: { type: Boolean, default: true },
  //   isDeleted: { type: Boolean, default: false },

  //   // Audit trail
  //   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  //   updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  //   createdOn: { type: Date, default: Date.now },
  //   updatedOn: { type: Date, default: Date.now }
  // },

  // --- Cart ---
  cart: {
    cartId: { type: String, unique: true },
    createdOn: { type: Date, default: Date.now },
    updatedOn: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sessionId: { type: String, required: true }, // Unique session identifier
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    ringsize: { type: String }, // e.g., 6, 7, 8
    items: [
      {
        itemId: { type: String }, // UUID v4 — unique per cart line
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'jewelryModel', required: true },
        quantity: { type: Number, default: 1 },
        // Diamond selected for this jewelry item (from jewelry's addedDiamonds / pricing config)
        diamondDetails: {
          stock_id: { type: String },        // Custom diamond stock ID
          shape: { type: String },
          carats: { type: Number },          // Allow both "carat" and "carats"
          carat: { type: Number },
          col: { type: String },             // Color from inventory
          clar: { type: String },            // Clarity from inventory
          cut: { type: String },
          clarity: { type: String },
          color: { type: String },
          lab: { type: String },             // Can be boolean string ("true"/"false"), certification lab ("IGI", "GIA"), or Boolean
          diamondType: { type: String },     // "Natural", "Lab", etc.
          price: { type: Number },           // base diamond cost
          markup_price: { type: Number }     // customer-facing price after markup
        },
        selectedVariant: {
          selectedOptions: {
            shape: { type: mongoose.Schema.Types.Mixed }, // ref: 'Shape' but allow String
            metaldetail: { type: mongoose.Schema.Types.Mixed }, // ref: 'metaldetail' but allow String
            ringsize: { type: String },
            centerStone: { type: mongoose.Schema.Types.Mixed },
            engraving: {
              text: { type: String },
              font: { type: String },
              position: { type: String }
            }
          },
          customizations: { type: mongoose.Schema.Types.Mixed }
        },
        // Engraving user selection
        engravingOptions: {
          engravingText: { type: String },
          font: { type: String }
        },
        packaging: { type: mongoose.Schema.Types.ObjectId, ref: 'packaging' },
        priceAtTime: { type: Number } // Lock-in price (historical)
      }
    ], coupon: {
      code: { type: String },
      discount: { type: Number, default: 0 }
    },

    utm: {
      source: { type: String },     // utm_source (e.g., google)
      medium: { type: String },     // utm_medium (e.g., cpc)
      campaign: { type: String },   // utm_campaign
      term: { type: String },       // utm_term
      content: { type: String }     // utm_content
    },

    tracking: {
      ip: { type: String },         // User's IP address
      userAgent: { type: String },  // Browser/Device info
      referrer: { type: String }    // Previous page
    },

    notes: { type: String },        // Special instructions or delivery notes


    isCheckedOut: { type: Boolean, default: false }, // Flag to prevent reuse after successful payment
    pendingCheckoutSessionId: { type: String }, // Stripe session ID for pending checkout
  },

  //--whishlist--//
  wishlist: {
    wishlistId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product', // Adjust this to your product model name
      }
    ],
    createdOn: { type: Date, default: Date.now },
    updatedOn: { type: Date },
    isDeleted: { type: Boolean, default: false }
  },

  _imageFields: {
    blog: {
      bannerImage: 'single', // Indicates it's a single image field
      thumbnailImage: 'single',
      blogImage: 'single' // If you had a field like 'blogImage': 'single'
    },
    packaging: {
      imageUrl: 'single'
    },
    introPopup: {
      imageUrl: 'single'
    },
    banner: {
      webMedia: 'single',
      mobileMedia: 'single'
    },
    metalcolor: {
      metalColorImage: 'single'
    },
    shape: {
      shapeImgeurl: 'multiple', // URL to the image of the shape(both vector& Normal)
      shapeWithColorurl: 'multiple', // URL for color& cut variations(g,h,i,j,k)
      shapecuturl: 'multiple', //excelent,verygood etc
      shapeMeasurementurl: 'multiple', // e.g front view ,side view
      /// Image field
      EX: 'single',
      F: 'single',
      G: 'single',
      GD: 'single',
      H: 'single',
      HI: 'single',
      I: 'single',
      J: 'single',
      K: 'single',
      PVT: 'single',
      VG: 'single',
      image: 'single',
      image2: 'single',
      diamond_front_image: 'single',
      diamond_side_image: 'single',

    },
    shapegemstoneLC: {
      shapeImgeurl: 'single'
    },
    shapegemstoneDR: {
      shapeImgeurl: 'single'
    },
    socialpost: {
      video: 'single'
    },
    engagementsubtypelist: {
      imageUrl: 'single' // Image URL or file path for Engagement Sub Type
    },
    weddingbandssubtypelist: {
      imageUrl: 'single' // Image URL or file path for Wedding Bands Sub Type
    },
    earringssubtypelist: {
      imageUrl: 'single' // Image URL or file path for Earrings Sub Type
    },
    braceletsubtypelist: {
      imageUrl: 'single' // Image URL or file path for Bracelet Sub Type
    },
    pendentsubtypelist: {
      imageUrl: 'single' // Image URL or file path for Pendant Sub Type
    },
    'highlight-engagement-products': {
      desktopImage: 'single',
      mobileImage: 'single'
    },
    'highlight-earrings-products': {
      desktopImage: 'single',
      mobileImage: 'single'
    },
    'highlight-pendant-products': {
      desktopImage: 'single',
      mobileImage: 'single'
    },
    'highlight-bracelet-products': {
      desktopImage: 'single',
      mobileImage: 'single'
    },
    'highlight-weddingbands-products': {
      desktopImage: 'single',
      mobileImage: 'single'
    },
    retailer: {
      identityproofUrl: 'single', // URL for identity proof
      companylicenceUrl: 'single' // URL for company license
    },
    order: {
      'progress.confirmed.confirmedImages': 'multiple',
      'progress.manufacturing.manufacturingImages': 'multiple',
      'progress.qualityAssurance.qualityAssuranceImages': 'multiple',
      'progress.outForDelivery.outForDeliveryImages': 'multiple'
    },
    coupon: {
      couponImage: 'single' // Image URL or path for the coupon
    },
    jewelry: {
      // Main product images by shape
      'images.oval': 'multiple',
      'images.round': 'multiple',
      'images.pear': 'multiple',
      'images.princess': 'multiple',
      'images.emerald': 'multiple',
      'images.asscher': 'multiple',
      'images.marquise': 'multiple',
      'images.radiant': 'multiple',
      'images.cushion': 'multiple',
      'images.heart': 'multiple',
      'images.model': 'multiple',

      // Variation images by metal and color
      'variationImages': 'multiple',
      // Lifestyle and detail images (legacy)
      'lifestyleImages': 'multiple',
      'detailImages': 'multiple',
      // Thumbnail for listings (legacy)
      'thumbnailImage': 'single'
    }
  },


};

module.exports = schemas;
