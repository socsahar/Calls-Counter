# Testing API Keys Feature

## Prerequisites

1. **Run the database migration first:**
   - Open Supabase SQL Editor
   - Run the contents of `migrations/add_api_keys.sql`

## Testing Steps

### 1. Access Admin Panel
1. Login to your MDA CallCounter system
2. Make sure you're logged in as an admin user
3. Navigate to Admin Panel (admin.html)

### 2. Generate an API Key

1. Click on "ניהול מפתחות API" (API Keys Management) button
2. Click "צור מפתח API חדש" (Generate New API Key)
3. **Password Confirmation Modal** will appear
   - Enter your password
   - Click "אישור" (Confirm)
   - If password is incorrect, you'll see an error
4. **API Key Details Form** will appear
   - Enter a name (e.g., "Discord Bot - Test")
   - Select permissions:
     - ✅ קריאה של קריאות (Read calls)
     - ✅ יצירת קריאות חדשות (Create calls)
     - ✅ קריאת סטטיסטיקות (Read stats)
   - Click "צור מפתח" (Create Key)
5. **Generated Key Modal** will appear
   - ⚠️ **IMPORTANT:** This is the ONLY time you'll see this key!
   - Copy the key immediately
   - Click "העתק" (Copy) button to copy to clipboard
   - Store it safely

### 3. View Your API Keys

The API Keys section will show all your generated keys with:
- Key name
- Status (🟢 Active / 🔴 Inactive)
- Permissions
- Creation date
- Last used timestamp

### 4. Test the API Key

#### Using cURL (Windows PowerShell):

**Create a call:**
```powershell
$apiKey = "your-generated-key-here"
$body = @{
    city = "תל אביב"
    street = "דיזנגוף"
    call_type_id = 1
    description = "Test call from API"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/v1/calls" `
    -Method POST `
    -Headers @{"X-API-Key"=$apiKey; "Content-Type"="application/json"} `
    -Body $body
```

**Get calls:**
```powershell
$apiKey = "your-generated-key-here"
Invoke-WebRequest -Uri "http://localhost:3000/api/v1/calls?limit=10" `
    -Headers @{"X-API-Key"=$apiKey}
```

**Get stats:**
```powershell
$apiKey = "your-generated-key-here"
Invoke-WebRequest -Uri "http://localhost:3000/api/v1/stats" `
    -Headers @{"X-API-Key"=$apiKey}
```

### 5. Delete an API Key

1. Click "🗑️ מחק" (Delete) button on any key
2. Confirm the deletion
3. The key will be permanently removed
4. Any bots using that key will no longer have access

## Expected Behavior

### ✅ Success Cases:

- **Password correct:** Shows API Key form
- **Key generated:** Shows the actual key one time only
- **Key used:** `last_used_at` timestamp updates
- **Valid API request:** Returns data successfully
- **Delete key:** Key removed and API requests fail

### ❌ Error Cases:

- **Wrong password:** "סיסמה שגויה" (Wrong password)
- **Empty key name:** "נא להזין שם למפתח" (Please enter key name)
- **No permissions selected:** "נא לבחור לפחות הרשאה אחת" (Select at least one permission)
- **Invalid API key:** 401 Unauthorized response
- **Missing permission:** 403 Forbidden response
- **Deleted key used:** 401 Unauthorized response

## Security Features Verified

✅ Password confirmation required before generating keys
✅ Keys are hashed (SHA256) before storage
✅ Keys shown only once on creation
✅ Permission-based access control
✅ Keys tied to user accounts
✅ Last used tracking
✅ Ability to revoke keys instantly

## Database Verification

Check if keys are stored correctly:

```sql
-- View all API keys (hashed)
SELECT id, key_name, user_id, permissions, is_active, last_used_at, created_at 
FROM api_keys 
ORDER BY created_at DESC;

-- Count active keys per user
SELECT user_id, COUNT(*) as key_count 
FROM api_keys 
WHERE is_active = true 
GROUP BY user_id;
```

## Troubleshooting

### Problem: Password modal doesn't appear
- Check browser console for errors
- Verify admin.js loaded correctly
- Check if user data is in localStorage

### Problem: API key not working
- Verify key copied correctly (64 hex characters)
- Check `X-API-Key` header is set
- Verify key hasn't been deleted
- Check server logs for authentication errors

### Problem: Permission denied
- Verify the permission exists in the key's permissions array
- Example: `calls:write` needed for POST /api/v1/calls

### Problem: Can't see generated key
- Did you close the modal too quickly?
- Key can only be shown once on creation
- Generate a new key if lost

## Next Steps

Once testing is complete:
1. ✅ Integrate with Discord bot
2. ✅ Document API endpoints for bot developers
3. 📋 Consider adding rate limiting (future enhancement)
4. 📋 Add IP whitelisting option (future enhancement)
5. 📋 Add key expiration dates (future enhancement)

---

**Date:** December 2, 2025
**Status:** Ready for Testing
