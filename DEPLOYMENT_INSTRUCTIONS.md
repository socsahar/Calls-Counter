# 🚀 Deployment Instructions - Codes Feature

## ✅ Implementation Complete

All code changes have been completed successfully. The application now has:
- **Alert Codes (קודי הזנקה)** - Emergency response codes
- **Medical Codes (קודים רפואיים)** - Medical classification codes
- Admin panel for managing both code types
- Live search dropdowns in the main form
- Safe migration that **PRESERVES ALL EXISTING DATA**

---

## 📋 Step-by-Step Deployment

### Step 1: Database Migration (Supabase)

**⚠️ CRITICAL: This migration is SAFE and will NOT delete any existing data!**

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy the entire contents of `add-codes-migration.sql` file
4. Paste into the SQL Editor
5. Click **Run** or press `Ctrl+Enter`
6. Verify success: You should see "Success. No rows returned"

**What this does:**
- Creates `alert_codes` table with 15 sample codes
- Creates `medical_codes` table with 10 sample codes
- Adds nullable `alert_code_id` and `medical_code_id` columns to existing `calls` table
- All existing call records remain untouched ✅

---

### Step 2: Deploy Code Changes

#### Option A: If using Render.com (Recommended)
```bash
# Commit changes
git add .
git commit -m "Add alert and medical codes feature"
git push origin main
```
Render will auto-deploy the changes.

#### Option B: Manual Server Restart
```bash
# Stop the server (Ctrl+C)
# Then restart
node server.js
```

---

### Step 3: Verify Deployment

1. **Test Main Form:**
   - Login to application
   - Go to main call entry form
   - Verify you see two new dropdown fields:
     - 🚨 קוד הזנקה (Alert Code)
     - 🏥 קוד רפואי (Medical Code)
   - Both should show sample codes from database

2. **Test Admin Panel:**
   - Login as admin user
   - Click "🏷️ ניהול סוגי קריאות" button
   - Verify codes management section opens
   - Test switching between tabs
   - Try adding/editing/deleting codes

3. **Test Call Creation:**
   - Select an alert code
   - Select a medical code
   - Fill in other required fields
   - Submit call
   - Verify call displays with both codes (🚨 and 🏥 emojis)

---

## 📝 Sample Data Included

### Alert Codes (קודי הזנקה)
The migration includes 15 sample codes:
- H01: תאונת דרכים (Traffic accident)
- H02: נפילה (Fall)
- H03: קוצר נשימה (Shortness of breath)
- H04: כאבים בחזה (Chest pain)
- H05: אובדן הכרה (Loss of consciousness)
- And 10 more...

### Medical Codes (קודים רפואיים)
The migration includes 10 sample codes:
- M01: טראומה (Trauma)
- M02: קרדיולוגי (Cardiology)
- M03: נשימתי (Respiratory)
- M04: נוירולוגי (Neurology)
- And 6 more...

**You can edit, delete, or add new codes through the admin panel!**

---

## 🎯 Features Overview

### For Regular Users:
- Select alert code from dropdown (required)
- Select medical code from dropdown (required)
- Live search within dropdowns
- Description field now optional (for additional notes)
- View codes in call history with emojis

### For Admins:
- Full CRUD management of alert codes
- Full CRUD management of medical codes
- Toggle active/inactive status
- Set display order
- Delete codes (with confirmation)

---

## 🔧 Admin Panel Features

1. **Add New Code:**
   - Click "+ הוסף קוד חדש"
   - Fill in form (code, description, order)
   - Set active status
   - Save

2. **Edit Code:**
   - Click "✏️ ערוך" on any code
   - Modify fields
   - Save changes

3. **Delete Code:**
   - Click "🗑️ מחק" on any code
   - Confirm deletion
   - Code removed from database

4. **Toggle Active Status:**
   - Edit code
   - Uncheck "פעיל" checkbox
   - Inactive codes won't appear in main form dropdowns

---

## 🔒 Security Notes

- All admin endpoints require JWT authentication
- Admin endpoints check for `is_admin=true` in user record
- Row Level Security (RLS) policies protect data
- Codes are read-only for regular users

---

## 📊 Database Schema

### New Tables:
```sql
alert_codes:
  - id (UUID, primary key)
  - code (TEXT, unique, e.g., "H01")
  - description (TEXT, e.g., "תאונת דרכים")
  - display_order (INTEGER)
  - is_active (BOOLEAN)
  - created_at, updated_at

medical_codes:
  - id (UUID, primary key)
  - code (TEXT, unique, e.g., "M01")
  - description (TEXT, e.g., "טראומה")
  - display_order (INTEGER)
  - is_active (BOOLEAN)
  - created_at, updated_at
```

### Modified Table:
```sql
calls:
  - alert_code_id (UUID, nullable, foreign key)
  - medical_code_id (UUID, nullable, foreign key)
  - description (now optional, renamed in UI to "הערות נוספות")
```

---

## ✅ Rollback Plan (If Needed)

If you need to rollback:

```sql
-- Remove foreign key columns
ALTER TABLE calls DROP COLUMN IF EXISTS alert_code_id;
ALTER TABLE calls DROP COLUMN IF EXISTS medical_code_id;

-- Drop new tables
DROP TABLE IF EXISTS alert_codes CASCADE;
DROP TABLE IF EXISTS medical_codes CASCADE;
```

Then redeploy previous server.js version.

---

## 🎉 You're All Set!

The feature is now live. Users can start using alert and medical codes immediately!

**Questions or Issues?**
- Check server logs: `pm2 logs` (if using PM2) or console output
- Check browser console for JavaScript errors
- Verify database migration ran successfully in Supabase

---

**Feature Developed:** Alert Codes & Medical Codes Management  
**Date:** 2025  
**Compatibility:** Full backward compatibility - existing calls preserved  
**Data Safety:** ✅ Zero data loss - all existing records intact
