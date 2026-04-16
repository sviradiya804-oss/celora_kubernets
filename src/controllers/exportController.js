const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const ExcelJS = require('exceljs');
const Schema = require('../models/schema');
const logAction = require('../utils/logAction'); // Import the logging utility
const formatDocument = require('../utils/formatDocument');

exports.exportData = async (req, res, next) => {
  try {
    const { indexName, ids, fromDate, toDate, diamondType } = req.body;

    if (!indexName) {
      return res.status(400).json({ message: 'indexName is required.' });
    }

    // Handle Diamond template export
    if (indexName === 'diamond') {
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Please provide an array of IDs to export.' });
      }

      const workbook = new ExcelJS.Workbook();
      const templatePath = path.join(__dirname, '../templates/DiamondDataSheet.xlsx');
      await workbook.xlsx.readFile(templatePath);

      const worksheet = workbook.getWorksheet(1);

      const Diamond =
        mongoose.models.Diamond || mongoose.model('Diamond', Schema.diamond, 'diamonds');
      const diamonds = await Diamond.find({ _id: { $in: ids } }).lean();

      if (!diamonds.length) {
        return res.status(404).json({ message: 'No records found for the selected IDs.' });
      }

      diamonds.forEach((diamond) => {
        worksheet.addRow([
          diamond._id,
          diamond.Image_link,
          diamond.Video_link,
          diamond.stone_no,
          diamond.lab,
          diamond.carat,
          diamond.color,
          diamond.clarity,
          diamond.rap,
          diamond.value,
          diamond.discount,
          diamond['price/ct'],
          diamond.amount,
          diamond.cut,
          diamond.polish,
          diamond.symmetry,
          diamond.fluorescence,
          diamond.comment,
          diamond.location,
          diamond.identify,
          diamond.length,
          diamond.width,
          diamond.culet,
          diamond.diamond_creator,
          diamond.Discount_amount
        ]);
      });

      // ✅ Log diamond export
      if (req.user) {
        await logAction({
          userId: req.user._id,
          userEmail: req.user.email,
          userRole: req.user.role,
          action: 'export',
          collection: 'diamond',
          documentId: null,
          changes: {
            exportedCount: diamonds.length,
            idsExported: ids || [],
            dateFilter: { fromDate, toDate }
          },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      res.setHeader('Content-Disposition', 'attachment; filename=SelectedDiamondData.xlsx');
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      await workbook.xlsx.write(res);
      return res.end();
    }

    // --- DIAMONDRATE EXPORT (Specific Logic for Population) ---
    if (indexName === 'diamondrate') {
      const DiamondRate =
        mongoose.models.diamondrateModel ||
        mongoose.model('diamondrateModel', Schema.diamondrate, 'diamondrates');

      // Ensure referenced models are registered for population
      if (!mongoose.models.Shape) {
        mongoose.model('Shape', Schema.shape, 'shapes');
      }
      if (!mongoose.models.shapegemstoneDR) {
        mongoose.model('shapegemstoneDR', Schema.shapegemstoneDR, 'shapegemstoneDRs');
      }
      if (!mongoose.models.shapegemstonelc) {
        mongoose.model('shapegemstonelc', Schema.shapegemstoneLC, 'shapegemstonelcs');
      }

      const filter = {};
      if (Array.isArray(ids) && ids.length > 0) {
        filter._id = { $in: ids };
      }
      if (fromDate || toDate) {
        filter.createdOn = {};
        if (fromDate) filter.createdOn.$gte = new Date(fromDate);
        if (toDate) filter.createdOn.$lte = new Date(toDate);
      }

      // Filter by diamondType if provided (supports String or Array)
      if (diamondType) {
        if (Array.isArray(diamondType)) {
          filter.diamondType = { $in: diamondType };
        } else {
          filter.diamondType = diamondType;
        }
      }

      const documents = await DiamondRate.find(filter)
        .populate('Shapename', 'name')
        .populate('color', 'name')
        .lean();

      if (!documents.length) {
        return res.status(404).json({ message: 'No diamond rates found to export.' });
      }

      // Special handling for LabGrownGemStone export
      if (diamondType === 'LabGrownGemStone') {
        const groupedData = {};

        documents.forEach((doc) => {
          const shape = doc.Shapename?.name || doc.shape || '';
          const size = doc.size || '';
          const key = `${shape}-${size}`;

          if (!groupedData[key]) {
            groupedData[key] = {
              shape,
              size,
              bs_weight: 0,
              bs_rate: 0,
              ws_weight: 0,
              ws_rate: 0,
              ry_weight: 0,
              ry_rate: 0,
              ps_weight: 0,
              ps_rate: 0,
              em_weight: 0,
              em_rate: 0,
            };
          }

          const colorName = (doc.color?.name || doc.colorName || '').toLowerCase();

          if (colorName.includes('blue sapphire')) {
            groupedData[key].bs_weight = doc.weight || 0;
            groupedData[key].bs_rate = doc.Price || 0;
          } else if (colorName.includes('white sapphire')) {
            groupedData[key].ws_weight = doc.weight || 0;
            groupedData[key].ws_rate = doc.Price || 0;
          } else if (colorName.includes('ruby')) {
            groupedData[key].ry_weight = doc.weight || 0;
            groupedData[key].ry_rate = doc.Price || 0;
          } else if (colorName.includes('pink sapphire')) {
            groupedData[key].ps_weight = doc.weight || 0;
            groupedData[key].ps_rate = doc.Price || 0;
          } else if (colorName.includes('emerald')) {
            groupedData[key].em_weight = doc.weight || 0;
            groupedData[key].em_rate = doc.Price || 0;
          }
        });

        const formattedDocs = Object.values(groupedData).map((item, index) => ({
          id: index + 1,
          shape: item.shape,
          size: item.size,
          bs_weight: item.bs_weight,
          bs_rate: item.bs_rate,
          ws_weight: item.ws_weight,
          ws_rate: item.ws_rate,
          ry_weight: item.ry_weight,
          ry_rate: item.ry_rate,
          ps_weight: item.ps_weight,
          ps_rate: item.ps_rate,
          em_weight: item.em_weight,
          em_rate: item.em_rate,
        }));

        const worksheet = XLSX.utils.json_to_sheet(formattedDocs);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'LabGrownGemStone');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Log export
        if (req.user) {
          await logAction({
            userId: req.user._id,
            userEmail: req.user.email,
            userRole: req.user.role,
            action: 'EXPORT',
            collection: indexName,
            documentId: null,
            changes: {
              exportedCount: formattedDocs.length,
              idsExported: ids
            },
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        }

        res.setHeader('Content-Disposition', `attachment; filename=LabGrownGemStone_export.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buffer);
      }

      // Format for Excel - Matching Import Format

      const formattedDocs = documents.map(doc => {
        const row = {
          shape: doc.Shapename?.name || doc.shape || '',
          size: doc.size,
          weight: doc.weight,
          color: doc.color?.name || doc.colorName || '',
          colorName: doc.colorName || '',
        };

        // Add rate column based on diamond type to match import expectations
        if (doc.diamondType === 'Natural') {
          row['cv_rate'] = doc.Price;
        } else if (doc.diamondType === 'Labgrown') {
          row['gold_14_18k'] = doc.Price;
        } else {
          // Fallback for GemStones or others
          row['rate'] = doc.Price;
        }

        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedDocs);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DiamondRates');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Log export
      if (req.user) {
        await logAction({
          userId: req.user._id,
          userEmail: req.user.email,
          userRole: req.user.role,
          action: 'EXPORT',
          collection: indexName,
          documentId: null,
          changes: {
            exportedCount: documents.length,
            idsExported: ids
          },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      res.setHeader('Content-Disposition', `attachment; filename=diamondrate_export.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }


    // Dynamic model export (Generic)
    const schemaDefinition = Schema[indexName];
    if (!schemaDefinition) {
      return res.status(400).json({ message: `Invalid indexName: ${indexName}` });
    }

    const Model =
      mongoose.models[`${indexName}Model`] ||
      mongoose.model(`${indexName}Model`, schemaDefinition, `${indexName}s`);

    const filter = {};

    if (Array.isArray(ids) && ids.length > 0) {
      filter._id = { $in: ids };
    }

    const dateField = 'createdOn';
    if (fromDate || toDate) {
      filter[dateField] = {};
      if (fromDate) filter[dateField].$gte = new Date(fromDate);
      if (toDate) filter[dateField].$lte = new Date(toDate);
    }

    const documentsRaw = await Model.find(filter).lean();

    if (!documentsRaw.length) {
      return res.status(404).json({ message: 'No records found to export.' });
    }

    const documents = documentsRaw.map(formatDocument);

    const worksheet = XLSX.utils.json_to_sheet(documents);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // ✅ Log non-diamond export
    if (req.user) {
      await logAction({
        userId: req.user._id,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'EXPORT',
        collection: indexName,
        documentId: null,
        changes: {
          exportedCount: documentsRaw.length, // Fixed: diamonds.length -> documentsRaw.length
          idsExported: ids
        },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    res.setHeader('Content-Disposition', `attachment; filename=${indexName}_export.xlsx`);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    return res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    next(err);
  }
};
