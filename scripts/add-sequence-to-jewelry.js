/**
 * Migration Script: Add Sequence Numbers to Existing Jewelry
 * 
 * This script assigns sequence numbers to all existing jewelry items,
 * grouped by their jewelryType (Earrings, Wedding Bands, etc.)
 * 
 * Usage: node scripts/add-sequence-to-jewelry.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('../src/models/schema');

// Connect to MongoDB
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

// Main migration function
const addSequenceToJewelry = async () => {
    try {
        console.log('\n🔄 Starting sequence migration for jewelry items...\n');

        // Get or create the Jewelry model
        const Jewelry = mongoose.models.jewelryModel ||
            mongoose.model('jewelryModel', Schema.jewelry, 'jewelrys');

        // Get all distinct jewelry types
        const jewelryTypes = await Jewelry.distinct('jewelryType');
        console.log(`📊 Found ${jewelryTypes.length} jewelry types:`, jewelryTypes);

        let totalUpdated = 0;
        const updateSummary = {};

        // Process each jewelry type separately
        for (const type of jewelryTypes) {
            console.log(`\n📦 Processing: ${type || 'Uncategorized'}`);

            // Find all items of this type that don't have a sequence
            const items = await Jewelry.find({
                jewelryType: type,
                $or: [
                    { sequence: { $exists: false } },
                    { sequence: null }
                ]
            }).sort({ createdOn: 1 }); // Sort by creation date (oldest first)

            if (items.length === 0) {
                console.log(`   ℹ️  No items need sequence assignment`);
                continue;
            }

            console.log(`   Found ${items.length} items without sequence`);

            // Find the highest existing sequence for this type
            const highestSequenceDoc = await Jewelry.findOne({
                jewelryType: type,
                sequence: { $exists: true, $ne: null }
            }).sort({ sequence: -1 });

            let startSequence = highestSequenceDoc ? highestSequenceDoc.sequence + 1 : 1;
            console.log(`   Starting sequence from: ${startSequence}`);

            // Update each item with a sequence number
            let updatedCount = 0;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const newSequence = startSequence + i;

                await Jewelry.updateOne(
                    { _id: item._id },
                    { $set: { sequence: newSequence } }
                );

                updatedCount++;

                // Show progress every 10 items
                if (updatedCount % 10 === 0 || updatedCount === items.length) {
                    process.stdout.write(`\r   ✓ Updated ${updatedCount}/${items.length} items`);
                }
            }

            console.log(`\n   ✅ Completed: ${updatedCount} items updated`);
            totalUpdated += updatedCount;
            updateSummary[type || 'Uncategorized'] = updatedCount;
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 MIGRATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total items updated: ${totalUpdated}\n`);

        console.log('Breakdown by category:');
        for (const [type, count] of Object.entries(updateSummary)) {
            console.log(`  • ${type}: ${count} items`);
        }

        console.log('\n✅ Migration completed successfully!');

        // Verification
        console.log('\n🔍 Verifying results...');
        const itemsWithoutSequence = await Jewelry.countDocuments({
            $or: [
                { sequence: { $exists: false } },
                { sequence: null }
            ]
        });

        if (itemsWithoutSequence === 0) {
            console.log('✅ All jewelry items now have sequence numbers!');
        } else {
            console.log(`⚠️  Warning: ${itemsWithoutSequence} items still without sequence`);
        }

    } catch (error) {
        console.error('\n❌ Error during migration:', error);
        throw error;
    }
};

// Rollback function (in case you need to undo)
const rollbackSequences = async () => {
    try {
        console.log('\n⚠️  ROLLBACK: Removing all sequence numbers...\n');

        const Jewelry = mongoose.models.jewelryModel ||
            mongoose.model('jewelryModel', Schema.jewelry, 'jewelrys');

        const result = await Jewelry.updateMany(
            {},
            { $unset: { sequence: "" } }
        );

        console.log(`✅ Removed sequence from ${result.modifiedCount} items`);
    } catch (error) {
        console.error('❌ Rollback error:', error);
        throw error;
    }
};

// Preview function (dry run)
const previewMigration = async () => {
    try {
        console.log('\n🔍 PREVIEW MODE - No changes will be made\n');

        const Jewelry = mongoose.models.jewelryModel ||
            mongoose.model('jewelryModel', Schema.jewelry, 'jewelrys');

        const jewelryTypes = await Jewelry.distinct('jewelryType');
        console.log(`Found ${jewelryTypes.length} jewelry types:\n`);

        for (const type of jewelryTypes) {
            const totalCount = await Jewelry.countDocuments({ jewelryType: type });
            const withoutSequence = await Jewelry.countDocuments({
                jewelryType: type,
                $or: [
                    { sequence: { $exists: false } },
                    { sequence: null }
                ]
            });
            const withSequence = totalCount - withoutSequence;

            console.log(`📦 ${type || 'Uncategorized'}:`);
            console.log(`   Total items: ${totalCount}`);
            console.log(`   Already have sequence: ${withSequence}`);
            console.log(`   Need sequence: ${withoutSequence}`);
            console.log('');
        }

        const totalNeedingSequence = await Jewelry.countDocuments({
            $or: [
                { sequence: { $exists: false } },
                { sequence: null }
            ]
        });

        console.log(`\n📊 Total items that will be updated: ${totalNeedingSequence}`);
    } catch (error) {
        console.error('❌ Preview error:', error);
        throw error;
    }
};

// Main execution
const main = async () => {
    await connectDB();

    const args = process.argv.slice(2);
    const command = args[0];

    try {
        switch (command) {
            case 'preview':
                await previewMigration();
                break;
            case 'rollback':
                const readline = require('readline').createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                readline.question('⚠️  Are you sure you want to remove all sequences? (yes/no): ', async (answer) => {
                    if (answer.toLowerCase() === 'yes') {
                        await rollbackSequences();
                    } else {
                        console.log('Rollback cancelled');
                    }
                    readline.close();
                    await mongoose.connection.close();
                    process.exit(0);
                });
                return; // Don't close connection yet
            default:
                await addSequenceToJewelry();
        }

        await mongoose.connection.close();
        console.log('\n👋 Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
};

// Run the script
main();
