# Migration: Add Entry Code Field

## What This Does
Adds a new optional `entry_code` field to the `calls` table to store building/gate entry codes.

## How to Run This Migration

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file: `migrations/add_entry_code.sql`
4. Copy the contents and paste into the SQL Editor
5. Click **Run**

### Option 2: Via Command Line (if you have Supabase CLI)
```bash
supabase db push migrations/add_entry_code.sql
```

### Option 3: Manual SQL Execution
Connect to your database and run:
```sql
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS entry_code VARCHAR(100);

COMMENT ON COLUMN calls.entry_code IS 'Optional entry code for building or gate access';
```

## What Changed

### Database
- ✅ Added `entry_code` column to `calls` table (VARCHAR(100), nullable)

### Server (server.js)
- ✅ POST `/api/calls` - Now accepts and saves `entry_code`
- ✅ PUT `/api/calls/:id` - Now accepts and updates `entry_code`

### Frontend
- ✅ Create form in `index.html` - Has "קוד כניסה" field
- ✅ Edit modal in `index.html` - Has "קוד כניסה" field
- ✅ Edit modal in `history.html` - Has "קוד כניסה" field
- ✅ `app.js` - Captures and sends `entry_code` on create/edit
- ✅ `history.js` - Captures and sends `entry_code` on edit

## Verification
After running the migration, you can verify it worked by:
1. Creating a new call with an entry code
2. Checking that it saves properly
3. Editing a call and adding/modifying the entry code
4. Viewing the call details to confirm the entry code is stored

## Note
The `entry_code` field is **optional** - users don't have to fill it in.
