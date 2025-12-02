# API Keys System - Quick Guide

## Overview
Complete API key authentication system for Discord bot integration. Users can generate API keys in the admin panel and use them to interact with the API.

## Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- See migrations/add_api_keys.sql
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key_name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permissions TEXT[] DEFAULT ARRAY['read', 'write'],
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

CREATE TRIGGER update_api_keys_updated_at 
    BEFORE UPDATE ON api_keys 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## Admin Endpoints (Web UI)

These endpoints require admin authentication (JWT token):

### 1. Generate New API Key
```http
POST /api/admin/api-keys
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "key_name": "Discord Bot - Production",
  "permissions": ["calls:read", "calls:write", "stats:read"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "מפתח API נוצר בהצלחה",
  "api_key": "a1b2c3d4e5f6...64-char-hex-string",
  "key_info": {
    "id": "uuid",
    "key_name": "Discord Bot - Production",
    "permissions": ["calls:read", "calls:write", "stats:read"],
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

⚠️ **IMPORTANT:** Save the `api_key` immediately! It will never be shown again.

### 2. List API Keys
```http
GET /api/admin/api-keys
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "api_keys": [
    {
      "id": "uuid",
      "key_name": "Discord Bot - Production",
      "permissions": ["calls:read", "calls:write", "stats:read"],
      "is_active": true,
      "last_used_at": "2025-01-15T12:00:00Z",
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### 3. Revoke API Key
```http
DELETE /api/admin/api-keys/:id
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "message": "מפתח API נמחק בהצלחה"
}
```

## Public API v1 Endpoints (For Bots)

These endpoints require API key authentication in the header:

```http
X-API-Key: <your-api-key-here>
```

### 1. Create a Call
```http
POST /api/v1/calls
X-API-Key: <your-api-key>
Content-Type: application/json

{
  "city": "תל אביב",
  "street": "דיזנגוף",
  "location_details": "פינת בן גוריון",
  "call_type_id": 1,
  "alert_code_id": 5,
  "medical_code_id": 3,
  "meter_visa_number": "12345",
  "entry_code": "A123",
  "description": "חולה מחוסר הכרה",
  "call_date": "2025-01-15"
}
```

**Required Fields:**
- `city` (string)
- `call_type_id` (integer)

**Optional Fields:**
- `street` (string)
- `location_details` (string)
- `alert_code_id` (integer)
- `medical_code_id` (integer)
- `meter_visa_number` (string)
- `entry_code` (string)
- `description` (string)
- `call_date` (string, YYYY-MM-DD format, defaults to today)

**Response:**
```json
{
  "success": true,
  "message": "Call created successfully",
  "call": {
    "id": "uuid",
    "motorcycle_number": "5248",
    "city": "תל אביב",
    "street": "דיזנגוף",
    "call_date": "2025-01-15",
    ...
  }
}
```

### 2. Get Calls (with filters)
```http
GET /api/v1/calls?start_date=2025-01-01&end_date=2025-01-31&city=תל%20אביב&limit=50&offset=0
X-API-Key: <your-api-key>
```

**Query Parameters:**
- `start_date` (optional, YYYY-MM-DD)
- `end_date` (optional, YYYY-MM-DD)
- `city` (optional, partial match)
- `call_type_id` (optional, integer)
- `limit` (optional, default: 100, max per request)
- `offset` (optional, default: 0, for pagination)

**Response:**
```json
{
  "success": true,
  "calls": [
    {
      "id": "uuid",
      "motorcycle_number": "5248",
      "city": "תל אביב",
      "street": "דיזנגוף",
      "call_types": {
        "name": "קריאת חירום",
        "color": "#FF0000"
      },
      "alert_codes": {
        "code": "17",
        "description": "תאונת דרכים"
      },
      ...
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

### 3. Get Statistics
```http
GET /api/v1/stats?date=2025-01-15
X-API-Key: <your-api-key>
```

**Query Parameters:**
- `date` (optional, YYYY-MM-DD, defaults to today)

**Response:**
```json
{
  "success": true,
  "date": "2025-01-15",
  "motorcycle_number": "5248",
  "stats": {
    "total_calls": 25,
    "calls_by_type": {
      "קריאת חירום": 15,
      "קריאה רגילה": 8,
      "תאונה": 2
    }
  }
}
```

## Permissions System

Available permissions:
- `calls:read` - Read calls via GET /api/v1/calls
- `calls:write` - Create calls via POST /api/v1/calls
- `stats:read` - Read statistics via GET /api/v1/stats

Default permissions when creating a key:
```json
["calls:read", "calls:write", "stats:read"]
```

## Security Features

✅ **SHA256 Hashing** - API keys are hashed before storage (never stored in plain text)
✅ **Per-User Keys** - Each key is tied to a user account
✅ **Permissions Array** - Granular access control per endpoint
✅ **Active Status** - Keys can be deactivated without deletion
✅ **Last Used Tracking** - Automatically tracks when keys are used
✅ **One-Time Display** - API keys shown only once on creation

## Discord Bot Example (Node.js)

```javascript
const axios = require('axios');

const API_BASE = 'https://your-domain.com';
const API_KEY = 'your-generated-api-key-here';

// Create a call
async function createCall(city, street, callTypeId, description) {
  try {
    const response = await axios.post(
      `${API_BASE}/api/v1/calls`,
      {
        city,
        street,
        call_type_id: callTypeId,
        description
      },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Call created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating call:', error.response?.data || error.message);
    throw error;
  }
}

// Get today's stats
async function getTodayStats() {
  try {
    const response = await axios.get(
      `${API_BASE}/api/v1/stats`,
      {
        headers: {
          'X-API-Key': API_KEY
        }
      }
    );
    
    console.log('Today stats:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching stats:', error.response?.data || error.message);
    throw error;
  }
}

// Example Discord command
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!call')) {
    const args = message.content.split(' ').slice(1);
    const city = args[0];
    const street = args.slice(1).join(' ');
    
    try {
      const result = await createCall(city, street, 1, 'Created via Discord');
      message.reply(`✅ Call created successfully! ID: ${result.call.id}`);
    } catch (error) {
      message.reply('❌ Error creating call. Check bot logs.');
    }
  }
  
  if (message.content === '!stats') {
    try {
      const stats = await getTodayStats();
      message.reply(
        `📊 Today's Stats:\n` +
        `Total Calls: ${stats.stats.total_calls}\n` +
        `By Type: ${JSON.stringify(stats.stats.calls_by_type, null, 2)}`
      );
    } catch (error) {
      message.reply('❌ Error fetching stats. Check bot logs.');
    }
  }
});
```

## Testing with cURL

### Create a call:
```bash
curl -X POST https://your-domain.com/api/v1/calls \
  -H "X-API-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "city": "תל אביב",
    "street": "דיזנגוף",
    "call_type_id": 1,
    "description": "Test call"
  }'
```

### Get calls:
```bash
curl -X GET "https://your-domain.com/api/v1/calls?limit=10" \
  -H "X-API-Key: your-api-key-here"
```

### Get stats:
```bash
curl -X GET "https://your-domain.com/api/v1/stats" \
  -H "X-API-Key: your-api-key-here"
```

## Error Responses

### 401 Unauthorized (Missing/Invalid Key)
```json
{
  "success": false,
  "message": "API key is required"
}
```

### 403 Forbidden (No Permission)
```json
{
  "success": false,
  "message": "API key does not have permission to create calls"
}
```

### 400 Bad Request (Validation Error)
```json
{
  "success": false,
  "message": "Missing required fields: city and call_type_id are required"
}
```

## Next Steps

1. ✅ Run the database migration
2. ⏳ Add API Keys section to admin.html UI
3. ⏳ Add JavaScript handlers to admin.js
4. ⏳ Test key generation and API calls
5. ⏳ Integrate with Discord bot
6. 📋 Consider adding rate limiting for production

---

**Created:** 2025-01-15
**Status:** Backend Complete, UI Pending
