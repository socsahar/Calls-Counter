# API v1 Documentation

Complete reference for the CallCounter Public API v1.

## Base URL
- **Local:** `http://localhost:3000/api/v1`
- **Production:** `https://your-app.onrender.com/api/v1`

## Authentication

All API v1 endpoints require an API key in the header:

```
X-API-Key: your-generated-api-key-here
```

## Endpoints

### 1. GET /api/v1/calls

Retrieve calls with optional filtering and pagination.

#### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `date` | string | No | Exact date (YYYY-MM-DD) | `2025-12-02` |
| `start_date` | string | No | Start date for range | `2025-12-01` |
| `end_date` | string | No | End date for range | `2025-12-31` |
| `city` | string | No | Filter by city (partial match) | `תל אביב` |
| `type` | string | No | Filter by call type name (partial match) | `חירום` |
| `call_type_id` | integer | No | Filter by exact call type ID | `1` |
| `limit` | integer | No | Max results (1-1000, default: 100) | `50` |
| `offset` | integer | No | Pagination offset (default: 0) | `100` |

**Notes:**
- If `date` is provided, it takes precedence over `start_date`/`end_date`
- If `type` is provided, it takes precedence over `call_type_id`
- Date format must be `YYYY-MM-DD`

#### Examples

**Get today's calls:**
```bash
curl -X GET "http://localhost:3000/api/v1/calls" \
  -H "X-API-Key: your-api-key"
```

**Get calls for specific date:**
```bash
curl -X GET "http://localhost:3000/api/v1/calls?date=2025-12-02" \
  -H "X-API-Key: your-api-key"
```

**Get calls by city:**
```bash
curl -X GET "http://localhost:3000/api/v1/calls?city=תל אביב" \
  -H "X-API-Key: your-api-key"
```

**Get emergency calls:**
```bash
curl -X GET "http://localhost:3000/api/v1/calls?type=חירום" \
  -H "X-API-Key: your-api-key"
```

**Get calls with pagination:**
```bash
curl -X GET "http://localhost:3000/api/v1/calls?limit=20&offset=40" \
  -H "X-API-Key: your-api-key"
```

**Combined filters:**
```bash
curl -X GET "http://localhost:3000/api/v1/calls?date=2025-12-02&city=תל אביב&type=חירום&limit=10" \
  -H "X-API-Key: your-api-key"
```

#### PowerShell Examples

```powershell
# Simple request
$apiKey = "your-api-key"
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/calls?limit=10" `
    -Headers @{"X-API-Key"=$apiKey}
$response.Content | ConvertFrom-Json

# With filters
$params = @{
    date = "2025-12-02"
    city = "תל אביב"
    limit = 20
}
$queryString = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/calls?$queryString" `
    -Headers @{"X-API-Key"=$apiKey}
$response.Content | ConvertFrom-Json
```

#### Response

```json
{
  "success": true,
  "calls": [
    {
      "id": "uuid",
      "motorcycle_number": "5248",
      "city": "תל אביב",
      "street": "דיזנגוף",
      "location_details": "פינת בן גוריון",
      "call_date": "2025-12-02",
      "description": "חולה מחוסר הכרה",
      "meter_visa_number": "12345",
      "entry_code": "A123",
      "created_at": "2025-12-02T10:30:00Z",
      "call_types": {
        "id": 1,
        "name": "קריאת חירום",
        "color": "#FF0000"
      },
      "alert_codes": {
        "code": "17",
        "description": "תאונת דרכים"
      },
      "medical_codes": {
        "code": "306",
        "description": "חוסר הכרה"
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "returned": 100
  }
}
```

---

### 2. POST /api/v1/calls

Create a new call.

#### Request Body

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `city` | string | ✅ Yes | City name | `"תל אביב"` |
| `call_type_id` | integer | ✅ Yes | Call type ID | `1` |
| `street` | string | No | Street name | `"דיזנגוף"` |
| `location_details` | string | No | Additional location info | `"פינת בן גוריון"` |
| `alert_code_id` | integer | No | Alert code ID | `5` |
| `medical_code_id` | integer | No | Medical code ID | `3` |
| `meter_visa_number` | string | No | Meter/Visa number | `"12345"` |
| `entry_code` | string | No | Entry code | `"A123"` |
| `description` | string | No | Call description | `"חולה מחוסר הכרה"` |
| `call_date` | string | No | Date (YYYY-MM-DD, defaults to today) | `"2025-12-02"` |

#### Examples

**Minimum required fields:**
```bash
curl -X POST "http://localhost:3000/api/v1/calls" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "city": "תל אביב",
    "call_type_id": 1
  }'
```

**Full example:**
```bash
curl -X POST "http://localhost:3000/api/v1/calls" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "city": "תל אביב",
    "street": "דיזנגוף",
    "location_details": "פינת בן גוריון",
    "call_type_id": 1,
    "alert_code_id": 5,
    "medical_code_id": 3,
    "meter_visa_number": "12345",
    "entry_code": "A123",
    "description": "חולה מחוסר הכרה",
    "call_date": "2025-12-02"
  }'
```

#### PowerShell Example

```powershell
$apiKey = "your-api-key"
$body = @{
    city = "תל אביב"
    street = "דיזנגוף"
    call_type_id = 1
    description = "Test call from API"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/calls" `
    -Method POST `
    -Headers @{"X-API-Key"=$apiKey; "Content-Type"="application/json"} `
    -Body $body

$response.Content | ConvertFrom-Json
```

#### Response

```json
{
  "success": true,
  "message": "Call created successfully",
  "call": {
    "id": "uuid",
    "motorcycle_number": "5248",
    "city": "תל אביב",
    "street": "דיזנגוף",
    "call_date": "2025-12-02",
    "created_at": "2025-12-02T10:30:00Z",
    ...
  }
}
```

---

### 3. GET /api/v1/stats

Get statistics for a specific date with optional filters.

#### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `date` | string | No | Date (YYYY-MM-DD, defaults to today) | `2025-12-02` |
| `city` | string | No | Filter by city | `תל אביב` |
| `type` | string | No | Filter by call type name | `חירום` |

#### Examples

**Get today's stats:**
```bash
curl -X GET "http://localhost:3000/api/v1/stats" \
  -H "X-API-Key: your-api-key"
```

**Get stats for specific date:**
```bash
curl -X GET "http://localhost:3000/api/v1/stats?date=2025-12-02" \
  -H "X-API-Key: your-api-key"
```

**Get stats filtered by city:**
```bash
curl -X GET "http://localhost:3000/api/v1/stats?date=2025-12-02&city=תל אביב" \
  -H "X-API-Key: your-api-key"
```

#### PowerShell Example

```powershell
$apiKey = "your-api-key"
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/stats?date=2025-12-02" `
    -Headers @{"X-API-Key"=$apiKey}
$response.Content | ConvertFrom-Json
```

#### Response

```json
{
  "success": true,
  "date": "2025-12-02",
  "motorcycle_number": "5248",
  "filters": {
    "city": null,
    "type": null
  },
  "stats": {
    "total_calls": 25,
    "calls_by_type": {
      "קריאת חירום": 15,
      "קריאה רגילה": 8,
      "תאונה": 2
    },
    "calls_by_city": {
      "תל אביב": 12,
      "חיפה": 8,
      "ירושלים": 5
    }
  }
}
```

---

## Error Responses

### 401 Unauthorized
Missing or invalid API key.

```json
{
  "success": false,
  "message": "API key is required"
}
```

### 403 Forbidden
API key doesn't have required permission.

```json
{
  "success": false,
  "message": "API key does not have permission to read calls"
}
```

### 400 Bad Request
Invalid request data.

```json
{
  "success": false,
  "message": "Missing required fields: city and call_type_id are required"
}
```

### 500 Internal Server Error
Server error.

```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Detailed error message"
}
```

---

## Discord Bot Integration Example

```javascript
const axios = require('axios');

const API_BASE = 'https://your-app.onrender.com/api/v1';
const API_KEY = 'your-api-key';

client.on('messageCreate', async (message) => {
  // Get today's stats
  if (message.content === '!stats') {
    try {
      const { data } = await axios.get(`${API_BASE}/stats`, {
        headers: { 'X-API-Key': API_KEY }
      });
      
      message.reply(
        `📊 סטטיסטיקות היום:\n` +
        `סה"כ קריאות: ${data.stats.total_calls}\n` +
        `חלוקה לפי סוג:\n${Object.entries(data.stats.calls_by_type)
          .map(([type, count]) => `  • ${type}: ${count}`)
          .join('\n')}`
      );
    } catch (error) {
      message.reply('❌ שגיאה בטעינת סטטיסטיקות');
    }
  }

  // Create a call
  if (message.content.startsWith('!call')) {
    const args = message.content.split(' ').slice(1);
    const city = args[0];
    const description = args.slice(1).join(' ');
    
    try {
      const { data } = await axios.post(`${API_BASE}/calls`, {
        city,
        call_type_id: 1,
        description
      }, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      message.reply(`✅ קריאה נוצרה בהצלחה! מזהה: ${data.call.id}`);
    } catch (error) {
      message.reply('❌ שגיאה ביצירת קריאה');
    }
  }

  // Get calls by city
  if (message.content.startsWith('!calls')) {
    const city = message.content.split(' ')[1];
    
    try {
      const { data } = await axios.get(`${API_BASE}/calls`, {
        params: { city, limit: 5 },
        headers: { 'X-API-Key': API_KEY }
      });
      
      message.reply(
        `📞 קריאות אחרונות ב${city}:\n` +
        data.calls.map(c => 
          `• ${c.street || c.city} - ${c.call_types.name} (${new Date(c.created_at).toLocaleString('he-IL')})`
        ).join('\n')
      );
    } catch (error) {
      message.reply('❌ שגיאה בטעינת קריאות');
    }
  }
});
```

---

## Rate Limiting

Currently no rate limiting is implemented. Consider implementing in production:
- Recommended: 100 requests per minute per API key
- Monitor `last_used_at` field in database

## Best Practices

1. **Cache responses** when appropriate (stats don't change frequently)
2. **Use pagination** for large datasets (limit parameter)
3. **Handle errors gracefully** - check `success` field in response
4. **Store API key securely** - never commit to git or share publicly
5. **Use filters** to reduce response size and improve performance
6. **Validate dates** before sending (YYYY-MM-DD format)

---

**Last Updated:** December 2, 2025
**API Version:** v1
