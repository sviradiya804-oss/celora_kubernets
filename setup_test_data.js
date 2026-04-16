
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

const DB_URI = process.env.DATABASE_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/celora';

async function setup() {
    try {
        console.log("Connecting to DB...");
        await mongoose.connect(DB_URI);

        // Define a loose schema to find the product by name, ignoring strict typing for now
        // We know jewelryName='Vertex' exists.
        const Jewelry = mongoose.model('Jewelry', new mongoose.Schema({}, { strict: false, collection: 'jewelrys' }));

        console.log("Searching for 'Vertex'...");
        const product = await Jewelry.findOne({ jewelryName: 'Vertex' });

        if (!product) {
            console.error("Vertex product not found in DB!");
            process.exit(1);
        }

        console.log(`Found Product: ${product.jewelryName}`);
        console.log(`- _id (ObjectId): ${product._id}`);
        console.log(`- jewelryId (UUID): ${product.jewelryId}`);

        // We MUST use the ObjectId for the Cart API, not the UUID
        const config = {
            productId: product._id.toString(),
            userId: '685cd5ad2169d032519eeb3f'
        };

        fs.writeFileSync('test_config.json', JSON.stringify(config, null, 2));
        console.log("Config written to test_config.json");

    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}
setup();
