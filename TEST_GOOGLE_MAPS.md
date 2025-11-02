# 🔍 Google Maps Troubleshooting Guide

## ❓ Why aren't cities showing when I type?

There are 3 possible reasons:

### 1️⃣ **API Key Not Added to Render** (Most Common)
**Check:** Did you add `GOOGLE_MAPS_API_KEY` to Render environment variables?

**How to Fix:**
1. Go to: https://dashboard.render.com/
2. Select your service
3. Click **"Environment"** (left sidebar)
4. Look for `GOOGLE_MAPS_API_KEY` variable
5. If missing:
   - Click **"Add Environment Variable"**
   - Key: `GOOGLE_MAPS_API_KEY`
   - Value: `AIzaSyC3bsVjP-DlsHQ0VHowDhdo6yVYcI1BXcg`
   - Click **"Save Changes"**
   - Wait 2-3 minutes for redeploy

### 2️⃣ **API Key Not Restricted Properly**
**Check:** Open browser console (F12) and look for errors

**Common Errors:**
- `RefererNotAllowedMapError` → API key domain restrictions wrong
- `REQUEST_DENIED` → Places API not enabled

**How to Fix:**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your API key
3. Under **"Application restrictions"**:
   - Select "HTTP referrers (web sites)"
   - Add:
     ```
     https://*.onrender.com/*
     http://localhost:3000/*
     ```
4. Under **"API restrictions"**:
   - Select "Restrict key"
   - Check: ☑️ **Places API (New)**
5. Click **"SAVE"**
6. Wait 1-2 minutes for changes to propagate

### 3️⃣ **Google Maps Not Loading**
**Check Console Messages:**

Open browser console (F12) and look for these messages:

✅ **Good Signs:**
```
🗺️ Fetching Google Maps API key...
🔑 API key retrieved, loading Google Maps...
✅ Google Maps API loaded successfully
✅ Google Places Autocomplete initialized for: city
```

❌ **Bad Signs:**
```
⚠️ Failed to fetch Google Maps API key: 401
⚠️ Google Maps API key not configured on server
❌ Failed to load Google Maps API - check API key restrictions
⏳ Waiting for authentication before loading Google Maps
```

---

## 🧪 Quick Test Steps:

### Step 1: Check Console
1. Open your app
2. Press **F12** (open developer tools)
3. Click **"Console"** tab
4. Look for Google Maps messages
5. Take a screenshot if you see errors

### Step 2: Test API Key Endpoint
In console, run this:
```javascript
fetch('/api/config/google-maps-key', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
})
.then(r => r.json())
.then(data => console.log('API Key:', data.apiKey ? 'EXISTS ✅' : 'MISSING ❌'))
```

### Step 3: Check If Google Maps Loaded
In console, run:
```javascript
console.log('Google Maps:', window.google ? 'LOADED ✅' : 'NOT LOADED ❌');
```

### Step 4: Test Autocomplete Manually
Type in city field and watch console for:
- `getSuggestions` calls
- API responses
- Errors

---

## 🔄 Fallback Mode

If Google Maps doesn't work, the app will use the **local street list** (300+ streets).

**How to tell if you're in fallback mode:**
- Console shows: `📍 City autocomplete initialized (Local)`
- Instead of: `📍 City autocomplete initialized (Google Maps)`

---

## 📋 Checklist Before Asking for Help:

- [ ] Added `GOOGLE_MAPS_API_KEY` to Render environment variables
- [ ] Waited 3+ minutes after adding (for redeploy)
- [ ] Hard refreshed browser (Ctrl+Shift+R)
- [ ] Cleared browser cache
- [ ] Checked browser console for errors
- [ ] Verified API key restrictions in Google Cloud
- [ ] Confirmed Places API (New) is enabled

---

## 🆘 Still Not Working?

**Send me a screenshot of:**
1. Browser console showing all messages
2. Network tab showing the `/api/config/google-maps-key` request
3. Render environment variables page (blur the key value!)

Then I can tell you exactly what's wrong! 🎯
