# 🕐 Cron-Job.org Setup Guide - Keep Render Alive

## 📋 Overview

This guide will help you set up a FREE automated cron job on **cron-job.org** to ping your Render deployment every few minutes, preventing it from spinning down due to inactivity.

---

## 🎯 Step-by-Step Setup

### **Step 1: Create Account on Cron-Job.org**

1. Go to: **https://console.cron-job.org/signup**
2. Sign up with your email (it's FREE - no credit card required)
3. Verify your email address
4. Log in to: **https://console.cron-job.org/login**

---

### **Step 2: Create New Cron Job**

1. Click **"Create cron job"** button (top right)
2. Fill in the form:

#### **Basic Settings:**
- **Title**: `MDA CallCounter Keep-Alive`
- **URL**: `https://calls-counter.onrender.com/api/keepalive`
- **Status**: ✅ Enabled

#### **Schedule Settings:**
Choose ONE of these options:

**Option A: Every 10 minutes (Recommended)**
- Click **"Every 10 minutes"** quick button
- OR use expression: `*/10 * * * *`

**Option B: Every 5 minutes (More aggressive)**
- Use expression: `*/5 * * * *`

**Option C: Every 14 minutes (Just before Render timeout)**
- Use expression: `*/14 * * * *`

#### **Advanced Settings (Optional):**
- **Timeout**: 30 seconds
- **Request Method**: GET
- **User-Agent**: `MDA-CallCounter-CronJob/1.0` (optional)
- **Enable notifications**: ✅ (get email if ping fails)
- **Save responses**: ✅ (helps with debugging)

3. Click **"Create"**

---

### **Step 3: Test Your Cron Job**

1. Find your new cron job in the dashboard
2. Click the **"▶ Execute now"** button
3. Wait a few seconds
4. Check the result:
   - ✅ **Green checkmark** = Success!
   - ❌ **Red X** = Failed (check the error log)

**Expected successful response:**
```json
{
  "status": "alive",
  "timestamp": "2025-11-04T10:30:00.000Z",
  "server": "MDA-CallCounter"
}
```

---

### **Step 4: Monitor Your Cron Job**

#### **View Execution History:**
1. Go to **Dashboard** → Click on your cron job
2. See recent executions with:
   - ✅ Success/Fail status
   - Response time
   - Response code (should be 200)
   - Response body

#### **Set Up Notifications:**
1. Click on your cron job
2. Go to **"Notifications"** tab
3. Enable:
   - ☑️ **Email on failure** (get notified if site is down)
   - ☑️ **Email on success after failure** (recovery notification)

---

## 🔍 Alternative Endpoints

Your app has multiple endpoints you can use:

| Endpoint | URL | Response | Use Case |
|----------|-----|----------|----------|
| **Keep-Alive** | `/api/keepalive` | JSON | ✅ Recommended for cron |
| **Ping** | `/ping` | "pong" | Minimal response |
| **Health** | `/api/health` | Detailed JSON | Full health check |
| **Status** | `/api/status` | Plain text | Human-readable |

**Recommended:** Use `/api/keepalive` - it's lightweight and logs each ping.

---

## 📊 Monitoring & Statistics

### **Free Tier Limits:**
- ✅ Unlimited cron jobs
- ✅ 1-minute minimum interval
- ✅ Email notifications
- ✅ Execution history (last 100)
- ✅ Response logging

### **What to Monitor:**
1. **Success Rate**: Should be close to 100%
2. **Response Time**: Usually 100-500ms (cold start: 5-10 seconds)
3. **Status Code**: Should always be 200
4. **Last Execution**: Check it's running on schedule

---

## 🚨 Troubleshooting

### **Problem: Cron job failing**

**Check 1: Test the URL manually**
```bash
curl https://calls-counter.onrender.com/api/keepalive
```

**Expected output:**
```json
{"status":"alive","timestamp":"...","server":"MDA-CallCounter"}
```

**Check 2: Look at error message in cron-job.org**
- Timeout? → Increase timeout to 60 seconds
- 404 Not Found? → Check URL spelling
- 500 Error? → Check server logs on Render

---

### **Problem: Site still spinning down**

**Cause:** Render free tier sleeps after **15 minutes** of NO activity

**Solutions:**
1. Reduce cron interval to **10 minutes** (instead of 14)
2. Use **two different cron services** at 5-minute intervals
3. Add a second endpoint to ping: `/ping`

---

### **Problem: Too many requests error**

If you get rate-limited:
1. Increase interval to 15 minutes
2. Check you don't have multiple cron jobs pinging the same URL
3. Use the lightweight `/ping` endpoint instead

---

## 📱 Mobile App (Optional)

Cron-job.org also has a mobile app:
- **Android**: Google Play Store
- **iOS**: Apple App Store

Monitor your cron jobs on the go! 📲

---

## 🔄 Backup Options

If cron-job.org is down, you can use:

### **Option 1: UptimeRobot**
- URL: https://uptimerobot.com/
- Free tier: 50 monitors, 5-minute interval
- Bonus: Get uptime statistics

### **Option 2: StatusCake**
- URL: https://www.statuscake.com/
- Free tier: Unlimited tests, 5-minute interval
- Bonus: Performance monitoring

### **Option 3: GitHub Actions**
Create `.github/workflows/keepalive.yml`:
```yaml
name: Keep Alive
on:
  schedule:
    - cron: '*/10 * * * *'
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping
        run: curl https://calls-counter.onrender.com/api/keepalive
```

---

## ✅ Verification Checklist

After setup, verify everything is working:

- [ ] Cron job created on cron-job.org
- [ ] Schedule set to every 10 minutes
- [ ] Test execution successful (green checkmark)
- [ ] Email notifications enabled
- [ ] Check execution history shows regular pings
- [ ] Visit your app - should load quickly (no cold start)
- [ ] Check Render logs - should see "🏓 Keep-alive ping" messages

---

## 📞 Support

If you need help:
1. Check cron-job.org documentation: https://cron-job.org/en/documentation/
2. Check Render status: https://status.render.com/
3. Check your app logs on Render dashboard

---

## 🎉 You're Done!

Your MDA CallCounter app will now stay alive 24/7 with no manual intervention! 🚀

The cron job will:
- ✅ Ping your app every 10 minutes
- ✅ Prevent Render from spinning down
- ✅ Send you alerts if anything goes wrong
- ✅ Keep response times fast for all users

Enjoy your always-on app! 🏍️💨
