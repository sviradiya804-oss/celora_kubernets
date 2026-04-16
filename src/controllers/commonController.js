const mongoose = require('mongoose');
const Schema = require('../models/schema.js');
const uuid = require('uuid');
const ApiError = require('../utils/ApiError');
const { uploadToAzureBlob, deleteFromAzureBlob } = require('../services/azureStorageService'); // Import the service
const { uploadFilesByFieldName } = require('../services/optimizedUploadService'); // Import optimized upload service
const updateExchangeRates = require('../utils/exchangeRateUpdater'); // Import the exchange rate updater
const logAction = require('../utils/logAction'); // Import the logging utility
const { generateOrderId, generateSubOrderId } = require('../utils/idGenerator'); // Import ID generator
const {
  sendOrderConfirmedEmail,
  sendManufacturingEmail,
  sendQualityAssuranceEmail,
  sendOutForDeliveryEmail,
  sendDeliveredEmail,
  sendRetailerVerificationEmail,
  sendRetailerCouponEmail
} = require('../utils/emailService'); // Import email functions
const { sortJewelryImages } = require('../utils/jewelryImageHelper');
const { invalidateCache } = require('../middlewares/cacheMiddleware');


const { countries } = require('countries-list');

// Helper to find currency by country name
const getCurrencyByCountry = (countryName) => {
  if (!countryName) return null;
  const normalizedName = countryName.toLowerCase().trim();

  // Manual overrides for common aliases
  const overrides = {
    'usa': 'USD', 'us': 'USD', 'united states of america': 'USD',
    'uk': 'GBP', 'great britain': 'GBP', 'england': 'GBP',
    'europe': 'EUR', 'eu': 'EUR',
    'uae': 'AED',
    'korea': 'KRW', 'south korea': 'KRW',
    'russia': 'RUB'
  };

  if (overrides[normalizedName]) return overrides[normalizedName];

  // Search in countries-list
  for (const code in countries) {
    const country = countries[code];
    if (country.name.toLowerCase() === normalizedName) {
      // Handle currency as array or string
      const currency = Array.isArray(country.currency) ? country.currency[0] : country.currency;
      return currency ? currency.split(',')[0] : null;
    }
  }
  return null;
};

// Coupon model (used when assigning coupon to retailer)
const Coupon =
  mongoose.models.Coupon || mongoose.model('Coupon', require('../models/Coupon').schema);

// Insert Handler
// Insert Handler
exports.insert = async (req, res, next) => {
  const indexName = req.params.indexName || req.indexName;
  console.log('Insert Controller - indexName:', indexName, 'Params:', req.params);
  const body = req.body;
  const isBulk = Array.isArray(body);
  const userId = req?.user?._id;
  const Model =
    mongoose.models[`${indexName}Model`] ||
    mongoose.model(`${indexName}Model`, Schema[indexName], `${indexName}s`);
  const hasSequence = Model.schema.paths['sequence'];

  try {
    // --- Parse Coupon Specific Fields (Multipart/Form-Data handling) ---
    if (indexName === 'coupon') {
      const keysToParse = ['dateRange', 'selectedCategory', 'selectedProducts'];
      keysToParse.forEach(key => {
        if (body[key] && typeof body[key] === 'string') {
          try {
            body[key] = JSON.parse(body[key]);
          } catch (e) {
            console.error(`Error parsing ${key} for coupon:`, e);
          }
        }
      });

      // Transform generic Object structure to Simple Array for schema compatibility
      // Input: [{categoryName: 'A'}] -> Output: ['A']
      if (Array.isArray(body.selectedCategory)) {
        body.selectedCategory = body.selectedCategory.map(item =>
          typeof item === 'object' && item.categoryName ? item.categoryName : item
        );
      }

      // Input: [{selectedProductIds: 'ID'}] -> Output: ['ID']
      if (Array.isArray(body.selectedProducts)) {
        body.selectedProducts = body.selectedProducts.map(item =>
          typeof item === 'object' && item.selectedProductIds ? item.selectedProductIds : item
        );
      }
    }

    // --- Parse Banner Hotspots ---
    if (indexName === 'banner') {
      const keysToParse = ['desktophotspots', 'mobilehotspots'];
      keysToParse.forEach(key => {
        if (body[key] && typeof body[key] === 'string') {
          try {
            body[key] = JSON.parse(body[key]);
          } catch (e) {
            console.error(`Error parsing ${key} for banner:`, e);
          }
        }
      });
    }

    // --- Helper Function: Enrich Jewelry Data ---
    const enrichJewelryData = async (data) => {
      if (indexName !== 'jewelry') return data;

      const enrichedData = { ...data };

      // Fetch relationship names
      if (data.relationship && Array.isArray(data.relationship) && data.relationship.length > 0) {
        try {
          const RelationModel = mongoose.models['relationModel'] ||
            mongoose.model('relationModel', Schema['relation'], 'relations');

          const relationIds = data.relationship.map(id =>
            typeof id === 'object' && id.$oid ? mongoose.Types.ObjectId(id.$oid) : mongoose.Types.ObjectId(id)
          );

          const relations = await RelationModel.find(
            { _id: { $in: relationIds }, isDeleted: false },
            { name: 1 }
          ).lean();

          enrichedData.relationshipNames = relations.map(r => r.name);
          console.log(`Added ${relations.length} relationship names:`, enrichedData.relationshipNames);
        } catch (err) {
          console.error('Error fetching relationships:', err);
          enrichedData.relationshipNames = [];
        }
      }

      // Fetch occasion names
      if (data.occasion && Array.isArray(data.occasion) && data.occasion.length > 0) {
        try {
          const OccasionModel = mongoose.models['occasionModel'] ||
            mongoose.model('occasionModel', Schema['occasion'], 'occasions');

          const occasionIds = data.occasion.map(id =>
            typeof id === 'object' && id.$oid ? mongoose.Types.ObjectId(id.$oid) : mongoose.Types.ObjectId(id)
          );

          const occasions = await OccasionModel.find(
            { _id: { $in: occasionIds }, isDeleted: false },
            { name: 1 }
          ).lean();

          enrichedData.occasionNames = occasions.map(o => o.name);
          console.log(`Added ${occasions.length} occasion names:`, enrichedData.occasionNames);
        } catch (err) {
          console.error('Error fetching occasions:', err);
          enrichedData.occasionNames = [];
        }
      }

      return enrichedData;
    };

    // --- BLOG HANDLING ---
    if (indexName === 'blog') {
      console.log('Inserting blog');

      if (!req.files || !Array.isArray(req.files)) {
        console.log('No files or req.files is not an array.');
        return res
          .status(400)
          .json({ success: false, message: 'No files uploaded or invalid file format.' });
      }

      let data = { ...body };

      const bannerImageFile = req.files.find((file) => file.fieldname === 'bannerImage');
      const thumbnailImageFile = req.files.find((file) => file.fieldname === 'thumbnailImage');
      const imagesFiles = req.files.filter((file) => file.fieldname === 'images');

      if (bannerImageFile) {
        console.log('Inserting bannerImage');
        data.bannerImage = await uploadToAzureBlob(
          bannerImageFile.buffer,
          bannerImageFile.originalname,
          'blog'
        );
      }

      if (thumbnailImageFile) {
        data.thumbnailImage = await uploadToAzureBlob(
          thumbnailImageFile.buffer,
          thumbnailImageFile.originalname,
          'blog'
        );
      }

      if (imagesFiles.length > 0) {
        let content = data.content || '';
        for (let i = 0; i < imagesFiles.length; i++) {
          const file = imagesFiles[i];
          const imageUrl = await uploadToAzureBlob(file.buffer, file.originalname, 'blog');
          const placeholder = `![desc](placeholder${i + 1})`;
          const markdownImage = `![desc](${imageUrl})`;
          content = content.replace(placeholder, markdownImage);
        }
        data.content = content;
      }

      // Audit fields and IDs:
      data.createdBy = userId;
      data.updatedBy = userId;
      data.referenceId = uuid.v1();
      data.blogId = uuid.v1();
      data.createdOn = new Date().toISOString();
      data.updatedOn = new Date().toISOString();

      // Save to DB
      const Model =
        mongoose.models['blogModel'] || mongoose.model('blogModel', Schema['blog'], 'blogs');
      const document = new Model(data);
      const savedData = await document.save();

      if (req.user) {
        try {
          await logAction({
            userId: req.user._id,
            userEmail: req.user.email,
            userRole: req.user.role,
            action: 'create',
            collection: indexName,
            payload: savedData
          });
          console.log('Blog insert logged successfully');
        } catch (err) {
          console.error('Blog insert logging failed:', err);
        }
      }

      return res.status(201).json({
        success: true,
        data: savedData,
        responseTimestamp: new Date().toISOString()
      });
    }

    if (indexName === 'order') {
      body.customer = userId;
    }

    const currentSchemaImageFields = Schema._imageFields[indexName];

    // If sequence exists in schema, DO NOT allow bulk insert
    if (isBulk && hasSequence) {
      return next(
        new ApiError(400, `"${indexName}" does not support bulk insert due to sequence handling.`)
      );
    }

    // --- SINGLE INSERT ---
    if (!isBulk) {
      let data = { ...body };

      // --- Handle File Uploads ---
      if (req.files && req.files.length > 0 && currentSchemaImageFields) {
        console.log(`Starting file upload for ${indexName}: ${req.files.length} files`);
        const startTime = Date.now();

        // Use optimized upload for jewelry (handles 70-80+ images efficiently)
        if (indexName === 'jewelry') {
          const uploadOptions = {
            compress: false, // NO COMPRESSION - maintains original quality
            batchSize: 10 // Process 10 files at a time for speed
          };

          const uploadedFileMap = await uploadFilesByFieldName(
            req.files,
            currentSchemaImageFields,
            indexName.toLowerCase(),
            uploadOptions
          );

          // Convert dot-notation keys to nested objects
          // e.g., { 'images.round': [...urls] } -> { images: { round: [...urls] } }
          for (const [key, value] of Object.entries(uploadedFileMap)) {
            if (key.includes('.')) {
              const parts = key.split('.');
              let current = data;
              for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) {
                  current[parts[i]] = {};
                }
                current = current[parts[i]];
              }
              // Merge with existing array if present
              const lastKey = parts[parts.length - 1];
              if (Array.isArray(value)) {
                if (!current[lastKey]) {
                  current[lastKey] = [];
                }
                current[lastKey] = current[lastKey].concat(value);
              } else {
                current[lastKey] = value;
              }
              console.log(`[Jewelry Insert] Converted ${key} to nested structure:`, current[lastKey]);
            } else {
              data[key] = value;
            }
          }

          // Sort images by color and view before saving
          if (data.images && typeof data.images === 'object') {
            for (const shape in data.images) {
              if (Array.isArray(data.images[shape])) {
                data.images[shape] = sortJewelryImages(data.images[shape]);
              }
            }
          }

          const endTime = Date.now();
          console.log(`Jewelry upload completed: ${req.files.length} files in ${(endTime - startTime) / 1000}s (Full Quality - No Compression)`);
          console.log(`[Jewelry Insert] Final data.images:`, JSON.stringify(data.images, null, 2));
        } else {
          // Standard upload for other entities
          const uploadPromises = [];
          const uploadedFileMap = {};

          for (const file of req.files) {
            const fieldName = file.fieldname;
            const fieldType = currentSchemaImageFields[fieldName];

            if (fieldType === 'single') {
              const promise = uploadToAzureBlob(
                file.buffer,
                file.originalname,
                indexName.toLowerCase()
              ).then((imageUrl) => {
                uploadedFileMap[fieldName] = imageUrl;
              });
              uploadPromises.push(promise);
            } else if (fieldType === 'multiple') {
              if (!uploadedFileMap[fieldName]) {
                uploadedFileMap[fieldName] = [];
              }
              const promise = uploadToAzureBlob(file.buffer, file.originalname, indexName).then(
                (imageUrl) => {
                  uploadedFileMap[fieldName].push(imageUrl);
                }
              );
              uploadPromises.push(promise);
            } else {
              console.warn(`Invalid field "${fieldName}" in image upload for "${indexName}"`);
            }
          }

          await Promise.all(uploadPromises);
          Object.assign(data, uploadedFileMap);

          const endTime = Date.now();
          console.log(`Upload completed for ${indexName}: ${req.files.length} files in ${(endTime - startTime) / 1000}s`);
        }
      }

      // --- ENRICH JEWELRY DATA ---
      data = await enrichJewelryData(data);

      // --- ENRICH EXCHANGE RATE DATA ---
      if (indexName === 'exchangerate' && data.country) {
        data.country = data.country.toLowerCase();
        if (!data.currencyCode) {
          const code = getCurrencyByCountry(data.country);
          if (code) data.currencyCode = code;
        }

        // Check for duplicates
        const existing = await Model.findOne({ country: data.country, isDeleted: false });
        if (existing) {
          return next(new ApiError(400, `Exchange rate for country "${data.country}" already exists.`));
        }
      }

      // Audit Fields
      data.createdBy = userId;
      data.updatedBy = userId;
      
      // Special handling for orders: use short IDs
      if (indexName === 'order') {
        data.orderId = generateOrderId(); // Short 12-char ID
        // referenceId is removed - use orderId instead
        
        // Generate subOrderIds for each sub-order
        if (data.subOrders && Array.isArray(data.subOrders)) {
          data.subOrders = data.subOrders.map(subOrder => ({
            ...subOrder,
            subOrderId: generateSubOrderId() // Short 12-char ID for each sub-order
          }));
        }
      } else {
        // For other entities, keep the existing UUID pattern
        data.referenceId = uuid.v1();
        data[`${indexName}Id`] = uuid.v1();
      }
      
      data.createdOn = new Date().toISOString();
      data.updatedOn = new Date().toISOString();

      // Sequence logic
      if (hasSequence && data.sequence === undefined) {
        let sequenceQuery = {};

        // Scope sequence by jewelryType for jewelry items
        if (indexName === 'jewelry' && data.jewelryType) {
          sequenceQuery.jewelryType = data.jewelryType;
        }

        const lastDoc = await Model.findOne(sequenceQuery).sort({ sequence: -1 }).limit(1);
        data.sequence = lastDoc?.sequence ? lastDoc.sequence + 1 : 1;
      }

      const document = new Model(data);
      const savedData = await document.save();

      // Special post-processing
      if (indexName === 'exchangerate') {
        await updateExchangeRates();
      }

      // Logging
      if (req.user) {
        try {
          await logAction({
            userId: req.user._id,
            userEmail: req.user.email,
            userRole: req.user.role,
            action: 'create',
            collection: indexName,
            payload: savedData
          });
          console.log('Insert logged successfully');
        } catch (err) {
          console.error('Insert logging failed:', err);
        }
      }

      return res.status(201).json({
        success: true,
        data: savedData,
        responseTimestamp: new Date().toISOString()
      });
    }

    // --- BULK INSERT ---
    const now = new Date().toISOString();
    let bulkData = body.map((entry) => {
      const item = {
        ...entry,
        createdBy: userId,
        updatedBy: userId,
        createdOn: now,
        updatedOn: now
      };

      // Special handling for orders: use short IDs
      if (indexName === 'order') {
        item.orderId = generateOrderId(); // Short 12-char ID
        // referenceId is removed - use orderId instead
        
        // Generate subOrderIds for each sub-order
        if (item.subOrders && Array.isArray(item.subOrders)) {
          item.subOrders = item.subOrders.map(subOrder => ({
            ...subOrder,
            subOrderId: generateSubOrderId() // Short 12-char ID for each sub-order
          }));
        }
      } else {
        // For other entities, keep the existing UUID pattern
        item.referenceId = uuid.v1();
        item[`${indexName}Id`] = uuid.v1();
      }

      return item;
    });

    // Enrich all jewelry items in bulk
    if (indexName === 'jewelry') {
      bulkData = await Promise.all(bulkData.map(item => enrichJewelryData(item)));
    }

    // Enrich exchange rate data in bulk
    if (indexName === 'exchangerate') {
      bulkData = bulkData.map(entry => {
        if (entry.country) {
          entry.country = entry.country.toLowerCase();
          if (!entry.currencyCode) {
            const code = getCurrencyByCountry(entry.country);
            if (code) entry.currencyCode = code;
          }
        }
        return entry;
      });
    }

    const insertedDocs = await Model.insertMany(bulkData, { ordered: false });

    if (indexName === 'exchangerate') {
      await updateExchangeRates();
    }

    console.log('Starting bulk insert logging');
    if (req.user) {
      try {
        await logAction({
          userId: req.user._id,
          userEmail: req.user.email,
          userRole: req.user.role,
          action: 'create',
          collection: indexName,
          payload: insertedDocs
        });
        console.log('Bulk insert logged successfully');
      } catch (err) {
        console.error('Bulk insert logging failed:', err);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Bulk insert successful',
      count: insertedDocs.length,
      data: insertedDocs,
      responseTimestamp: new Date().toISOString()
    });
  } catch (err) {
    next(new ApiError(err.statusCode || 500, err.message, err.errors));
  }
};

// Update Handler
// Update Handler - MODIFIED TO DELETE OLD IMAGES
exports.update = async (req, res, next) => {
  const indexName = req.params.indexName;
  const id = req.params.id;
  const data = { ...req.body };

  // Debug logging for jewelry updates - at the very start
  if (indexName === 'jewelry') {
    console.log('\n========== JEWELRY UPDATE DEBUG START ==========');
    console.log('[DEBUG] req.body keys:', Object.keys(req.body));
    console.log('[DEBUG] req.files count:', req.files ? req.files.length : 0);
    if (req.files && req.files.length > 0) {
      console.log('[DEBUG] File fieldnames:', req.files.map(f => f.fieldname));
    }
    console.log('[DEBUG] data.images exists:', !!data.images);
    if (data.images) {
      console.log('[DEBUG] data.images:', JSON.stringify(data.images, null, 2));
    }
    // Check for keys containing 'images' with dot notation
    const imagesDotKeys = Object.keys(data).filter(k => k.startsWith('images.'));
    console.log('[DEBUG] Keys starting with "images.":', imagesDotKeys);
    console.log('========== JEWELRY UPDATE DEBUG END ==========\n');
  }

  // --- ENRICH EXCHANGE RATE DATA ---
  if (indexName === 'exchangerate' && data.country) {
    data.country = data.country.toLowerCase();
    if (!data.currencyCode) {
      const code = getCurrencyByCountry(data.country);
      if (code) data.currencyCode = code;
    }
  }

  // --- PARSE BANNER HOTSPOTS ---
  if (indexName === 'banner') {
    const keysToParse = ['desktophotspots', 'mobilehotspots'];
    keysToParse.forEach(key => {
      if (data[key] && typeof data[key] === 'string') {
        try {
          data[key] = JSON.parse(data[key]);
        } catch (e) {
          console.error(`Error parsing ${key} for banner:`, e);
        }
      }
    });
  }

  try {
    if (!id) {
      return next(new ApiError(400, 'Document ID is required for updates.'));
    }
    if (indexName === 'blog') {
      // 1. Get the existing document
      const Model =
        mongoose.models['blogModel'] || mongoose.model('blogModel', Schema['blog'], 'blogs');
      const existingDocument = await Model.findOne({
        $or: [{ blogId: id }, { referenceId: id }]
      });
      if (!existingDocument) {
        return next(new ApiError(404, 'Blog not found for updating.', { id }));
      }

      // 2. Handle bannerImage
      const bannerImageFile = req.files.find((file) => file.fieldname === 'bannerImage');
      if (bannerImageFile) {
        if (existingDocument.bannerImage) {
          await deleteFromAzureBlob(existingDocument.bannerImage);
        }
        data.bannerImage = await uploadToAzureBlob(
          bannerImageFile.buffer,
          bannerImageFile.originalname,
          'blog'
        );
      }

      // 3. Handle thumbnailImage
      const thumbnailImageFile = req.files.find((file) => file.fieldname === 'thumbnailImage');
      if (thumbnailImageFile) {
        if (existingDocument.thumbnailImage) {
          await deleteFromAzureBlob(existingDocument.thumbnailImage);
        }
        data.thumbnailImage = await uploadToAzureBlob(
          thumbnailImageFile.buffer,
          thumbnailImageFile.originalname,
          'blog'
        );
      }

      // 4. Handle images for Markdown content
      const imagesFiles = req.files.filter((file) => file.fieldname === 'images');
      if (imagesFiles.length > 0) {
        let content = data.content || existingDocument.content || '';
        for (let i = 0; i < imagesFiles.length; i++) {
          const file = imagesFiles[i];
          const imageUrl = await uploadToAzureBlob(file.buffer, file.originalname, 'blog');
          const placeholder = `![desc](placeholder${i + 1})`;
          const markdownImage = `![desc](${imageUrl})`;
          content = content.replace(placeholder, markdownImage);
        }
        data.content = content;
      }

      // 5. Update audit fields
      if (req.user && req.user._id) {
        data.updatedBy = req.user._id;
      }
      data.updatedOn = new Date().toISOString();

      // 6. Update the document
      const updatedData = await Model.findOneAndUpdate(
        { $or: [{ blogId: id }, { referenceId: id }] },
        { $set: data },
        { new: true, runValidators: true }
      );

      return res.status(200).json(updatedData);
    }
    // Inside your existing update controller logic
    if (indexName === 'retailer') {
      const { status, couponId, selectedCoupon } = req.body;

      const Model =
        mongoose.models['retailerModel'] ||
        mongoose.model('retailerModel', Schema['retailer'], 'retailers');

      const retailer = await Model.findOne({
        $or: [{ retailerId: req.params.id }, { _id: req.params.id }]
      });
      try {
        if (!retailer) return res.status(404).json({ message: 'Retailer not found' });

        // Track whether we should send emails after successful save
        let shouldSendVerification = false;
        let couponToSend = null;

        // Update status if provided (do not send email here)
        if (status) {
          retailer.status = status;
          retailer.updatedOn = new Date();
          retailer.updatedBy = req.user?._id;

          if (status === 'Allowed') {
            shouldSendVerification = true;
          }
        }

        // Assign coupon if provided (do not send email here)
        if (couponId || selectedCoupon) {
          const coupon = await Coupon.findById(couponId || selectedCoupon);
          if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

          retailer.selectedCoupon = coupon._id;

          // Populate couponDetails on retailer using common coupon fields with safe fallbacks
          retailer.couponDetails = {
            couponCode: coupon.couponCode || coupon.code || coupon.name || '',
            discountType:
              coupon.discountType || coupon.type || coupon.discount_type || undefined,
            discountValue:
              coupon.discountValue ?? coupon.value ?? coupon.amount ?? undefined,
            minimumAmount:
              coupon.minimumAmount ?? coupon.minAmount ?? coupon.minPurchase ?? undefined,
            validFrom: coupon.validFrom || coupon.startDate || coupon.startsAt || undefined,
            validTo: coupon.validTo || coupon.endDate || coupon.expiresAt || undefined,
            isActive:
              typeof coupon.isActive === 'boolean'
                ? coupon.isActive
                : coupon.active ?? true
          };

          couponToSend = coupon;
        }

        const updatedRetailer = await retailer.save();

        // Respond immediately with success regardless of later email errors
        res.status(200).json({
          success: true,
          message: 'Retailer updated successfully.',
          data: updatedRetailer,
          responseTimestamp: new Date().toISOString()
        });

        // Send emails in background; log errors but do not change response
        if (shouldSendVerification) {
          sendRetailerVerificationEmail(updatedRetailer.Comapnyemail, updatedRetailer.Firstname)
            .then(() => console.log('Retailer verification email sent'))
            .catch((err) => console.error('Failed to send verification email:', err.message || err));
        }

        if (couponToSend) {
          sendRetailerCouponEmail(updatedRetailer.Comapnyemail, updatedRetailer.Firstname, couponToSend)
            .then(() => console.log('Retailer coupon email sent'))
            .catch((err) => console.error('Failed to send coupon email:', err.message || err));
        }
      } catch (err) {
        console.error('Error updating retailer:', err);
        return res.status(500).json({ success: false, error: 'Internal server error' });
      }
    }

    if (indexName === 'order') {
      const Model =
        mongoose.models['orderModel'] || mongoose.model('orderModel', Schema['order'], 'orders');
      const existingDocument = await Model.findOne({
        orderId: id
      });
      if (!existingDocument) {
        return next(new ApiError(404, 'Order not found for updating.', { id }));
      }

      // Fetch customer for email
      const User = mongoose.models.User || mongoose.model('User', require('../models/User').schema);
      const customer = await User.findById(existingDocument.customer);
      const email = customer?.email;
      const name = customer?.name || 'Customer';
      const emailData = {
        customerName: name,
        orderId: existingDocument.orderId || existingDocument._id,
        orderDate: new Date().toLocaleDateString(),
        trackingId: data.trackingId,
        trackingLink: data.trackingLink
      };

      // Handle file uploads for progress images
      const uploadedImageUrls = {};
      if (req.files && req.files.length > 0) {
        console.log(
          'Files uploaded:',
          req.files.map((f) => ({ fieldname: f.fieldname, originalname: f.originalname }))
        );

        for (const file of req.files) {
          const fieldName = file.fieldname;

          // Check if this is a progress image field
          if (fieldName.includes('progress[') && fieldName.includes('Images')) {
            const url = await uploadToAzureBlob(file.buffer, file.originalname, 'order');

            // Parse the field name to get the stage and image type
            // Example: progress[confirmed][confirmedImages] -> confirmed, confirmedImages
            const match = fieldName.match(/progress\[([^\]]+)\]\[([^\]]+)\]/);
            if (match) {
              const stage = match[1];
              const imageType = match[2];

              if (!uploadedImageUrls[stage]) {
                uploadedImageUrls[stage] = {};
              }
              if (!uploadedImageUrls[stage][imageType]) {
                uploadedImageUrls[stage][imageType] = [];
              }
              uploadedImageUrls[stage][imageType].push(url);
            }
          }
        }
      }

      // Debug log
      console.log('Order update request body:', req.body);
      console.log('Order progress update:', data.progress);
      console.log('Current status:', existingDocument.status);
      console.log('Data object keys:', Object.keys(data));
      console.log('Uploaded image URLs:', uploadedImageUrls);
      console.log('Existing document progress:', existingDocument.progress);

      // Merge uploaded images with progress data
      if (Object.keys(uploadedImageUrls).length > 0) {
        if (!data.progress) data.progress = {};

        for (const [stage, stageData] of Object.entries(uploadedImageUrls)) {
          if (!data.progress[stage]) data.progress[stage] = {};

          for (const [imageType, imageUrls] of Object.entries(stageData)) {
            // Merge with existing images if any
            const existingImages = existingDocument.progress?.[stage]?.[imageType] || [];
            data.progress[stage][imageType] = [...existingImages, ...imageUrls];
          }
        }
      } else if (req.body.progress) {
        // If no files uploaded but progress data is provided, preserve existing images
        if (!data.progress) data.progress = {};

        for (const [stage, stageData] of Object.entries(req.body.progress)) {
          if (!data.progress[stage]) data.progress[stage] = {};

          for (const [imageType, imageUrls] of Object.entries(stageData)) {
            if (imageType.includes('Images')) {
              // Preserve existing images if no new ones uploaded
              const existingImages = existingDocument.progress?.[stage]?.[imageType] || [];
              data.progress[stage][imageType] = imageUrls.length > 0 ? imageUrls : existingImages;
            } else {
              data.progress[stage][imageType] = imageUrls;
            }
          }
        }
      }

      console.log('Final progress data after merge:', data.progress);

      let emailSent = false;
      let emailStage = null;
      let emailResult = null;

      // Check for progress updates and handle status/email
      if (data.progress && typeof data.progress === 'object') {
        // Confirmed
        if (data.progress.confirmed) {
          data.status = 'Confirmed';
          emailStage = 'Confirmed';
          try {
            emailResult = await sendOrderConfirmedEmail(
              email,
              emailData,
              data.progress.confirmed.confirmedImages || []
            );
            emailSent = true;
          } catch (err) {
            console.error('[Order][Email] Confirmed error:', err);
            emailResult = err.message;
          }
        }
        // Manufacturing
        if (data.progress.manufacturing) {
          emailStage = 'Manufacturing';
          try {
            emailResult = await sendManufacturingEmail(
              email,
              emailData,
              data.progress.manufacturing.manufacturingImages || []
            );
            emailSent = true;
          } catch (err) {
            console.error('[Order][Email] Manufacturing error:', err);
            emailResult = err.message;
          }
        }
        // Quality Assurance
        if (data.progress.qualityAssurance) {
          emailStage = 'Quality Assurance';
          try {
            emailResult = await sendQualityAssuranceEmail(
              email,
              emailData,
              data.progress.qualityAssurance.qualityAssuranceImages || []
            );
            emailSent = true;
          } catch (err) {
            console.error('[Order][Email] Quality Assurance error:', err);
            emailResult = err.message;
          }
        }
        // Out For Delivery
        if (data.progress.outForDelivery) {
          emailStage = 'Out For Delivery';
          try {
            emailResult = await sendOutForDeliveryEmail(
              email,
              emailData,
              data.progress.outForDelivery.outForDeliveryImages || []
            );
            emailSent = true;
          } catch (err) {
            console.error('[Order][Email] Out For Delivery error:', err);
            emailResult = err.message;
          }
        }
        // Delivered
        if (data.progress.delivered) {
          data.status = 'Completed';
          emailStage = 'Delivered';
          try {
            emailResult = await sendDeliveredEmail(email, emailData);
            emailSent = true;
          } catch (err) {
            console.error('[Order][Email] Delivered error:', err);
            emailResult = err.message;
          }
        }
      }

      // Log email sending
      if (emailSent && emailStage) {
        if (!data.$push) data.$push = {};
        data.$push.emailLog = {
          stage: emailStage,
          sentAt: new Date(),
          success: typeof emailResult === 'string' ? false : true,
          error: typeof emailResult === 'string' ? emailResult : undefined
        };
        console.log(`[Order][Email] ${emailStage} email sent. Result:`, emailResult);
      }
      // Only allow status to be Pending, Confirmed, or Completed
      if (data.status && !['Pending', 'Confirmed', 'Completed'].includes(data.status)) {
        data.status = existingDocument.status;
      }
    }

    const Model =
      mongoose.models[`${indexName}Model`] ||
      mongoose.model(`${indexName}Model`, Schema[indexName], `${indexName}s`);

    // Handle role field conversion for user updates
    console.log('Update Debug - Index Name:', indexName);
    console.log('Update Debug - Original Data:', data);

    if (indexName === 'user') {
      try {
        // Get the User model
        const UserModel = mongoose.models.User || mongoose.model('User', Schema['user']);

        // Convert role to ObjectId if present
        if (data.role) {
          data.role = new mongoose.Types.ObjectId(data.role.toString());
        }

        // Find and update user directly using UserModel
        const updatedUser = await UserModel.findByIdAndUpdate(
          id,
          { $set: data },
          { new: true, runValidators: true }
        );

        if (!updatedUser) {
          return next(new ApiError(404, 'User not found'));
        }

        // Return the updated user directly
        return res.status(200).json(updatedUser);

      } catch (err) {
        return next(new ApiError(400, `Error updating user: ${err.message}`));
      }
    }

    // 1. Retrieve the existing document to get old image URLs
    // Allow UUID (string) or ObjectId for schemanameId
    let orConditions = [
      { [`${indexName}Id`]: id },
      { referenceId: id }
    ];
    // If id is a valid ObjectId, also match _id
    if (mongoose.Types.ObjectId.isValid(id)) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(id) });
    }
    const existingDocument = await Model.findOne({ $or: orConditions });

    if (!existingDocument) {
      return next(new ApiError(404, 'Document not found for updating.', { id }));
    }

    if (Model.schema.paths['sequence'] && data.newIndex !== undefined) {
      const newIndex = parseInt(data.newIndex);
      // Removed transaction to support standalone MongoDB instances
      // const session = await mongoose.startSession();
      // session.startTransaction();

      try {
        // Build query to scope by category for jewelry
        // Treat checking isDeleted as false OR missing (for legacy data)
        let findQuery = { $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] };
        if (indexName === 'jewelry') {
          if (!existingDocument.jewelryType) {
            return next(new ApiError(400, 'Jewelry item must have a "jewelryType" to function in a sequence. Update the item with a jewelryType first.'));
          }
          findQuery.jewelryType = existingDocument.jewelryType;
          console.log(`[Reorder] Scoping to jewelryType: "${existingDocument.jewelryType}"`);
        } else if (existingDocument.jewelryType) {
          // Fallback for other schemas if they happen to have jewelryType (unlikely but safe)
          findQuery.jewelryType = existingDocument.jewelryType;
        }

        const allDocuments = await Model.find(findQuery, { _id: 1, sequence: 1 })
          .sort({ sequence: 1 });
        // .session(session);

        console.log(`[Reorder] Found ${allDocuments.length} documents in scope`);

        // Find current document index in the sorted array
        const currentIndex = allDocuments.findIndex(
          (doc) => doc._id.toString() === existingDocument._id.toString()
        );

        if (currentIndex === -1) {
          console.warn(`[Reorder] Document ${existingDocument._id} not found in sequence (possibly isDeleted=true). Skipping reorder.`);
          delete data.newIndex;
        } else if (currentIndex === newIndex) {
          // If index hasn't changed, skip reordering
          // await session.commitTransaction();
          // session.endSession();
          delete data.newIndex; // Remove from data to prevent field update
        } else {
          console.log(`[Reorder] Moving from index ${currentIndex} to ${newIndex}`);

          // STEP 1: Set all sequences to negative values to avoid unique constraint conflicts
          const tempUpdatePromises = allDocuments.map((doc, index) => {
            return Model.updateOne(
              { _id: doc._id },
              { $set: { sequence: -(index + 1) } }
              // { session }
            );
          });
          await Promise.all(tempUpdatePromises);

          // STEP 2: Reorder the array
          const documentToMove = allDocuments.splice(currentIndex, 1)[0];
          allDocuments.splice(newIndex, 0, documentToMove);

          // STEP 3: Set final positive sequences
          const finalUpdatePromises = allDocuments.map((doc, index) => {
            return Model.updateOne(
              { _id: doc._id },
              { $set: { sequence: index + 1 } }
              // { session }
            );
          });
          await Promise.all(finalUpdatePromises);

          // await session.commitTransaction();
          // session.endSession();

          console.log(`[Reorder] Successfully reordered ${allDocuments.length} items`);

          // Remove newIndex from data and update sequence
          delete data.newIndex;
          data.sequence = newIndex + 1;
        }
      } catch (e) {
        // await session.abortTransaction();
        // session.endSession();
        return next(new ApiError(500, 'Sequence reordering failed: ' + e.message));
      }
    }

    const currentSchemaImageFields = Schema._imageFields ? Schema._imageFields[indexName] : null;
    const deletePromises = []; // Array to store promises for deleting old blobs

    // Helper function to convert bracket notation to dot notation
    // e.g., "images[marquise][1]" -> "images.marquise"
    const bracketToDotNotation = (fieldName) => {
      // Extract base field path from bracket notation (ignoring array indices)
      const match = fieldName.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\[([^\]]+)\])?/);
      if (match && match[2]) {
        // Has bracket notation, convert to dot notation
        const parts = fieldName.split(/\[|\]/).filter(Boolean);
        // Filter out numeric indices and join with dots
        const pathParts = parts.filter(part => isNaN(parseInt(part)));
        return pathParts.join('.');
      }
      return fieldName;
    };

    // Helper function to get nested value from object using dot notation
    const getNestedValue = (obj, path) => {
      return path.split('.').reduce((current, key) => current && current[key], obj);
    };

    // Handle file uploads and existing URLs for jewelry images
    if (indexName === 'jewelry' && currentSchemaImageFields) {
      console.log('[DEBUG] Processing jewelry image data');

      // Step 1: Collect all existing URLs from form data (sent as string values)
      const existingUrlsByField = {};

      // Check bracket notation keys (images[marquise][0], images[marquise][1], etc.)
      for (const key of Object.keys(data)) {
        if (key.startsWith('images[') || key.startsWith('images.')) {
          const normalizedField = bracketToDotNotation(key);
          const value = data[key];

          // Only collect if it's a string URL (not an object)
          if (typeof value === 'string' && value.startsWith('http')) {
            if (!existingUrlsByField[normalizedField]) {
              existingUrlsByField[normalizedField] = [];
            }
            existingUrlsByField[normalizedField].push(value);
            console.log(`[DEBUG] Found existing URL for ${normalizedField}: ${value}`);
          }
        }
      }

      // Also check if data.images exists as a nested object (from some parsers)
      if (data.images && typeof data.images === 'object') {
        for (const [shapeName, urls] of Object.entries(data.images)) {
          if (Array.isArray(urls)) {
            const normalizedField = `images.${shapeName}`;
            for (const url of urls) {
              if (typeof url === 'string' && url.startsWith('http')) {
                if (!existingUrlsByField[normalizedField]) {
                  existingUrlsByField[normalizedField] = [];
                }
                existingUrlsByField[normalizedField].push(url);
                console.log(`[DEBUG] Found existing URL from nested data.images.${shapeName}: ${url}`);
              }
            }
          } else if (typeof urls === 'string' && urls.startsWith('http')) {
            const normalizedField = `images.${shapeName}`;
            if (!existingUrlsByField[normalizedField]) {
              existingUrlsByField[normalizedField] = [];
            }
            existingUrlsByField[normalizedField].push(urls);
            console.log(`[DEBUG] Found existing URL from nested data.images.${shapeName}: ${urls}`);
          }
        }
      }

      console.log('[DEBUG] Existing URLs by field:', Object.keys(existingUrlsByField));

      // Step 2: Group uploaded files by normalized field path
      const filesByField = {};
      if (req.files && req.files.length > 0) {
        console.log('[DEBUG] Received files:', req.files.map(f => f.fieldname));

        for (const file of req.files) {
          const normalizedField = bracketToDotNotation(file.fieldname);
          console.log(`[DEBUG] File fieldname: ${file.fieldname} -> normalized: ${normalizedField}`);

          if (!filesByField[normalizedField]) {
            filesByField[normalizedField] = [];
          }
          filesByField[normalizedField].push(file);
        }
      }

      console.log('[DEBUG] Files grouped by field:', Object.keys(filesByField));

      // Step 3: Get all unique image fields to process (from both existing URLs and new files)
      const allImageFields = new Set([
        ...Object.keys(existingUrlsByField),
        ...Object.keys(filesByField)
      ]);

      console.log('[DEBUG] All image fields to process:', Array.from(allImageFields));

      const uploadPromises = [];
      const uploadedFileMap = {};

      // Step 4: Process each field
      for (const normalizedField of allImageFields) {
        const fieldType = currentSchemaImageFields[normalizedField];
        const existingUrls = existingUrlsByField[normalizedField] || [];
        const files = filesByField[normalizedField] || [];

        console.log(`[DEBUG] Processing ${normalizedField}: type=${fieldType}, existingUrls=${existingUrls.length}, newFiles=${files.length}`);

        if (fieldType === 'multiple') {
          // Start with existing URLs
          uploadedFileMap[normalizedField] = [...existingUrls];

          // Upload new files and add to the array
          for (const file of files) {
            const promise = uploadToAzureBlob(file.buffer, file.originalname, indexName).then(
              (imageUrl) => {
                uploadedFileMap[normalizedField].push(imageUrl);
                console.log(`[DEBUG] Uploaded new image for ${normalizedField}: ${imageUrl}`);
              }
            );
            uploadPromises.push(promise);
          }
        } else if (fieldType === 'single') {
          if (files.length > 0) {
            // Single image with new file - delete old if exists
            const existingUrl = getNestedValue(existingDocument, normalizedField);
            if (existingUrl && typeof existingUrl === 'string') {
              deletePromises.push(deleteFromAzureBlob(existingUrl));
            }
            const file = files[0];
            const promise = uploadToAzureBlob(file.buffer, file.originalname, indexName).then(
              (imageUrl) => {
                uploadedFileMap[normalizedField] = imageUrl;
              }
            );
            uploadPromises.push(promise);
          } else if (existingUrls.length > 0) {
            // No new file, keep existing URL
            uploadedFileMap[normalizedField] = existingUrls[0];
          }
        }
      }

      await Promise.all(uploadPromises);

      // Step 5: Merge uploaded files into data.images with proper nesting
      if (!data.images) data.images = {};

      for (const [fieldPath, urls] of Object.entries(uploadedFileMap)) {
        const parts = fieldPath.split('.');
        if (parts.length === 2 && parts[0] === 'images') {
          // Nested image field like "images.marquise"
          data.images[parts[1]] = urls;
          console.log(`[DEBUG] Set data.images.${parts[1]} to`, Array.isArray(urls) ? `[${urls.length} items]` : urls);
        } else {
          data[fieldPath] = urls;
        }
      }

      // Step 6.5: Sort images by color and view
      if (data.images && typeof data.images === 'object') {
        for (const shape in data.images) {
          if (Array.isArray(data.images[shape])) {
            data.images[shape] = sortJewelryImages(data.images[shape]);
          }
        }
      }

      // Step 6: Clean up bracket notation keys from data to prevent conflicts
      for (const key of Object.keys(data)) {
        if (key.startsWith('images[')) {
          delete data[key];
        }
      }

      console.log('[DEBUG] Final data.images keys:', data.images ? Object.keys(data.images) : 'none');
    } else if (req.files && req.files.length > 0 && currentSchemaImageFields) {
      // Standard handling for non-jewelry schemas
      const uploadPromises = [];
      const uploadedFileMap = {};

      for (const file of req.files) {
        const fieldName = file.fieldname;

        if (currentSchemaImageFields.hasOwnProperty(fieldName)) {
          const fieldType = currentSchemaImageFields[fieldName];

          if (fieldType === 'single') {
            // If a new single image is uploaded for this field,
            // queue the old one for deletion (if it exists)
            if (existingDocument[fieldName] && typeof existingDocument[fieldName] === 'string') {
              deletePromises.push(deleteFromAzureBlob(existingDocument[fieldName]));
            }
            const promise = uploadToAzureBlob(file.buffer, file.originalname, indexName).then(
              (imageUrl) => {
                uploadedFileMap[fieldName] = imageUrl;
              }
            );
            uploadPromises.push(promise);
          } else if (fieldType === 'multiple') {
            // If new images are uploaded for a multiple field,
            // queue ALL old images in that array for deletion (if they exist)
            if (Array.isArray(existingDocument[fieldName])) {
              existingDocument[fieldName].forEach((oldUrl) => {
                if (typeof oldUrl === 'string') {
                  deletePromises.push(deleteFromAzureBlob(oldUrl));
                }
              });
            }
            if (!uploadedFileMap[fieldName]) {
              uploadedFileMap[fieldName] = [];
            }
            const promise = uploadToAzureBlob(file.buffer, file.originalname, indexName).then(
              (imageUrl) => {
                uploadedFileMap[fieldName].push(imageUrl);
              }
            );
            uploadPromises.push(promise);
          }
        } else {
          console.warn(
            `[Update] Uploaded file with fieldname "${fieldName}" not recognized as an image field for schema "${indexName}".`
          );
        }
      }

      await Promise.all(uploadPromises); // Wait for all new uploads to complete
      Object.assign(data, uploadedFileMap); // Merge new image URLs into data
    }

    // IMPORTANT: Wait for all deletions to complete AFTER new uploads are successful
    // This prevents data loss if new upload fails but old image is already deleted.
    // However, if new upload succeeds but delete fails, you'll have orphaned blobs.
    // Consider error handling and retry mechanisms for production.
    await Promise.all(deletePromises);
    if (req.user && req.user._id) {
      data.updatedBy = req.user.id;
    }
    data.updatedOn = new Date().toISOString();

    // Helper function to flatten nested objects to dot notation
    // This prevents MongoDB path conflicts when updating nested fields
    // e.g., { images: { model360: { enabled: false } } } becomes { 'images.model360.enabled': false }
    const flattenObject = (obj, prefix = '', result = {}) => {
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        // Skip null/undefined values
        if (value === null || value === undefined) {
          continue;
        }

        // Check if value is a plain object (not array, not Date, not ObjectId, etc.)
        if (
          typeof value === 'object' &&
          !Array.isArray(value) &&
          !(value instanceof Date) &&
          !(value instanceof mongoose.Types.ObjectId) &&
          (value.constructor === Object || value.constructor === undefined)
        ) {
          flattenObject(value, newKey, result);
        } else {
          result[newKey] = value;
        }
      }
      return result;
    };

    // Flatten the data object to prevent MongoDB path conflicts
    // This is especially important for jewelry updates where:
    // - Form data sends nested objects like images[model360][enabled]
    // - File uploads use dot notation like images.princess
    const flattenedData = flattenObject(data);

    // Debug logging for jewelry updates
    if (indexName === 'jewelry') {
      console.log('[DEBUG] Original data keys:', Object.keys(data));
      console.log('[DEBUG] Flattened data keys:', Object.keys(flattenedData));
      console.log('[DEBUG] Images-related keys in data:', Object.keys(data).filter(k => k.includes('images') || k.includes('Images')));
      console.log('[DEBUG] Images-related keys in flattened:', Object.keys(flattenedData).filter(k => k.includes('images') || k.includes('Images')));
      if (data.images) {
        console.log('[DEBUG] data.images type:', typeof data.images, Array.isArray(data.images) ? 'array' : 'not array');
        console.log('[DEBUG] data.images value:', JSON.stringify(data.images, null, 2));
      }
    }

    // Update the document
    const updateOps = { $set: flattenedData };
    if (data.$push) updateOps.$push = data.$push;


    // Use same orConditions for update
    const updatedData = await Model.findOneAndUpdate(
      { $or: orConditions },
      updateOps,
      { new: true, runValidators: true }
    );

    // No need for this check here, it's done earlier:
    // if (!updatedData) {
    //   return next(new ApiError(404, 'Document not found for updating.', { id }));
    // }
    if (indexName === 'exchangerate') {
      await updateExchangeRates();
    }

    if (req.user) {
      try {
        console.log(`Logging update ${indexName} by user ${req.user._id}`);
        await logAction({
          userId: req.user._id,
          userEmail: req.user.email,
          userRole: req.user.role,
          action: 'update',
          collection: indexName,
          payload: updatedData
        });
        console.log('Logged update successfully');
      } catch (err) {
        console.error('Logging update failed:', err);
      }
    }

    // Invalidate API Cache since an item was updated
    await invalidateCache();

    res.status(200).json(updatedData);
  } catch (err) {
    next(new ApiError(err.statusCode || 500, err.message));
  }
};

// Find One Handler
exports.findOne = async (req, res, next) => {
  const indexNameParam = req.params.indexName;
  const id = req.params.id;

  let indexName = indexNameParam;
  if (indexName === 'helddiamond') indexName = 'diamond';
  if (indexName === 'product') indexName = 'jewelry';

  try {
    const Model =
      mongoose.models[`${indexName}Model`] ||
      mongoose.model(`${indexName}Model`, Schema[indexName], `${indexName}s`);

    const allowedFields = Object.keys(Model.schema.paths);

    // Build the query based on field availability
    let orConditions = [
      { [`${indexName}Id`]: id },
      { referenceId: id }
    ];
    // If id is a valid ObjectId, also match _id
    if (mongoose.Types.ObjectId.isValid(id)) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(id) });
    }

    let query = { $or: orConditions };

    // Only add `isDeleted: false` if field exists
    if (allowedFields.includes('isDeleted')) {
      query.$or = [
        {
          $and: [
            { [`${indexName}Id`]: id },
            { $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] }
          ]
        },
        {
          $and: [
            { referenceId: id },
            { $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] }
          ]
        }
      ];
      // Also add _id match if id is ObjectId
      if (mongoose.Types.ObjectId.isValid(id)) {
        query.$or.push({ $and: [{ _id: new mongoose.Types.ObjectId(id) }, { $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] }] });
      }
    }

    let query_chain = Model.findOne(query);
    
    let document = await query_chain.lean();

    if (!document) {
      return next(new ApiError(404, 'Document not found', { id }));
    }

    // Add pricingBreakdown for orders
    if (indexName === 'order') {
      const orderTotal = document.total || 0;
      const totalSubOrderItems = (document.subOrders || []).reduce((sum, s) => sum + (s.quantity || 1), 0);

      const subOrderBreakdown = (document.subOrders || []).map((s, idx) => {
        let unitPrice = s.priceAtTime || s.productDetails?.price || s.price || 0;
        
        if (unitPrice === 0 && orderTotal > 0 && totalSubOrderItems > 0) {
          unitPrice = orderTotal / totalSubOrderItems;
        }
        
        const quantity = s.quantity || 1;
        const totalPrice = unitPrice * quantity;
        
        return {
          subOrderId: s.subOrderId,
          productId: s.productId,
          title: s.productDetails?.title || s.productDetails?.name || `Item ${idx + 1}`,
          slug: s.productDetails?.slug || null,
          quantity: quantity,
          unitPrice: Math.round(unitPrice * 100) / 100,
          totalPrice: Math.round(totalPrice * 100) / 100,
          itemAmount: Math.round(totalPrice * 100) / 100,
          status: s.status,
          variant: s.productDetails?.selectedVariant || null,
          metalDetail: s.productDetails?.metalDetail || null,
          metalType: s.productDetails?.metalType || null
        };
      });

      document.pricingBreakdown = {
        subOrders: subOrderBreakdown,
        subtotal: document.subtotal || document.total,
        discount: document.discount || 0,
        total: document.total
      };
    }

    res.status(200).json(document);
  } catch (err) {
    next(new ApiError(500, err.message));
  }
};

// Find All or Filtered Documents Handler - MODIFIED FOR PAGINATION
// Find All or Filtered Documents Handler - MODIFIED FOR PAGINATION
exports.find = async (req, res, next) => {
  console.log('Find request query:', req.query);
  let indexName = req.params.indexName;
  const unparsedQuery = Object.keys(req.body).length > 0 ? req.body : req.query;
  // Clone query to allow modification
  let query = { ...unparsedQuery };

  // Support 'filters' param as JSON string (e.g. ?filters={"price":...})
  if (query.filters && typeof query.filters === 'string') {
    try {
      const parsedFilters = JSON.parse(query.filters);
      // Merge parsed filters into the main query object
      query = { ...query, ...parsedFilters };
      // Remove the original string field to avoid processing it as a field
      delete query.filters;
      console.log('Parsed filters param:', parsedFilters);
    } catch (e) {
      console.error('Failed to parse filters param:', e);
    }
  }

  try {
    if (indexName === 'helddiamond') indexName = 'diamond';
    if (indexName === 'product') indexName = 'jewelry';

    const Model =
      mongoose.models[`${indexName}Model`] ||
      mongoose.model(`${indexName}Model`, Schema[indexName], `${indexName}s`);

    const allowedFields = Object.keys(Model.schema.paths);

    const {
      page = 1,
      limit = 10,
      sortBy,
      sortOrder = 'desc',
      fromDate,
      toDate,
      searchField,
      search,
      globalSearch,
      priceSort,
      minPrice,
      maxPrice,
      ...restFilters
    } = query;

    const skip = (parseInt(page) - 1) * parseInt(limit);


    // Sorting logic
    let priceField = 'price';
    if (indexName === 'jewelry') {
      const dType = (query.diamondType || '').toLowerCase();

      // Fix: diamondType in DB can be "Both".
      // If user asks for "Natural", we should match "Natural" OR "Both"
      if (restFilters.diamondType) {
        if (dType === 'natural') {
          restFilters.diamondType = { $in: ['Natural', 'Both'] };
        } else if (dType === 'lab') {
          restFilters.diamondType = { $in: ['Lab', 'Both'] };
        }
      }

      // Detect if this is an engagement ring category
      const categoryVal = (restFilters.category || query.category || '').toString().toLowerCase();
      const isEngagement = ['ring', 'rings', 'engagement ring', 'engagement rings'].includes(categoryVal);

      // Engagement rings → use finalPrice (setting-only price, no center diamond)
      // Other jewelry → use grandTotal (complete price including diamonds, shipping, etc.)
      if (isEngagement) {
        priceField = dType === 'lab'
          ? 'pricing.metalPricing.finalPrice.lab'
          : 'pricing.metalPricing.finalPrice.natural';
      } else {
        priceField = dType === 'lab'
          ? 'addedDiamonds.selectedDiamonds.metalPricing.priceLab'
          : 'addedDiamonds.selectedDiamonds.metalPricing.priceNatural';
      }
      console.log(`[Price] Category: "${categoryVal}", isEngagement: ${isEngagement}, priceField: ${priceField}`);
    }

    let effectiveSortField = '_id';
    let sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Default to ascending order for jewelry if not specified
    if (indexName === 'jewelry' && !query.sortOrder) {
      sortDirection = 1;
    }

    if (priceSort === 'lowToHigh') {
      effectiveSortField = priceField;
      sortDirection = 1;
    } else if (priceSort === 'highToLow') {
      effectiveSortField = priceField;
      sortDirection = -1;
    } else if (sortBy && allowedFields.includes(sortBy)) {
      effectiveSortField = sortBy;
    } else if (allowedFields.includes('createdOn')) {
      effectiveSortField = 'createdOn';
    }

    const sortOptions = { [effectiveSortField]: sortDirection };


    // -------------------------
    // Build Filter Query
    // -------------------------
    const filterQuery = {};

    // Automatic Name-to-ID Resolution for Jewelry SubTypes
    if (indexName === 'jewelry' && restFilters.subType) {
      let modelName = restFilters.subTypeModel;

      // 🧠 Auto-Deduce Model from Category if not provided
      if (!modelName && restFilters.category) {
        const catMap = {
          'Bracelet': 'braceletsubtypelist',
          'Bracelets': 'braceletsubtypelist',
          'Earrings': 'earringssubtypelist',
          'Earring': 'earringssubtypelist',
          'Pendant': 'pendentsubtypelist',
          'Pendants': 'pendentsubtypelist',
          'Ring': 'engagementsubtypelist',
          'Rings': 'engagementsubtypelist',
          'Engagement Ring': 'engagementsubtypelist',
          'Engagement Rings': 'engagementsubtypelist',
          'Wedding Bands': 'weddingbandssubtypelist',
          'Wedding Band': 'weddingbandssubtypelist'
        };
        // precise case-insensitive match if needed, but for now simple map
        modelName = catMap[restFilters.category] || catMap[restFilters.category.value];
      }

      if (modelName) {
        const subTypeVal = restFilters.subType;
        // Use the same convention as the main model: name + Model, collection + s
        const SubModel = mongoose.models[`${modelName}Model`] ||
          (Schema[modelName] ? mongoose.model(`${modelName}Model`, Schema[modelName], `${modelName}s`) : null);

        if (SubModel) {
          if (Array.isArray(subTypeVal)) {
            const resolvedIds = [];
            for (const val of subTypeVal) {
              if (mongoose.Types.ObjectId.isValid(val)) {
                resolvedIds.push(val);
              } else {
                const subDoc = await SubModel.findOne({ $or: [{ name: val }, { subName: val }], isDeleted: false }).select('_id');
                if (subDoc) resolvedIds.push(subDoc._id.toString());
              }
            }
            if (resolvedIds.length > 0) {
              restFilters.subType = resolvedIds;
            } else {
              delete restFilters.subType; // Don't let invalid strings pass
            }
          } else if (!mongoose.Types.ObjectId.isValid(subTypeVal)) {
            const subDoc = await SubModel.findOne({ $or: [{ name: subTypeVal }, { subName: subTypeVal }], isDeleted: false }).select('_id');
            if (subDoc) {
              restFilters.subType = subDoc._id.toString();
            } else {
              delete restFilters.subType; // Don't let invalid strings pass
            }
          }
        }
      } else {
        // Safety: If we have a Name (not ID) but NO Model found, DELETE IT to prevent crash
        const valToCheck = Array.isArray(restFilters.subType) ? restFilters.subType[0] : restFilters.subType;
        if (!mongoose.Types.ObjectId.isValid(valToCheck)) {
          delete restFilters.subType;
        }
      }
    }

    // Automatic Name-to-ID Resolution for Occasion and Relation
    if (indexName === 'jewelry') {
      const resolveField = async (paramKey, modelName) => {
        if (restFilters[paramKey]) {
          const Model = mongoose.models[`${modelName}Model`] ||
            (Schema[modelName] ? mongoose.model(`${modelName}Model`, Schema[modelName], `${modelName}s`) : null);

          if (Model) {
            const val = restFilters[paramKey];
            const resolveVal = async (v) => {
              if (mongoose.Types.ObjectId.isValid(v)) return v;
              // Case-insensitive search match to be more forgiving
              const doc = await Model.findOne({
                name: { $regex: new RegExp(`^${v}$`, 'i') },
                isDeleted: false
              }).select('_id');
              return doc ? doc._id.toString() : null;
            };

            if (Array.isArray(val)) {
              const ids = [];
              for (const v of val) {
                const id = await resolveVal(v);
                if (id) ids.push(id);
              }
              // If we found any valid IDs, replace the filter
              if (ids.length > 0) {
                restFilters[paramKey] = ids;
              } else {
                // If NO valid IDs found, force a non-match query instead of removing the filter
                // We use a random new ObjectId which essentially matches nothing
                restFilters[paramKey] = new mongoose.Types.ObjectId().toString();
              }
            } else {
              const id = await resolveVal(val);
              if (id) {
                restFilters[paramKey] = id;
              } else {
                // If ID not resolvable (and presumably strict matching desired), force non-match
                restFilters[paramKey] = new mongoose.Types.ObjectId().toString();
              }
            }
          }
        }
      };

      await resolveField('occasion', 'occasion');
      await resolveField('occassion', 'occasion'); // Handle common typo
      await resolveField('relation', 'relation');
      await resolveField('relationship', 'relation');
    }



    // Helper to process filters recursively
    const processNestedFilter = (prefix, val, targetQuery) => {
      let pathType = Model.schema.path(prefix);

      // FORCE-ALLOW paths that are known to exist but might fail schema check
      // (e.g., due to Mixed types or ObjectId+subfield definitions)
      const isForcedPath = ['subCategory.value', 'category.value'].includes(prefix);

      // If forced, we mock a String type so the filter logic proceeds
      if (!pathType && isForcedPath) {
        pathType = { instance: 'String' };
      }

      // Handle Boolean strings (e.g., "true", "false") for boolean fields
      if (pathType && pathType.instance === 'Boolean' && typeof val === 'string') {
        const lowerVal = val.toLowerCase();
        if (lowerVal === 'true') val = true;
        if (lowerVal === 'false') val = false;
      }

      // 1. Handle Special Value Objects (Range, Array-$in) that apply to the current path
      // Range { from, to }
      if (typeof val === 'object' && val !== null && !Array.isArray(val) && (val.from || val.to)) {
        if (pathType) {
          const fieldType = pathType.instance;
          targetQuery[prefix] = {};
          if (val.from) {
            targetQuery[prefix].$gte = fieldType === 'Date' ? new Date(val.from) : Number(val.from) || val.from;
          }
          if (val.to) {
            targetQuery[prefix].$lte = fieldType === 'Date' ? new Date(val.to) : Number(val.to) || val.to;
          }
          if (Object.keys(targetQuery[prefix]).length === 0) delete targetQuery[prefix];
        }
        return;
      }

      // Array values (IN)
      if (Array.isArray(val)) {
        // If we have a pathType (real or forced string mock), use it
        if (pathType) {
          const fieldType = pathType.instance;
          targetQuery[prefix] = {
            $in: val.map(v => {
              if (fieldType === 'ObjectId' && mongoose.Types.ObjectId.isValid(v)) {
                return new mongoose.Types.ObjectId(v);
              }
              if (fieldType === 'Number') return Number(v) || v;
              if (fieldType === 'Boolean' && typeof v === 'string') {
                if (v.toLowerCase() === 'true') return true;
                if (v.toLowerCase() === 'false') return false;
              }
              return v;
            })
          };
        } else {
          // Fallback: If no pathType found, auto-detect types for the array
          targetQuery[prefix] = {
            $in: val.map(v => {
              if (mongoose.Types.ObjectId.isValid(v)) {
                return new mongoose.Types.ObjectId(v);
              }
              if (!isNaN(Number(v))) {
                return Number(v);
              }
              return v;
            })
          };
        }
        return;
      }

      // 2. If it's a generic Object, it's likely a nested query (e.g. availableMetals[metalType])
      // We must recurse to find valid leaf paths.
      // BUT FIRST: Check if it is a Mongo Operator object (e.g. { $in: [...] })
      if (typeof val === 'object' && val !== null) {
        // If keys start with $, treat as direct query value, do NOT recurse path
        const keys = Object.keys(val);
        if (keys.length > 0 && keys.some(k => k.startsWith('$'))) {
          targetQuery[prefix] = val;
          return;
        }

        // Otherwise recurse
        for (const [subKey, subVal] of Object.entries(val)) {
          const newPrefix = prefix ? `${prefix}.${subKey}` : subKey;
          processNestedFilter(newPrefix, subVal, targetQuery);
        }
        return;
      }

      // 3. Handle Primitives (Exact Match or Wildcard)
      if (pathType) {
        const fieldType = pathType.instance;

        // Handle string wildcards
        if (fieldType === 'String' && typeof val === 'string' && val.includes('*')) {
          targetQuery[prefix] = { $regex: val.replace(/\*/g, '.*'), $options: 'i' };
        } else if (fieldType === 'ObjectId' && mongoose.Types.ObjectId.isValid(val)) {
          targetQuery[prefix] = new mongoose.Types.ObjectId(val);
        } else if (fieldType === 'Number' && !isNaN(Number(val))) {
          targetQuery[prefix] = Number(val);
        } else {
          // Exact match
          targetQuery[prefix] = val;
        }
      } else {
        // Fallback for paths not found in schema (e.g. Mixed or unknown)
        if (mongoose.Types.ObjectId.isValid(val)) {
          // If it looks like an ID, try querying as an ID (most likely intent for foreign keys)
          targetQuery[prefix] = new mongoose.Types.ObjectId(val);
        } else if (!isNaN(Number(val))) {
          targetQuery[prefix] = Number(val);
        } else {
          targetQuery[prefix] = val;
        }
      }
    };

    // Apply filters
    for (const [field, value] of Object.entries(restFilters)) {
      if (value === undefined || value === null || value === '') continue;

      let actualField = field;
      // Alias mapping for jewelry
      if (indexName === 'jewelry') {
        const mapping = {
          'shape': 'stoneRateData.shape',
          'metal': 'availableMetals.metalType',
          'metalType': 'availableMetals.metalType',
          'category': 'category.value',
          'subCategory': 'subCategory.value',
          'occasion': 'occasion',
          'occassion': 'occasion',
          'relation': 'relationship',
          'relationship': 'relationship',
          'jewelryType': 'category.value',
          'price': priceField, // Dynamically points to finalPrice (engagement) or grandTotal (others)
          'finalprice.natural': 'pricing.metalPricing.finalPrice.natural',
          'finalprice.lab': 'pricing.metalPricing.finalPrice.lab',
          'finalPrice.natural': 'pricing.metalPricing.finalPrice.natural',
          'finalPrice.lab': 'pricing.metalPricing.finalPrice.lab',
          'grandtotal.natural': 'addedDiamonds.selectedDiamonds.metalPricing.priceNatural',
          'grandtotal.lab': 'addedDiamonds.selectedDiamonds.metalPricing.priceLab',
          'grandTotal.natural': 'addedDiamonds.selectedDiamonds.metalPricing.priceNatural',
          'grandTotal.lab': 'addedDiamonds.selectedDiamonds.metalPricing.priceLab',
          'metalColor': 'availableMetals.metalType',
          'style': 'subCategory.value',
          'id': 'jewelryId',
          'name': 'jewelryName',
          'carat': 'caratWeight',
          'width': 'averageWidth',
          'stock': 'stockQuantity',
          'onSale': 'sale.saleActive',
          'saleactive': 'sale.saleActive',
          'saleActive': 'sale.saleActive',
          'subType': 'subType', // Support direct ID filtering
          'subTypeModel': 'subTypeModel' // Support model type filtering
        };
        if (mapping[field]) actualField = mapping[field];
      }

      // Alias mapping for diamonds
      if (indexName === 'diamond' || indexName === 'helddiamond') {
        const mapping = {
          'color': 'col',
          'clarity': 'clar',
          'carat': 'carats'
        };
        if (mapping[field]) actualField = mapping[field];
      }

      // Important: if value is array, processNestedFilter should handle it as $in
      processNestedFilter(actualField, value, filterQuery);
    }


    // Handle soft delete filter - only if isDeleted field exists in schema
    if (allowedFields.includes('isDeleted')) {
      // If there's an existing $or condition, we need to combine it with isDeleted filter
      if (filterQuery.$or) {
        // Save existing $or conditions
        const existingOrConditions = filterQuery.$or;
        // Create $and condition combining existing $or with isDeleted filter
        filterQuery.$and = [
          { $or: existingOrConditions },
          { $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] }
        ];
        // Remove the original $or since it's now part of $and
        delete filterQuery.$or;
      } else {
        // If no existing $or, simply add the isDeleted filter
        filterQuery.$or = [{ isDeleted: false }, { isDeleted: { $exists: false } }];
      }
    }

    // Date range filter
    const dateField = allowedFields.includes('createdOn') ? 'createdOn' : '_id';
    if (fromDate || toDate) {
      filterQuery[dateField] = {};
      if (fromDate) filterQuery[dateField].$gte = new Date(fromDate);
      if (toDate) filterQuery[dateField].$lte = new Date(toDate);
    }

    // Field-specific search
    if (searchField && search) {
      if (!allowedFields.includes(searchField)) {
        return next(
          new ApiError(
            400,
            `Invalid searchField "${searchField}". Allowed: ${allowedFields.join(', ')}`
          )
        );
      }
      filterQuery[searchField] = { $regex: search, $options: 'i' };
    }

    // Global search
    if (globalSearch) {
      const searchTerm = globalSearch.trim();
      const orConditions = [];

      allowedFields.forEach((field) => {
        const fieldType = Model.schema.paths[field]?.instance;

        if (fieldType === 'String') {
          orConditions.push({ [field]: { $regex: searchTerm, $options: 'i' } });
        }
        if (fieldType === 'Number' && !isNaN(Number(searchTerm))) {
          const numVal = Number(searchTerm);
          orConditions.push({ [field]: numVal });
        }
        if (fieldType === 'ObjectId' && mongoose.Types.ObjectId.isValid(searchTerm)) {
          orConditions.push({ [field]: new mongoose.Types.ObjectId(searchTerm) });
        }
      });

      if (orConditions.length > 0) {
        // Fix: Don't override existing $or conditions, merge properly
        if (filterQuery.$or && filterQuery.$or.length > 0) {
          filterQuery.$and = [
            { $or: filterQuery.$or },
            { $or: orConditions }
          ];
          delete filterQuery.$or;
        } else {
          filterQuery.$or = orConditions;
        }
      }
    }

    // -------------------------
    // Calculate Price Range (Jewelry Only)
    // -------------------------
    // We calculate this BEFORE applying the user's minPrice/maxPrice filter,
    // so the slider shows the full range of available items matching OTHER filters.
    let priceRange = null;
    if (indexName === 'jewelry') {
      try {
        // Reuse the same priceField: finalPrice for engagement, grandTotal for others
        const priceFieldAgg = priceField;
        console.log(`[Price Range Agg] Using priceFieldAgg: ${priceFieldAgg}`);

        // Set up distinct unwind paths since arrays are nested differently
        const unwindPaths = [];
        let priceAggField = priceFieldAgg; // the field to min/max against
        let colorMatchStage = null;

        if (priceFieldAgg.includes('addedDiamonds')) {
          unwindPaths.push({ $unwind: "$addedDiamonds.selectedDiamonds" });
          unwindPaths.push({ $unwind: "$addedDiamonds.selectedDiamonds.metalPricing" });
          // Prices for both Natural and Lab variations live in priceNatural.
          // Scope the aggregation to the correct variation by color.
          priceAggField = 'addedDiamonds.selectedDiamonds.metalPricing.priceNatural';
          const isLabAgg = priceFieldAgg.endsWith('Lab') || (query.diamondType || '').toLowerCase() === 'lab';
          colorMatchStage = isLabAgg
            ? { 'addedDiamonds.selectedDiamonds.color': { $regex: /\(LC\)/i } }
            : { 'addedDiamonds.selectedDiamonds.color': { $not: /\(LC\)/i } };
        } else {
          unwindPaths.push({ $unwind: "$pricing.metalPricing" });
        }

        const priceAgg = await Model.aggregate([
          { $match: filterQuery },
          ...unwindPaths,
          ...(colorMatchStage ? [{ $match: colorMatchStage }] : []),
          { $match: { [`${priceAggField}`]: { $gt: 0 } } }, // Exclude zero/uncomputed prices
          {
            $group: {
              _id: null,
              min: { $min: `$${priceAggField}` },
              max: { $max: `$${priceAggField}` }
            }
          }
        ]);

        if (priceAgg.length > 0 && priceAgg[0].min !== null) {
          priceRange = { min: priceAgg[0].min, max: priceAgg[0].max };
        }
      } catch (error) {
        console.error('Price range aggregation failed:', error);
      }
    }

    // Legacy price filtering - IMPROVED for jewelry array
    if ((minPrice || maxPrice) && !filterQuery[priceField]) {
      if (indexName === 'jewelry' && (priceField.startsWith('pricing.') || priceField.startsWith('addedDiamonds.'))) {
        const range = {};
        // Always exclude zero/uncomputed prices
        if (minPrice) {
          range.$gte = Number(minPrice);
        } else {
          range.$gt = 0;
        }
        if (maxPrice) range.$lte = Number(maxPrice);

        // Find which base array to elemMatch over
        if (priceField.includes('addedDiamonds')) {
          // Both Natural and Lab prices are stored in the `priceNatural` key.
          // Natural variations have color "(DR)", Lab variations have color "(LC)".
          // We must scope the $elemMatch to the correct variation so that a Lab
          // price entry doesn't satisfy a Natural price filter and vice versa.
          const isLabPrice = priceField.endsWith('Lab') || (query.diamondType || '').toLowerCase() === 'lab';
          const colorFilter = isLabPrice
            ? { color: { $regex: /\(LC\)/i } }   // Lab diamond variation
            : { color: { $not: /\(LC\)/i } };      // Natural diamond variation (anything not LC)

          filterQuery['addedDiamonds.selectedDiamonds'] = {
            $elemMatch: {
              ...colorFilter,
              metalPricing: {
                $elemMatch: { priceNatural: range }  // always priceNatural — priceLab doesn't exist in DB
              }
            }
          };
        } else {
          const innerField = priceField.replace('pricing.metalPricing.', '');
          filterQuery['pricing.metalPricing'] = { $elemMatch: { [innerField]: range } };
        }
        console.log('[Price Filter] Applied $elemMatch dynamically on range:', JSON.stringify(range));
      } else {
        filterQuery[priceField] = {};
        if (minPrice) filterQuery[priceField].$gte = Number(minPrice);
        if (maxPrice) filterQuery[priceField].$lte = Number(maxPrice);
      }
    }

    // -------------------------
    // Execute Query
    // -------------------------

    const totalCount = await Model.countDocuments(filterQuery);
    const documents = await Model.find(filterQuery)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Note: Currency conversion is now handled by responseConversionMiddleware
    // The middleware will automatically convert all prices before sending response
    // No need to do conversion here anymore

    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: documents,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      totalResults: totalCount,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? parseInt(page) + 1 : null,
      prevPage: hasPrevPage ? parseInt(page) - 1 : null,
      priceRange, // Dynamic price range for slider
      filters: {
        applied: Object.keys(filterQuery).length > 0 ? filterQuery : null,
        sortBy: effectiveSortField,
        sortOrder: sortDirection === 1 ? 'asc' : 'desc'
      }
    });
  } catch (err) {
    next(new ApiError(500, err.message));
  }
};
// Delete Handler
exports.remove = async (req, res, next) => {
  const indexName = req.params.indexName;
  const id = req.params.id;

  try {
    if (!id) {
      return next(new ApiError(400, 'Document ID is required for deletion.'));
    }

    if (indexName === 'blog') {
      const Model =
        mongoose.models['blogModel'] || mongoose.model('blogModel', Schema['blog'], 'blogs');
      const document = await Model.findOne({
        $or: [{ blogId: id }, { referenceId: id }]
      });
      if (!document) {
        return next(new ApiError(404, 'Blog not found.', { id }));
      }

      const deletePromises = [];

      // Delete bannerImage and thumbnailImage from Azure
      if (document.bannerImage) {
        deletePromises.push(deleteFromAzureBlob(document.bannerImage));
      }
      if (document.thumbnailImage) {
        deletePromises.push(deleteFromAzureBlob(document.thumbnailImage));
      }

      // Delete images embedded in Markdown content
      if (document.content) {
        const regex = /!\[.*?\]\((.*?)\)/g;
        let match;
        while ((match = regex.exec(document.content)) !== null) {
          const url = match[1];
          // Only delete if it's an Azure blob URL (optional safety check)
          if (url.includes('celora4images.blob.core.windows.net/blog/')) {
            deletePromises.push(deleteFromAzureBlob(url));
          }
        }
      }

      await Promise.all(deletePromises);

      await Model.deleteOne({
        $or: [{ blogId: id }, { referenceId: id }]
      });

      if (req.user) {
        try {
          console.log(`Logging delete blog by user ${req.user._id}`);
          await logAction({
            userId: req.user._id,
            userEmail: req.user.email,
            userRole: req.user.role,
            action: 'delete',
            collection: 'blog',
            payload: { oldData: document }
          });
          console.log('Logged blog deletion successfully');
        } catch (err) {
          console.error('Logging blog deletion failed:', err);
        }
      }

      await invalidateCache();

      return res.status(200).json({
        message: 'Blog and all associated images deleted successfully.',
        id
      });
    }

    const Model =
      mongoose.models[`${indexName}Model`] ||
      mongoose.model(`${indexName}Model`, Schema[indexName], `${indexName}s`);

    // const session = await mongoose.startSession();
    // session.startTransaction();

    try {
      const document = await Model.findOne({
        $or: [{ [`${indexName}Id`]: id }, { referenceId: id }]
      });
      // .session(session);

      if (!document) {
        // await session.abortTransaction();
        // session.endSession();
        return next(new ApiError(404, 'Document not found.', { id }));
      }

      const deletePromises = [];
      const currentSchemaImageFields = Schema._imageFields ? Schema._imageFields[indexName] : null;

      if (currentSchemaImageFields) {
        for (const [field, type] of Object.entries(currentSchemaImageFields)) {
          const value = document[field];
          if (type === 'single' && typeof value === 'string') {
            deletePromises.push(deleteFromAzureBlob(value));
          } else if (type === 'multiple' && Array.isArray(value)) {
            for (const url of value) {
              if (typeof url === 'string') {
                deletePromises.push(deleteFromAzureBlob(url));
              }
            }
          }
        }
      }

      await Promise.all(deletePromises);

      // Get the sequence of the document to be deleted
      const deletedSequence = document.sequence;

      // Delete the document
      await Model.deleteOne({
        $or: [{ [`${indexName}Id`]: id }, { referenceId: id }]
      });
      // .session(session);

      if (req.user) {
        try {
          console.log(`Logging delete ${indexName} by user ${req.user._id}`);
          await logAction({
            userId: req.user._id,
            userEmail: req.user.email,
            userRole: req.user.role,
            action: 'delete',
            collection: indexName,
            payload: document
          });
          console.log('Logged deletion successfully');
        } catch (err) {
          console.error('Logging deletion failed:', err);
        }
      }

      if (Model.schema.paths['sequence'] && deletedSequence !== undefined) {
        await Model.updateMany(
          { sequence: { $gt: deletedSequence } },
          { $inc: { sequence: -1 } }
          // { session }
        );
      }

      // await session.commitTransaction();
      // session.endSession();

      // Invalidate Cache after successful deletion
      await invalidateCache();

      res.status(200).json({
        message: 'Document and associated media deleted successfully.',
        id
      });
    } catch (err) {
      // await session.abortTransaction();
      // session.endSession();
      return next(new ApiError(err.statusCode || 500, err.message));
    }
  } catch (err) {
    next(new ApiError(err.statusCode || 500, err.message));
  }
};
