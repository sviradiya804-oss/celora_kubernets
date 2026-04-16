const mongoose = require('mongoose');
const Schema = require('./src/models/schema');

const connectDB = async () => {
    try {
        await mongoose.connect("mongodb+srv://gaurangcelora:OvsvtBIU5Xbtw4W7@cluster0.776rihs.mongodb.net/celoradb?retryWrites=true&w=majority&appName=Cluster0", {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};

const dumpEarrings = async () => {
    await connectDB();
    const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', Schema.jewelry, 'jewelrys');

    // Find ALL earrings
    const allEarrings = await Jewelry.find({
        jewelryType: 'Earrings'
    }).sort({ sequence: 1 });

    console.log(`Total Earrings found: ${allEarrings.length}`);
    console.log('-------------------------------------------');

    allEarrings.forEach((item, index) => {
        console.log(`${index}: Seq ${item.sequence} | Deleted: ${item.isDeleted} | ID: ${item._id} | Title: ${item.title}`);
    });

    await mongoose.connection.close();
};

dumpEarrings();
