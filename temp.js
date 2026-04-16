const { v1: uuidv1 } = require('uuid');

const createdById = '685cd5ad2169d032519eeb3f'; // Your ObjectId

const sizes = [
  { size: "4", gold10k: 20, gold14k: 25, gold18k: 30, silver925: 15 },
  { size: "5" },
  { size: "6" },
  { size: "7" },
  { size: "8" },
  { size: "9" },
  { size: "10" },
  { size: "11" },
  { size: "12" },
  { size: "13" },
  { size: "4.5" },
  { size: "5.5" },
  { size: "6.5" },
  { size: "7.5" },
  { size: "8.5" },
  { size: "9.5" },
  { size: "10.5" },
  { size: "11.5" },
  { size: "12.5" }
];

const generatedDocs = sizes.map(item => {
  return {
    ringsizeId: uuidv1(),
    size: item.size,
    prices: {
      gold10k: item.gold10k || 0,
      gold14k: item.gold14k || 0,
      gold18k: item.gold18k || 0,
      silver925: item.silver925 || 0
    },
    gender: { men: true, women: true },
    isDefault: { men: false, women: false },
    createdOn: new Date().toISOString(),
    createdBy: createdById,
    updatedOn: new Date().toISOString(),
    updatedBy: createdById
  };
});

console.log('db.ringsizes.insertMany([');
generatedDocs.forEach((doc, index) => {
  console.log(JSON.stringify(doc, null, 2) + (index < generatedDocs.length - 1 ? ',' : ''));
});
console.log(']);');
