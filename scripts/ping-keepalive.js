#!/usr/bin/env node

/**
 * MDA CallCounter - Keep Alive Ping Script
 * 
 * This script pings the Render deployment every 2 minutes to prevent
 * the free tier from spinning down due to inactivity.
 * 
 * Usage: node scripts/ping-keepalive.js
 * Or via cron: every 2 minutes - node /path/to/scripts/ping-keepalive.js
 */

const https = require('https');
const http = require('http');

const WEBSITE_URL = 'https://calls-counter.onrender.com/';
const TIMEOUT = 30000; // 30 seconds timeout
const USER_AGENT = 'MDA-CallCounter-KeepAlive/1.0';

/**
 * Performs a health check ping to the website
 */
async function pingWebsite() {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const url = new URL(WEBSITE_URL);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'GET',
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: TIMEOUT
        };

        const req = client.request(options, (res) => {
            const responseTime = Date.now() - startTime;
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const result = {
                    success: true,
                    statusCode: res.statusCode,
                    responseTime: responseTime,
                    contentLength: data.length,
                    timestamp: new Date().toISOString()
                };
                resolve(result);
            });
        });

        req.on('error', (error) => {
            const result = {
                success: false,
                error: error.message,
                responseTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
            reject(result);
        });

        req.on('timeout', () => {
            req.destroy();
            const result = {
                success: false,
                error: 'Request timeout',
                responseTime: TIMEOUT,
                timestamp: new Date().toISOString()
            };
            reject(result);
        });

        req.end();
    });
}

/**
 * Logs the result to console with Hebrew timestamp
 */
function logResult(result) {
    const hebrewTime = new Date().toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    if (result.success) {
        console.log(`✅ [${hebrewTime}] Ping successful`);
        console.log(`   Status: ${result.statusCode}`);
        console.log(`   Response Time: ${result.responseTime}ms`);
        console.log(`   Content Length: ${result.contentLength} bytes`);
    } else {
        console.log(`❌ [${hebrewTime}] Ping failed`);
        console.log(`   Error: ${result.error}`);
        console.log(`   Response Time: ${result.responseTime}ms`);
    }
    console.log('---');
}

/**
 * Main execution function
 */
async function main() {
    console.log(`🏍️ MDA CallCounter Keep-Alive Ping`);
    console.log(`🎯 Target: ${WEBSITE_URL}`);
    console.log(`⏰ Started at: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`);
    console.log('📡 Pinging...\n');

    try {
        const result = await pingWebsite();
        logResult(result);
        
        // Exit with success code
        process.exit(0);
    } catch (error) {
        logResult(error);
        
        // Exit with error code for cron monitoring
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Execute main function
if (require.main === module) {
    main();
}

module.exports = { pingWebsite, logResult };