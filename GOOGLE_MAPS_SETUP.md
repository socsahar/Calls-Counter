# Google Maps Places API Setup Guide

## 📋 Overview
This guide will help you integrate Google Maps Places Autocomplete API to get real Israeli street addresses and cities instead of using a hardcoded list.

## 🔑 Step 1: Get Google Maps API Key

### 1.1 Go to Google Cloud Console
- Visit: https://console.cloud.google.com/
- Sign in with your Google account

### 1.2 Create a New Project (or use existing)
1. Click the project dropdown at the top
2. Click "NEW PROJECT"
3. Name it: "MDA CallCounter"
4. Click "CREATE"

### 1.3 Enable Places API (New)
1. In the left menu, go to **APIs & Services** → **Library**
2. Search for "**Places API (New)**"
3. Click on it
4. Click "**ENABLE**"

### 1.4 Create API Key
1. Go to **APIs & Services** → **Credentials**
2. Click "**+ CREATE CREDENTIALS**"
3. Select "**API key**"
4. Copy the API key that appears

### 1.5 Restrict API Key (IMPORTANT for security)
1. Click on the newly created API key to edit it
2. Under "**API restrictions**":
   - Select "Restrict key"
   - Check only: **Places API (New)**
3. Under "**Application restrictions**":
   - Select "HTTP referrers (web sites)"
   - Click "ADD AN ITEM"
   - Add your domains:
     ```
     https://your-app-name.onrender.com/*
     http://localhost:3000/*
     ```
4. Click "**SAVE**"

## ⚙️ Step 2: Add API Key to Your Project

### 2.1 Add to .env file
```bash
# Add this line to your .env file
GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

### 2.2 Update server.js
Add endpoint to serve the API key to the frontend:

```javascript
// Add this endpoint in server.js
app.get('/api/config/google-maps-key', authenticateToken, (req, res) => {
    res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY });
});
```

## 🔧 Step 3: Update Frontend Files

### 3.1 Update index.html
Add Google Maps script BEFORE your app.js:

```html
<!-- Add this in the <head> section, after Select2 -->
<script id="google-maps-script" data-api-key=""></script>

<!-- Add before closing </body>, BEFORE app.js -->
<script>
    // Load Google Maps API dynamically
    async function loadGoogleMaps() {
        try {
            const response = await fetch('/api/config/google-maps-key', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const { apiKey } = await response.json();
            
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=iw`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        } catch (error) {
            console.error('Failed to load Google Maps:', error);
        }
    }
    loadGoogleMaps();
</script>
```

### 3.2 Update Content Security Policy
Update the CSP meta tag in index.html to allow Google Maps:

```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://code.jquery.com https://cdn.jsdelivr.net https://maps.googleapis.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://*.supabase.co https://maps.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com;
    img-src 'self' data: https: https://maps.googleapis.com https://maps.gstatic.com;
">
```

### 3.3 Update app.js
Replace the old AddressAutocomplete initialization with GoogleAddressAutocomplete:

```javascript
// Instead of:
// const cityAutocomplete = new AddressAutocomplete();
// cityAutocomplete.init(cityInput, 'city');

// Use:
const cityAutocomplete = new GoogleAddressAutocomplete();
cityAutocomplete.init(cityInput, 'city');

const streetAutocomplete = new GoogleAddressAutocomplete();
streetAutocomplete.init(streetInput, 'address');
```

## 💰 Step 4: Pricing Information

### Free Tier
- **$200 free credit per month** (covers ~28,000 requests)
- Places Autocomplete: **$2.83 per 1,000 requests**
- First request counts, then free until selection

### Cost Estimation
- If 10 users, each doing 30 calls/day = 300 requests/day = ~9,000/month
- Cost: ~$25/month (covered by free credit)

### Enable Billing
1. In Google Cloud Console, go to **Billing**
2. Link a credit card (won't be charged if within free tier)
3. Set up budget alerts at $50, $100, $150

## 🎨 Step 5: Add CSS Styling

Add to style.css for Google suggestions:

```css
/* Google Places Autocomplete Styling */
.google-suggestions .suggestion-item {
    padding: 12px;
    cursor: pointer;
    border-bottom: 1px solid var(--gray-200);
    transition: all var(--transition-fast);
}

.google-suggestions .suggestion-item:last-child {
    border-bottom: none;
}

.google-suggestions .suggestion-item:hover,
.google-suggestions .suggestion-item.selected {
    background-color: var(--mda-red);
    color: var(--white);
}

.suggestion-main {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 2px;
}

.suggestion-secondary {
    font-size: 12px;
    opacity: 0.7;
}

.google-suggestions .suggestion-item:hover .suggestion-main,
.google-suggestions .suggestion-item:hover .suggestion-secondary,
.google-suggestions .suggestion-item.selected .suggestion-main,
.google-suggestions .suggestion-item.selected .suggestion-secondary {
    color: var(--white);
}
```

## ✅ Step 6: Testing

1. **Test locally first**:
   - Start your server: `node server.js`
   - Open http://localhost:3000
   - Try typing in city/street fields
   - Check browser console for errors

2. **Test in production**:
   - Deploy to Render
   - Add Render environment variable: `GOOGLE_MAPS_API_KEY`
   - Test on live site

## 🔍 Troubleshooting

### API Key not working?
- Check if Places API (New) is enabled
- Verify API restrictions include your domain
- Check browser console for error messages

### CSP blocking Google Maps?
- Ensure CSP includes all Google domains
- Add `'unsafe-eval'` to script-src if needed

### No suggestions appearing?
- Check network tab - are API calls being made?
- Verify API key is loaded correctly
- Check for JavaScript errors in console

## 📚 Benefits of Google Places API

✅ **Real-time data** - Always up-to-date addresses
✅ **Complete coverage** - ALL streets in Israel
✅ **Accurate spelling** - Hebrew names correctly spelled
✅ **Address validation** - Ensures addresses exist
✅ **House numbers** - Can include building numbers
✅ **Neighborhood info** - Secondary text shows area/city
✅ **Auto-correct** - Fixes typos automatically

## 🎯 Next Steps

Would you like me to:
1. ✅ Implement this automatically in your code?
2. ✅ Update all the files needed?
3. ✅ Test it after you get the API key?

Just say "implement Google Maps" and I'll make all the changes! 🚀
