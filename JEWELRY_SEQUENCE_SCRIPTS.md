# Jewelry Sequence Scripts - Summary

## Two Scripts Available

### 1. `add-sequence-to-jewelry.js` - Initial Setup
**Purpose:** Adds sequence numbers to jewelry items that don't have them yet.

**How it works:**
- ✅ Processes each jewelry type separately (Earrings, Wedding Bands, etc.)
- ✅ Only updates items WITHOUT a sequence
- ✅ Continues from the highest existing sequence for that type

**When to use:**
- First time setup
- After adding new jewelry items without sequences

**Usage:**
```bash
# Preview what will change
node scripts/add-sequence-to-jewelry.js preview

# Run the migration
node scripts/add-sequence-to-jewelry.js

# Rollback (remove all sequences)
node scripts/add-sequence-to-jewelry.js rollback
```

---

### 2. `normalize-jewelry-sequences.js` - Fix Gaps
**Purpose:** Re-numbers all jewelry items to have consecutive sequences (1, 2, 3, 4...).

**How it works:**
- ✅ Processes each jewelry type separately
- ✅ Re-numbers ALL items to be consecutive
- ✅ Preserves the existing order (sorted by current sequence)

**When to use:**
- When sequences have gaps (1, 2, 6, 9 instead of 1, 2, 3, 4)
- After deleting jewelry items
- To clean up inconsistent sequences

**Usage:**
```bash
# Preview what will change
node scripts/normalize-jewelry-sequences.js preview

# Run normalization
node scripts/normalize-jewelry-sequences.js
```

---

## Example Scenario

### Problem: Non-consecutive Sequences
```
Earrings: 1, 2, 6
Wedding Bands: 4, 7, 12, 13
Bracelet: 3, 9, 10
```

### Solution: Run Normalization
```bash
node scripts/normalize-jewelry-sequences.js
```

### Result: Consecutive Sequences
```
Earrings: 1, 2, 3
Wedding Bands: 1, 2, 3, 4
Bracelet: 1, 2, 3
```

---

## Key Differences

| Feature | add-sequence-to-jewelry.js | normalize-jewelry-sequences.js |
|---------|---------------------------|-------------------------------|
| **Updates items with sequences** | ❌ No | ✅ Yes |
| **Updates items without sequences** | ✅ Yes | ✅ Yes |
| **Makes sequences consecutive** | ❌ No | ✅ Yes |
| **Preserves existing order** | ✅ Yes | ✅ Yes |
| **Use case** | Initial setup | Fix gaps/cleanup |

---

## Verification Results

After running normalization on your database:

```
✅ Bracelet: Sequences are consecutive (1 to 3)
✅ Earrings: Sequences are consecutive (1 to 3)
✅ Pendant: Sequences are consecutive (1 to 16)
✅ Wedding Bands: Sequences are consecutive (1 to 4)
```

**Total items updated:** 24

---

## Important Notes

### ✅ Both Scripts Are Type-Aware
Both scripts process each `jewelryType` separately:
- Earrings get sequences 1, 2, 3...
- Wedding Bands get sequences 1, 2, 3...
- No cross-category interference

### ✅ Safe to Run Multiple Times
- `add-sequence-to-jewelry.js`: Only updates items without sequences
- `normalize-jewelry-sequences.js`: Only updates items with changed sequences

### ✅ Preserves Order
Both scripts maintain the existing order of items (sorted by current sequence or creation date).

---

## Recommendation

1. **First Time:** Run `add-sequence-to-jewelry.js`
2. **After That:** Run `normalize-jewelry-sequences.js` whenever you need consecutive sequences
3. **Regular Use:** The reorder API (`newIndex`) handles ongoing reordering automatically

---

## Related Documentation

- `JEWELRY_REORDER_API.md` - How to reorder items using the API
- `JEWELRY_SEQUENCE_MIGRATION.md` - Detailed migration guide
- `JEWELRY_REORDER_TEST_RESULTS.md` - API test results
