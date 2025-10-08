const CACHE_NAME = 'mda-callcounter-v1';
const urlsToCache = [
    '/',
    '/css/style.css',
    '/js/app.js',
    'https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&display=swap'
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
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version if available
                if (response) {
                    return response;
                }
                
                // For font requests, handle CSP issues gracefully
                if (event.request.url.includes('fonts.gstatic.com')) {
                    return fetch(event.request).catch(() => {
                        // If font fetch fails due to CSP, continue without error
                        console.log('Font fetch blocked by CSP, using fallback');
                        return new Response('', { status: 200 });
                    });
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