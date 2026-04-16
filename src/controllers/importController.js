const ExcelJS = require("exceljs");
const Diamond = require("../models/Diamond");

exports.importDiamonds = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload an Excel file." });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.getWorksheet(1); // assuming first sheet
    const rows = [];

    // Skip header row (1)
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip headers

      const [
        imageLink,
        videoLink,
        stoneNo,
        lab,
        carat,
        color,
        clarity,
        rap,
        value,
        discount,
        pricePerCt,
        amount,
        cut,
        polish,
        symmetry,
        fluorescence,
        comment,
        location,
        identify,
        length,
        width,
        culet,
        diamondCreator,
        discountAmount
      ] = row.values.slice(1); // slice to skip first empty cell

      // Add validation here if you like

      rows.push({
        imageLink,
        videoLink,
        stoneNo,
        lab,
        carat: Number(carat),
        color,
        clarity,
        rap: Number(rap),
        value: Number(value),
        discount: Number(discount),
        pricePerCt: Number(pricePerCt),
        amount: Number(amount),
        cut,
        polish,
        symmetry,
        fluorescence,
        comment,
        location,
        identify,
        length: Number(length),
        width: Number(width),
        culet,
        diamondCreator,
        discountAmount: Number(discountAmount)
      });
    });

    // Save all records
    const inserted = await Diamond.insertMany(rows);

    res.status(201).json({
      message: `${inserted.length} diamonds imported successfully.`,
    });
  } catch (err) {
    console.error("Import error:", err);
    next(err);
  }
};
