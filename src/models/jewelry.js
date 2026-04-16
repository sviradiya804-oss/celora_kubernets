const mongoose = require("mongoose");
const schemas = require("../models/schema"); // adjust path

const jewelrySchema = new mongoose.Schema(schemas.addjewelry.JewelryType);

const Jewelry = mongoose.model("Jewelry", jewelrySchema);
