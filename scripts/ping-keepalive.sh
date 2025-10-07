#!/bin/bash

# MDA CallCounter - Keep Alive Ping Script for console.cron-job.org
# This script pings the Render deployment to prevent it from spinning down

WEBSITE_URL="https://calls-counter.onrender.com/"
USER_AGENT="MDA-CallCounter-KeepAlive/1.0"
TIMEOUT=30

# Get current timestamp in Hebrew locale
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "🏍️ MDA CallCounter Keep-Alive Ping"
echo "🎯 Target: $WEBSITE_URL"
echo "⏰ Time: $TIMESTAMP"
echo "📡 Pinging..."

# Perform the ping with curl
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total};SIZE:%{size_download}" \
    -H "User-Agent: $USER_AGENT" \
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
    -H "Accept-Language: he-IL,he;q=0.9,en;q=0.8" \
    -H "Cache-Control: no-cache" \
    --connect-timeout $TIMEOUT \
    --max-time $TIMEOUT \
    "$WEBSITE_URL" 2>&1)

# Extract response details
HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
TIME_TOTAL=$(echo "$RESPONSE" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
SIZE_DOWNLOAD=$(echo "$RESPONSE" | grep -o "SIZE:[0-9]*" | cut -d: -f2)

# Check if curl command was successful
if [ $? -eq 0 ] && [ ! -z "$HTTP_STATUS" ]; then
    if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
        echo "✅ Ping successful"
        echo "   Status: $HTTP_STATUS"
        echo "   Response Time: ${TIME_TOTAL}s"
        echo "   Content Size: $SIZE_DOWNLOAD bytes"
        exit 0
    else
        echo "❌ Ping failed - HTTP $HTTP_STATUS"
        echo "   Response Time: ${TIME_TOTAL}s"
        exit 1
    fi
else
    echo "❌ Ping failed - Connection error"
    echo "   Curl output: $RESPONSE"
    exit 1
fi