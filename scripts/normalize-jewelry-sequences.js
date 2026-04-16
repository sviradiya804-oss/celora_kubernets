/**
 * Normalize Jewelry Sequences
 * 
 * This script re-numbers all jewelry items to have consecutive sequences
 * within each category (1, 2, 3, 4... instead of 1, 5, 9, 12...)
 * 
 * Usage: node scripts/normalize-jewelry-sequences.js
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

// Normalize sequences
const normalizeSequences = async () => {
    try {
        console.log('\n🔄 Normalizing jewelry sequences...\n');

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

            // Get all items of this type, sorted by current sequence
            const items = await Jewelry.find({
                jewelryType: type
            }).sort({ sequence: 1, createdOn: 1 });

            if (items.length === 0) {
                console.log(`   ℹ️  No items found`);
                continue;
            }

            console.log(`   Found ${items.length} items`);

            // Re-number them consecutively
            let updatedCount = 0;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const newSequence = i + 1;

                // Only update if sequence changed
                if (item.sequence !== newSequence) {
                    await Jewelry.updateOne(
                        { _id: item._id },
                        { $set: { sequence: newSequence } }
                    );
                    updatedCount++;
                }

                // Show progress
                if ((i + 1) % 10 === 0 || (i + 1) === items.length) {
                    process.stdout.write(`\r   ✓ Processed ${i + 1}/${items.length} items (${updatedCount} updated)`);
                }
            }

            console.log(`\n   ✅ Completed: ${updatedCount} items updated`);
            totalUpdated += updatedCount;
            updateSummary[type || 'Uncategorized'] = { total: items.length, updated: updatedCount };
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 NORMALIZATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total items updated: ${totalUpdated}\n`);

        console.log('Breakdown by category:');
        for (const [type, stats] of Object.entries(updateSummary)) {
            console.log(`  • ${type}: ${stats.updated}/${stats.total} items updated`);
        }

        console.log('\n✅ Normalization completed successfully!');

        // Verification
        console.log('\n🔍 Verifying results...');
        for (const type of jewelryTypes) {
            const items = await Jewelry.find({ jewelryType: type }).sort({ sequence: 1 });
            const sequences = items.map(item => item.sequence);
            const isConsecutive = sequences.every((seq, idx) => seq === idx + 1);

            if (isConsecutive) {
                console.log(`✅ ${type}: Sequences are consecutive (1 to ${sequences.length})`);
            } else {
                console.log(`⚠️  ${type}: Sequences are NOT consecutive:`, sequences.join(', '));
            }
        }

    } catch (error) {
        console.error('\n❌ Error during normalization:', error);
        throw error;
    }
};

// Preview function
const previewNormalization = async () => {
    try {
        console.log('\n🔍 PREVIEW MODE - No changes will be made\n');

        const Jewelry = mongoose.models.jewelryModel ||
            mongoose.model('jewelryModel', Schema.jewelry, 'jewelrys');

        const jewelryTypes = await Jewelry.distinct('jewelryType');
        console.log(`Found ${jewelryTypes.length} jewelry types:\n`);

        for (const type of jewelryTypes) {
            const items = await Jewelry.find({ jewelryType: type }).sort({ sequence: 1 });
            const sequences = items.map(item => item.sequence);

            console.log(`📦 ${type || 'Uncategorized'}:`);
            console.log(`   Total items: ${items.length}`);
            console.log(`   Current sequences: ${sequences.join(', ')}`);

            const isConsecutive = sequences.every((seq, idx) => seq === idx + 1);
            if (isConsecutive) {
                console.log(`   Status: ✅ Already consecutive`);
            } else {
                console.log(`   Status: ⚠️  Needs normalization`);
                console.log(`   Will become: ${items.map((_, idx) => idx + 1).join(', ')}`);
            }
            console.log('');
        }

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
                await previewNormalization();
                break;
            default:
                await normalizeSequences();
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
