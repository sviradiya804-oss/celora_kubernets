# Jewelry Sequence Migration Guide

This guide explains how to add sequence numbers to existing jewelry items in your database.

## What This Does

The migration script assigns sequence numbers to all existing jewelry items, **grouped by their `jewelryType`**:
- Earrings get sequences: 1, 2, 3, 4...
- Wedding Bands get sequences: 1, 2, 3...
- Engagement Rings get sequences: 1, 2, 3...
- And so on for each category

Items are ordered by their creation date (oldest first).

---

## Usage

### Step 1: Preview (Recommended First Step)

See what will be changed **without making any changes**:

```bash
node scripts/add-sequence-to-jewelry.js preview
```

This shows:
- How many jewelry types exist
- How many items per type
- How many items need sequence numbers

### Step 2: Run the Migration

Apply sequence numbers to all items:

```bash
node scripts/add-sequence-to-jewelry.js
```

The script will:
1. Find all jewelry types (Earrings, Wedding Bands, etc.)
2. For each type, find items without sequence numbers
3. Assign sequential numbers starting from 1 (or continuing from the highest existing sequence)
4. Show progress and summary

### Step 3: Verify

The script automatically verifies that all items now have sequences. You can also manually check:

```bash
# In MongoDB shell or Compass
db.jewelrys.find({ sequence: { $exists: false } }).count()
// Should return 0
```

---

## Rollback (If Needed)

If you need to remove all sequence numbers:

```bash
node scripts/add-sequence-to-jewelry.js rollback
```

⚠️ **Warning:** This will remove the `sequence` field from ALL jewelry items. You'll be prompted to confirm.

---

## Example Output

### Preview Mode:
```
🔍 PREVIEW MODE - No changes will be made

Found 5 jewelry types:

📦 Earrings:
   Total items: 45
   Already have sequence: 0
   Need sequence: 45

📦 Wedding Bands:
   Total items: 23
   Already have sequence: 0
   Need sequence: 23

📦 Engagement Ring:
   Total items: 67
   Already have sequence: 0
   Need sequence: 67

📊 Total items that will be updated: 135
```

### Migration Mode:
```
🔄 Starting sequence migration for jewelry items...

📊 Found 5 jewelry types: [ 'Earrings', 'Wedding Bands', 'Engagement Ring', 'Pendant', 'Bracelet' ]

📦 Processing: Earrings
   Found 45 items without sequence
   Starting sequence from: 1
   ✓ Updated 45/45 items
   ✅ Completed: 45 items updated

📦 Processing: Wedding Bands
   Found 23 items without sequence
   Starting sequence from: 1
   ✓ Updated 23/23 items
   ✅ Completed: 23 items updated

============================================================
📊 MIGRATION SUMMARY
============================================================
Total items updated: 135

Breakdown by category:
  • Earrings: 45 items
  • Wedding Bands: 23 items
  • Engagement Ring: 67 items

✅ Migration completed successfully!

🔍 Verifying results...
✅ All jewelry items now have sequence numbers!
```

---

## Important Notes

### 1. Safe to Run Multiple Times
The script only updates items that don't have a sequence. If you run it again, it will skip items that already have sequences.

### 2. Preserves Existing Sequences
If some items already have sequence numbers, the script will continue from the highest number for that category.

Example:
- If Earrings already have sequences 1-10
- New items will get 11, 12, 13...

### 3. Ordering Logic
Items are ordered by `createdOn` date (oldest first). This means:
- Your oldest Earring gets sequence 1
- Your newest Earring gets the highest sequence

### 4. Null/Undefined JewelryType
Items without a `jewelryType` will be grouped as "Uncategorized" and get their own sequence.

---

## Troubleshooting

### Error: "Cannot find module '../src/models/schema'"
Make sure you're running the script from the project root:
```bash
cd /Users/vats/celora_github/celora-Backend
node scripts/add-sequence-to-jewelry.js
```

### Error: "MONGODB_URI is not defined"
Ensure your `.env` file exists and contains `MONGODB_URI`.

### Some items still don't have sequences
Check if those items have a `jewelryType` set:
```javascript
db.jewelrys.find({ 
  sequence: { $exists: false },
  jewelryType: { $exists: true }
})
```

---

## After Migration

Once the migration is complete:

1. **Test Fetching (GET/POST for search):**
   ```bash
   # Method 1: POST to search endpoint (with filters)
   curl -X POST http://localhost:5000/api/jewelry/search \
     -H "Content-Type: application/json" \
     -d '{
       "jewelryType": "Earrings",
       "sortBy": "sequence",
       "sortOrder": "asc"
     }'

   # Method 2: GET with query params
   curl "http://localhost:5000/api/jewelry?jewelryType=Earrings&sortBy=sequence&sortOrder=asc"
   ```

2. **Test Updating Sequence (PUT):**
   ```bash
   # Update a single item's sequence
   curl -X PUT http://localhost:5000/api/jewelry/{jewelryId} \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "sequence": 5
     }'
   ```

   **Important:** 
   - Use **PUT** to update an existing jewelry item
   - Use **POST** only for searching/filtering
   - Requires authentication token

3. **Update Frontend:**
   - Implement the sorting logic as described in `FRONTEND_JEWELRY_SORTING.md`
   - Add drag-and-drop reordering in your admin panel
   - Use PUT requests when user reorders items

4. **New Items:**
   - New jewelry items will automatically get the next sequence number for their category
   - No manual intervention needed

---

## Need Help?

If you encounter any issues:
1. Run in preview mode first
2. Check the MongoDB connection
3. Verify your `.env` file
4. Check the script output for specific error messages
