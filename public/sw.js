const CACHE_NAME = 'mda-callcounter-v3';
const urlsToCache = [
    '/',
    '/css/style.css',
    '/js/app.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests and chrome-extension requests
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
        return;
    }
    
    // Skip CDN resources - let them load directly without caching
    const cdnDomains = [
        'cdn.jsdelivr.net',
        'code.jquery.com',
        'maps.googleapis.com',
        'maps.gstatic.com',
        'fonts.googleapis.com',
        'fonts.gstatic.com'
    ];
    
    if (cdnDomains.some(domain => event.request.url.includes(domain))) {
        // Let CDN resources pass through without service worker intervention
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version if available
                if (response) {
                    return response;
                }
                
                // For other requests, fetch from network
                return fetch(event.request);
            })
            .catch((error) => {
                console.log('Service worker fetch failed:', error);
                return new Response('Offline', { status: 503 });
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});