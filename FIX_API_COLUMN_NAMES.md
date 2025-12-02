# Fix API v1 Endpoints - Database Column Names

## Problem
Discord bot was receiving 500 errors when calling the API endpoints:
```
column call_types_1.name does not exist
```

## Root Cause
The API endpoints were referencing columns that don't exist in the database schema:

**Incorrect Columns:**
- `call_types.name` ❌
- `call_types.color` ❌
- `alert_codes.description` ❌
- `medical_codes.description` ❌

**Correct Schema:**
- `call_types`: `id`, `hebrew_name`, `english_name`, `type_key`, `is_active`
- `alert_codes`: `id`, `code`
- `medical_codes`: `id`, `code`

## Solution Applied

### 1. Fixed GET /api/v1/calls Endpoint

**Before:**
```javascript
.select(`
    *,
    call_types!call_type_id(id, name, color),
    alert_codes!alert_code_id(code, description),
    medical_codes!medical_code_id(code, description)
`)
```

**After:**
```javascript
.select(`
    *,
    call_types!call_type_id(id, hebrew_name, english_name),
    alert_codes!alert_code_id(id, code),
    medical_codes!medical_code_id(id, code)
`)
```

### 2. Fixed Type Filter in GET /api/v1/calls

**Before:**
```javascript
.ilike('name', `%${type}%`)
```

**After:**
```javascript
.or(`hebrew_name.ilike.%${type}%,english_name.ilike.%${type}%`)
```

Now searches both Hebrew and English names.

### 3. Fixed GET /api/v1/stats Endpoint

**Before:**
```javascript
.select('*, call_types!call_type_id (id, name)')
```

**After:**
```javascript
.select('*, call_types!call_type_id(id, hebrew_name, english_name)')
```

### 4. Fixed Stats Calculation

**Before:**
```javascript
const typeName = call.call_types?.name || 'Unknown';
```

**After:**
```javascript
const typeName = call.call_types?.hebrew_name || call.call_types?.english_name || 'Unknown';
```

## Testing

After deploying these changes, test the Discord bot with:

1. **Get all calls:**
   ```
   GET /api/v1/calls?limit=50
   ```

2. **Get calls by date:**
   ```
   GET /api/v1/calls?date=02/12/2025&limit=50
   ```

3. **Get stats:**
   ```
   GET /api/v1/stats
   ```

All queries should now return data successfully without the "column does not exist" error.

## Files Modified
- `server.js` - Lines 2327-2490 (API v1 endpoints)

## Deployed
✅ Changes committed and pushed to GitHub
✅ Render will auto-deploy from main branch
✅ Wait 2-3 minutes for deployment to complete
