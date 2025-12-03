# Vehicle Selection Feature - Deployment Guide

## 🎯 Overview

This feature allows users to select which vehicle they want to track calls for. Key features:
- **Manual vehicle number entry** with automatic type detection
- **Uniqueness enforcement** - one vehicle per user at a time
- **Automatic data filtering** - all calls, stats, and history filter by selected vehicle
- **Hebrew error messages** when vehicle is occupied
- **Backward compatible** - falls back to user's MDA code if no vehicle selected

---

## 📋 Pre-Deployment Checklist

### Files Modified
- ✅ `migrations/add_vehicle_selection.sql` - Database schema
- ✅ `server.js` - API endpoints
- ✅ `public/index.html` - Vehicle selection modal UI
- ✅ `public/css/style.css` - Modal and badge styling
- ✅ `public/js/app.js` - Frontend logic

### Files Created
- ✅ `VEHICLE_SELECTION_FEATURE.md` - Feature documentation
- ✅ `IMPLEMENTATION_STATUS.md` - Implementation tracking
- ✅ `QUICK_START.md` - Quick start guide

---

## 🚀 Deployment Steps

### Step 1: Backup Current Database

```bash
# Run this in your Supabase SQL editor or psql
-- Create backup of current tables
CREATE TABLE users_backup AS SELECT * FROM users;
CREATE TABLE calls_backup AS SELECT * FROM calls;
```

### Step 2: Run Database Migration

1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Copy the entire contents of `migrations/add_vehicle_selection.sql`
4. Paste into SQL Editor
5. Click **Run**
6. Verify success messages

**Expected Output:**
```
✅ Tables created: vehicles, user_vehicle_settings
✅ Functions created: set_user_vehicle, get_user_vehicle, get_available_vehicles, release_user_vehicle
✅ RLS policies enabled
✅ Sample data inserted
```

### Step 3: Verify Database Setup

Run this query to verify everything is set up correctly:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('vehicles', 'user_vehicle_settings');

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('set_user_vehicle', 'get_user_vehicle', 'get_available_vehicles', 'release_user_vehicle');

-- Check sample data
SELECT * FROM vehicles ORDER BY vehicle_number;
```

### Step 4: Deploy Frontend Files

Upload the modified files to your server:

```bash
# If using Git
git add migrations/add_vehicle_selection.sql
git add server.js
git add public/index.html
git add public/css/style.css
git add public/js/app.js
git commit -m "Add vehicle selection feature"
git push

# If using FTP/manual upload
# Upload these files:
# - server.js (root)
# - public/index.html
# - public/css/style.css
# - public/js/app.js
```

### Step 5: Restart Server

If using Render or similar:
```bash
# Render will auto-deploy on git push
# Or manually trigger redeploy from Render dashboard
```

If running locally:
```powershell
# Stop current server (Ctrl+C)
# Then restart
node server.js
```

### Step 6: Clear Browser Cache

Instruct all users to:
1. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Or clear browser cache completely
3. Log out and log back in

---

## ✅ Post-Deployment Verification

### Test 1: Open Vehicle Selection Modal

1. Log in to the app
2. Click on the vehicle badge (top of page)
3. **Expected:** Modal opens with vehicle selection form

### Test 2: Select a Vehicle

1. Enter vehicle number in the input (e.g., `5248`)
2. Click "בחר רכב" button
3. **Expected:** 
   - Success message appears
   - Badge updates with new vehicle number
   - Modal closes automatically

### Test 3: Test Uniqueness Constraint

1. Log in as **User A**
2. Select vehicle `5248`
3. Log in as **User B** (different browser/incognito)
4. Try to select vehicle `5248`
5. **Expected:** Error message: "רכב זה כבר בשימוש על ידי משתמש אחר"

### Test 4: Verify Data Filtering

1. Select a vehicle
2. Add a new call
3. Go to History page
4. **Expected:** Only calls for the selected vehicle appear

### Test 5: Release Vehicle

1. Open vehicle selection modal
2. Click "שחרר רכב" button
3. Confirm the action
4. **Expected:** 
   - Vehicle released
   - System falls back to user's MDA code
   - Another user can now select that vehicle

---

## 🔧 Troubleshooting

### Issue: Modal doesn't open when clicking badge

**Solution:**
- Hard refresh browser (`Ctrl + Shift + R`)
- Check browser console for JavaScript errors
- Verify `app.js` uploaded correctly

### Issue: "Vehicle already occupied" error for own vehicle

**Solution:**
```sql
-- Release stuck vehicle assignments
DELETE FROM user_vehicle_settings WHERE user_id = 'USER_UUID_HERE';
```

### Issue: Data not filtering by vehicle

**Solution:**
- Check server logs for API errors
- Verify authentication token is valid
- Ensure `server.js` deployed with new endpoints

### Issue: Database migration fails

**Solution:**
```sql
-- Check for missing dependencies
-- 1. Verify vehicle_type_enum exists
SELECT unnest(enum_range(NULL::vehicle_type_enum));

-- 2. If missing, create it
CREATE TYPE vehicle_type_enum AS ENUM ('motorcycle', 'picanto', 'ambulance', 'personal_standby');

-- 3. Run migration again
```

---

## 📊 Monitoring

### Database Queries

**Check active vehicle assignments:**
```sql
SELECT 
    u.full_name,
    uvs.vehicle_number,
    uvs.vehicle_type,
    uvs.created_at
FROM user_vehicle_settings uvs
JOIN users u ON uvs.user_id = u.id
ORDER BY uvs.created_at DESC;
```

**Check vehicle usage:**
```sql
SELECT 
    v.vehicle_number,
    v.vehicle_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM user_vehicle_settings uvs WHERE uvs.vehicle_number = v.vehicle_number)
        THEN 'In Use'
        ELSE 'Available'
    END as status
FROM vehicles v
ORDER BY v.vehicle_number;
```

### API Endpoints to Monitor

```bash
# Test endpoints with curl
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/vehicle/current
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/vehicles/available
```

---

## 🔄 Rollback Plan

If you need to rollback:

### Step 1: Revert Database Changes
```sql
DROP TABLE IF EXISTS user_vehicle_settings CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP FUNCTION IF EXISTS set_user_vehicle CASCADE;
DROP FUNCTION IF EXISTS get_user_vehicle CASCADE;
DROP FUNCTION IF EXISTS get_available_vehicles CASCADE;
DROP FUNCTION IF EXISTS release_user_vehicle CASCADE;
```

### Step 2: Restore Previous Files
```bash
git revert HEAD
git push
```

### Step 3: Restart Server
```powershell
node server.js
```

---

## 📞 Support

If issues persist after following this guide:

1. Check browser console for errors
2. Check server logs
3. Verify database connection
4. Ensure all migrations ran successfully
5. Confirm RLS policies are active

---

## 🎉 Success Criteria

✅ Users can click vehicle badge to open modal  
✅ Users can enter vehicle number manually  
✅ Vehicle type auto-detects correctly  
✅ Uniqueness constraint prevents duplicate assignments  
✅ Error message appears in Hebrew when vehicle occupied  
✅ Success message confirms vehicle selection  
✅ Badge updates with selected vehicle  
✅ All calls/stats/history filter by selected vehicle  
✅ Release button works correctly  
✅ System falls back to MDA code when no vehicle selected  

---

**Last Updated:** December 2024  
**Feature Version:** 1.0  
**Status:** ✅ Ready for Production
