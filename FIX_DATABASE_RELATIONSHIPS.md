# Fix Database Foreign Key Relationships

## Problem
The Discord bot is showing this error:
```
"Could not find a relationship between 'calls' and 'call_types' in the schema cache"
```

This happens because the `calls` table doesn't have proper foreign key constraints defined for the relationship with `call_types`, `alert_codes`, and `medical_codes` tables.

## Solution

Run these migrations in your Supabase SQL Editor to add the missing foreign key constraints.

---

## Step 1: Add call_type_id Foreign Key

**File:** `migrations/add_call_type_foreign_key.sql`

```sql
-- Add Foreign Key Constraint for call_type_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'call_type_id'
    ) THEN
        ALTER TABLE calls ADD COLUMN call_type_id INTEGER;
    END IF;
END $$;

ALTER TABLE calls 
ADD CONSTRAINT fk_calls_call_type 
FOREIGN KEY (call_type_id) 
REFERENCES call_types(id) 
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calls_call_type_id ON calls(call_type_id);
```

---

## Step 2: Add alert_code_id and medical_code_id Foreign Keys

**File:** `migrations/add_codes_foreign_keys.sql`

```sql
-- Add Foreign Key for alert_code_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'alert_code_id'
    ) THEN
        ALTER TABLE calls ADD COLUMN alert_code_id INTEGER;
    END IF;
END $$;

ALTER TABLE calls 
ADD CONSTRAINT fk_calls_alert_code 
FOREIGN KEY (alert_code_id) 
REFERENCES alert_codes(id) 
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calls_alert_code_id ON calls(alert_code_id);

-- Add Foreign Key for medical_code_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'medical_code_id'
    ) THEN
        ALTER TABLE calls ADD COLUMN medical_code_id INTEGER;
    END IF;
END $$;

ALTER TABLE calls 
ADD CONSTRAINT fk_calls_medical_code 
FOREIGN KEY (medical_code_id) 
REFERENCES medical_codes(id) 
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calls_medical_code_id ON calls(medical_code_id);
```

---

## Step 3: Verify the Constraints

After running the migrations, verify they were created successfully:

```sql
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='calls'
    AND kcu.column_name IN ('call_type_id', 'alert_code_id', 'medical_code_id');
```

**Expected Output:**
```
constraint_name          | table_name | column_name      | foreign_table_name | foreign_column_name
-------------------------|------------|------------------|-------------------|--------------------
fk_calls_call_type       | calls      | call_type_id     | call_types        | id
fk_calls_alert_code      | calls      | alert_code_id    | alert_codes       | id
fk_calls_medical_code    | calls      | medical_code_id  | medical_codes     | id
```

---

## Alternative: Run All Migrations at Once

You can copy and paste this combined migration:

```sql
-- ================================================
-- Add All Foreign Key Constraints for calls table
-- ================================================

-- call_type_id
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'call_type_id') THEN
        ALTER TABLE calls ADD COLUMN call_type_id INTEGER;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_calls_call_type' AND table_name = 'calls') THEN
        ALTER TABLE calls DROP CONSTRAINT fk_calls_call_type;
    END IF;
END $$;

ALTER TABLE calls ADD CONSTRAINT fk_calls_call_type FOREIGN KEY (call_type_id) REFERENCES call_types(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calls_call_type_id ON calls(call_type_id);

-- alert_code_id
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'alert_code_id') THEN
        ALTER TABLE calls ADD COLUMN alert_code_id INTEGER;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_calls_alert_code' AND table_name = 'calls') THEN
        ALTER TABLE calls DROP CONSTRAINT fk_calls_alert_code;
    END IF;
END $$;

ALTER TABLE calls ADD CONSTRAINT fk_calls_alert_code FOREIGN KEY (alert_code_id) REFERENCES alert_codes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calls_alert_code_id ON calls(alert_code_id);

-- medical_code_id
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'medical_code_id') THEN
        ALTER TABLE calls ADD COLUMN medical_code_id INTEGER;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_calls_medical_code' AND table_name = 'calls') THEN
        ALTER TABLE calls DROP CONSTRAINT fk_calls_medical_code;
    END IF;
END $$;

ALTER TABLE calls ADD CONSTRAINT fk_calls_medical_code FOREIGN KEY (medical_code_id) REFERENCES medical_codes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calls_medical_code_id ON calls(medical_code_id);
```

---

## After Running Migrations

1. **Restart your Node.js server** (the one running `server.js`)
2. **Test the Discord bot** - the error should be gone!
3. **Try the API endpoints again** - they should work properly now

---

## What This Does

✅ Adds foreign key constraints that define the relationships  
✅ Creates indexes for better query performance  
✅ Allows Supabase to understand the table relationships  
✅ Fixes the Discord bot API error  
✅ Makes queries with joins work properly  

## Why This Was Missing

The original database schema had `call_type` as TEXT, but the current system uses `call_type_id` as INTEGER. The foreign key constraints were never added when the schema was updated.

---

**Date:** December 2, 2025  
**Status:** Ready to Run
