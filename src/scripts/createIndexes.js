const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.DATABASE_URI || 'mongodb+srv://gaurangcelora:OvsvtBIU5Xbtw4W7@cluster0.776rihs.mongodb.net/celoradb?retryWrites=true&w=majority&appName=Cluster0';

async function createIndexes() {
    try {
        await mongoose.connect(uri);
        console.log('Connected to MongoDB...');

        const db = mongoose.connection.db;
        const collection = db.collection('jewelry');

        console.log('Creating Indexes for Jewelry Collection...');

        // 1. Style & Categorization (Most common filters)
        await collection.createIndex({ "subCategory.value": 1, "category.value": 1 });
        console.log('✔ Index created: subCategory.value + category.value');

        // 2. Pricing & Diamond Type (Critical for sorting/filtering)
        await collection.createIndex({ "diamondType": 1, "pricing.metalPricing.grandTotal.natural": 1 });
        await collection.createIndex({ "diamondType": 1, "pricing.metalPricing.grandTotal.lab": 1 });
        console.log('✔ Index created: diamondType + price fields');

        // 3. Shape (Common attribute)
        await collection.createIndex({ "stoneRateData.shape": 1 });
        console.log('✔ Index created: stoneRateData.shape');

        // 4. SubTypes (For the new feature)
        await collection.createIndex({ "subType": 1 });
        console.log('✔ Index created: subType');

        // 5. Text Index for Global Search
        await collection.createIndex({
            "jewelryName": "text",
            "category.value": "text",
            "jewelryId": "text"
        });
        console.log('✔ Index created: Text Index (Name, Category, ID)');

        console.log('All indexes created successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error creating indexes:', err);
        process.exit(1);
    }
}

createIndexes();
