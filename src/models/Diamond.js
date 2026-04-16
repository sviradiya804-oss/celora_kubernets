const mongoose = require("mongoose");

const diamondSchema = new mongoose.Schema(
  {
    imageLink: { type: String },
    videoLink: { type: String },
    stoneNo: { type: String },
    lab: { type: String },
    carat: { type: Number },
    color: { type: String },
    clarity: { type: String },
    rap: { type: Number },
    value: { type: Number },
    discount: { type: Number },
    pricePerCt: { type: Number }, // price/ct
    amount: { type: Number },
    cut: { type: String },
    polish: { type: String },
    symmetry: { type: String },
    fluorescence: { type: String },
    comment: { type: String },
    location: { type: String },
    identify: { type: String },
    length: { type: Number },
    width: { type: Number },
    culet: { type: String },
    diamondCreator: { type: String },
    discountAmount: { type: Number },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

module.exports = mongoose.model("Diamond", diamondSchema);
