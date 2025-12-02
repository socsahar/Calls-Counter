# Database Migration Guide - Complete Setup

## Current Issue
The API is returning `call_types: null` because existing calls don't have `call_type_id` populated. They only have the old `call_type` TEXT field.

## Required Migrations (Run in Order)

### Step 1: Add Foreign Key Constraints
If you haven't run this migration yet:

**File:** `migrations/fix_duplicate_foreign_keys.sql`

This will:
- Remove any duplicate foreign key constraints
- Add clean foreign key relationships for `call_type_id`, `alert_code_id`, `medical_code_id`

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste the entire content of:
-- migrations/fix_duplicate_foreign_keys.sql
```

### Step 2: Populate call_type_id for Existing Calls
**File:** `migrations/populate_call_type_id.sql`

This will:
- Map old `call_type` TEXT values to proper `call_type_id` foreign keys
- Convert "דחוף" → urgent
- Convert "אט\"ן" → atan
- Convert "ארן" → aran
- Convert "נתב\"ג" → natbag

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste the entire content of:
-- migrations/populate_call_type_id.sql
```

### Step 3: Verify the Migration

After running both migrations, verify with this query:

```sql
-- Check that call_types are properly linked
SELECT 
    c.id,
    c.call_type as old_text_value,
    c.call_type_id,
    ct.hebrew_name,
    ct.english_name
FROM calls c
LEFT JOIN call_types ct ON c.call_type_id = ct.id
ORDER BY c.id DESC
LIMIT 20;
```

**Expected Result:**
- `call_type_id` should NOT be null
- `hebrew_name` and `english_name` should show values like "דחוף", "אט\"ן", etc.

## Before Running Migrations - Check Your call_types Table

First, verify you have call types configured:

```sql
SELECT * FROM call_types ORDER BY id;
```

**Expected Result:**
```
id | type_key | hebrew_name | english_name
---|----------|-------------|-------------
1  | urgent   | דחוף        | Urgent
2  | atan     | אט"ן        | Atan
3  | aran     | ארן         | Aran
4  | natbag   | נתב"ג       | Natbag
```

If this table is empty, you need to populate it first! Run this:

```sql
-- Insert default call types
INSERT INTO call_types (type_key, hebrew_name, english_name) VALUES
('urgent', 'דחוף', 'Urgent'),
('atan', 'אט"ן', 'Atan'),
('aran', 'ארן', 'Aran'),
('natbag', 'נתב"ג', 'Natbag')
ON CONFLICT (type_key) DO NOTHING;
```

## Testing After Migration

### Test 1: API Returns Call Types
```powershell
$headers = @{ 
    "x-api-key" = "c9ff816467d2d0df05e9cdea9442e6db81e2de5a76de743e1a1ec799041fba49"
    "Content-Type" = "application/json" 
}
Invoke-RestMethod -Uri "https://calls-counter.onrender.com/api/v1/calls?limit=5" -Headers $headers
```

**Expected:** `call_types` should have data like:
```json
"call_types": {
    "id": 1,
    "hebrew_name": "דחוף",
    "english_name": "Urgent"
}
```

### Test 2: Discord Bot Shows Data
Use your Discord bot `/קריאות` command - it should now display calls with proper type information.

## Troubleshooting

### Issue: call_types table is empty
**Solution:** Run the INSERT query above to populate default call types.

### Issue: Still getting null for call_types
**Solution:** 
1. Check if call_type_id is populated: `SELECT COUNT(*) FROM calls WHERE call_type_id IS NULL;`
2. If count > 0, re-run the `populate_call_type_id.sql` migration
3. Check for typos in call_type values: `SELECT DISTINCT call_type FROM calls;`

### Issue: Foreign key constraint errors
**Solution:** Run `migrations/fix_duplicate_foreign_keys.sql` first to clean up constraints.

## Summary
1. ✅ Fix foreign key constraints
2. ✅ Ensure call_types table has data
3. ✅ Run populate_call_type_id migration
4. ✅ Test API returns proper data
5. ✅ Discord bot should now work!
