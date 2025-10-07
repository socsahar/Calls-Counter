# MDA CallCounter - Keep Alive Configuration for console.cron-job.org

## Website Ping Configuration

**Target URL:** https://calls-counter.onrender.com/
**Method:** GET
**Interval:** Every 2 minutes
**Cron Expression:** */2 * * * *

## Setup Instructions for console.cron-job.org:

1. **Go to console.cron-job.org**
2. **Create Account/Login**
3. **Click "Create cronjob"**
4. **Fill in the details:**

### Basic Settings:
- **Title:** MDA CallCounter Keep-Alive Ping
- **Address (URL):** https://calls-counter.onrender.com/
- **Execution:** Every 2 minutes
- **Cron Expression:** */2 * * * *

### Advanced Settings (Optional):
- **Request method:** GET
- **Request timeout:** 30 seconds
- **Follow redirects:** Yes
- **User Agent:** MDA-CallCounter-KeepAlive/1.0
- **Expected HTTP status code:** 200
- **Notification settings:** Enable email notifications for failures

### Headers (Optional):
- Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
- Accept-Language: he-IL,he;q=0.9,en;q=0.8
- Cache-Control: no-cache

## Purpose:
This cronjob prevents the Render free tier deployment from spinning down
due to inactivity by sending a GET request every 2 minutes.

## Monitoring:
The console.cron-job.org dashboard will show:
- Execution history
- Response times
- Success/failure rates
- HTTP status codes

## Backup Schedule:
If needed, you can also set up additional pings at:
- Every 5 minutes during peak hours: 0,5,10,15,20,25,30,35,40,45,50,55 8-18 * * *
- Every 10 minutes during off-hours: */10 19-7 * * *