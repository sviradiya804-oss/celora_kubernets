# Jewelry Sequence Reordering - Using Existing System

Your backend **already has** a built-in reordering system using `newIndex`! I've updated it to work with jewelry categories.

---

## How It Works

### Existing System (Now Category-Aware)
**Endpoint:** `PUT /api/jewelry/{jewelryId}`

Send `newIndex` in the request body to reorder items. The backend automatically:
- Moves the item to the new position
- Shifts all other items in the **same category**
- Updates all affected sequences

---

## API Usage

### Request Format
```bash
curl -X PUT 'https://api.celorajewelry.com/api/jewelry/{jewelryId}' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  --data-raw '{"newIndex": 0}'
```

### Parameters
- **`newIndex`**: The new position (0-based index)
  - `0` = First position (sequence 1)
  - `1` = Second position (sequence 2)
  - etc.

---

## Examples

### Example 1: Move Earring to First Position

**Current State:**
```
0. Earring A (sequence: 1)
1. Earring B (sequence: 2)
2. Earring C (sequence: 3)
3. Earring D (sequence: 4) ← Move this to position 0
```

**Request:**
```bash
curl -X PUT 'https://api.celorajewelry.com/api/jewelry/earring-d-id' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  --data-raw '{"newIndex": 0}'
```

**Result:**
```
0. Earring D (sequence: 1) ← Moved here
1. Earring A (sequence: 2) ← Shifted down
2. Earring B (sequence: 3) ← Shifted down
3. Earring C (sequence: 4) ← Shifted down
```

### Example 2: Move Wedding Band Down

**Current State:**
```
0. Band A (sequence: 1) ← Move this to position 2
1. Band B (sequence: 2)
2. Band C (sequence: 3)
```

**Request:**
```bash
curl -X PUT 'https://api.celorajewelry.com/api/jewelry/band-a-id' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  --data-raw '{"newIndex": 2}'
```

**Result:**
```
0. Band B (sequence: 1) ← Shifted up
1. Band C (sequence: 2) ← Shifted up
2. Band A (sequence: 3) ← Moved here
```

---

## Frontend Implementation

### React with Drag-and-Drop

```javascript
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import axios from 'axios';

function JewelryReorderList({ category }) {
  const [items, setItems] = useState([]);

  // Fetch items sorted by sequence
  useEffect(() => {
    fetchItems();
  }, [category]);

  const fetchItems = async () => {
    const response = await axios.post('/api/jewelry/search', {
      jewelryType: category,
      sortBy: 'sequence',
      sortOrder: 'asc'
    });
    setItems(response.data.data);
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceIndex === destIndex) return;

    // Optimistically update UI
    const newItems = Array.from(items);
    const [movedItem] = newItems.splice(sourceIndex, 1);
    newItems.splice(destIndex, 0, movedItem);
    setItems(newItems);

    try {
      // Call the existing PUT endpoint with newIndex
      await axios.put(`/api/jewelry/${movedItem.jewelryId}`, {
        newIndex: destIndex  // 0-based index
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      // Refresh to get accurate sequences
      await fetchItems();
      
    } catch (error) {
      console.error('Reorder failed:', error);
      // Revert on error
      await fetchItems();
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="jewelry-list">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {items.map((item, index) => (
              <Draggable 
                key={item.jewelryId} 
                draggableId={item.jewelryId} 
                index={index}
              >
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    #{item.sequence} - {item.title}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
```

### Simple Button Example

```javascript
const moveToFirst = async (jewelryId) => {
  try {
    await axios.put(`/api/jewelry/${jewelryId}`, {
      newIndex: 0  // Move to first position
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // Refresh list
    await fetchItems();
  } catch (error) {
    console.error('Move failed:', error);
  }
};
```

---

## Important Notes

### ✅ Category-Scoped (NEW!)
The system now automatically scopes reordering by `jewelryType`:
- Reordering **Earrings** only affects other **Earrings**
- Reordering **Wedding Bands** only affects other **Wedding Bands**
- No cross-category interference

### ✅ Automatic Shifting
When you move one item, all items between the old and new positions are automatically shifted.

### ✅ Transaction-Safe
Uses MongoDB transactions to ensure all updates succeed or fail together.

### ⚠️ Index is 0-Based
- Frontend array index: `0, 1, 2, 3...`
- Database sequence: `1, 2, 3, 4...`
- The backend converts automatically

---

## Testing

### Test 1: Move to First Position
```bash
# Get a jewelry ID from your database
JEWELRY_ID="your-jewelry-id-here"

# Move to first position (index 0)
curl -X PUT "https://api.celorajewelry.com/api/jewelry/$JEWELRY_ID" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  --data-raw '{"newIndex": 0}'
```

### Test 2: Verify New Order
```bash
# Fetch all Earrings sorted by sequence
curl -X POST 'https://api.celorajewelry.com/api/jewelry/search' \
  -H 'Content-Type: application/json' \
  --data-raw '{
    "jewelryType": "Earrings",
    "sortBy": "sequence",
    "sortOrder": "asc"
  }'
```

---

## Response Format

### Success Response
```json
{
  "_id": "68aebd310686a0c9081cc24b",
  "jewelryId": "22f028a1-831d-11f0-a933-d9833865d551",
  "sequence": 1,
  "title": "Vintage Nature Ring",
  "jewelryType": "Earrings",
  "isActive": true,
  "updatedOn": "2026-01-12T11:02:08.181Z",
  ...
}
```

The response includes the updated `sequence` field.

---

## What Changed in the Backend

I updated `src/controllers/commonController.js` to:

1. **Scope by Category**: When reordering jewelry, it only affects items with the same `jewelryType`
2. **Add Logging**: Shows which category is being reordered and how many items are affected
3. **Preserve Existing Logic**: All other collections (like `engagementsubtypelist`) work exactly as before

### Code Changes
```javascript
// Build query to scope by category for jewelry
let findQuery = {};
if (indexName === 'jewelry' && existingDocument.jewelryType) {
  findQuery.jewelryType = existingDocument.jewelryType;
  console.log(`[Reorder] Scoping to jewelryType: ${existingDocument.jewelryType}`);
}

const allDocuments = await Model.find(findQuery, { _id: 1, sequence: 1 })
  .sort({ sequence: 1 })
  .session(session);
```

---

## Summary

| Feature | Status |
|---------|--------|
| Reordering API | ✅ Already exists |
| Category-scoped | ✅ Now supported |
| Auto-shifting | ✅ Built-in |
| Transaction-safe | ✅ Yes |
| Works with existing frontend | ✅ Just use `newIndex` |

**No new endpoints needed!** Your existing `PUT /api/jewelry/{id}` with `newIndex` now works perfectly for category-scoped reordering.
