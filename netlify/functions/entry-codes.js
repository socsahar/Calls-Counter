const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('./shared/auth');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    try {
        const path = event.path.replace('/.netlify/functions/entry-codes', '').replace('/api/entry-codes', '');
        console.log('🔑 Entry-codes function - Path:', event.path, 'Parsed:', path);
        const method = event.httpMethod;

        console.log(`🔑 Entry Codes Function - ${method} ${path}`);

        // Authenticate user
        const authResult = authenticateToken(event);
        if (!authResult.success) {
            return {
                statusCode: authResult.statusCode,
                body: JSON.stringify({ success: false, message: authResult.message })
            };
        }

        const userId = authResult.user.user_id;
        const isAdmin = authResult.user.is_admin;

        // GET /api/entry-codes - Get all entry codes
        if (method === 'GET' && (path === '/api/entry-codes' || path.includes('/entry-codes') && !path.includes('/admin'))) {
            console.log('🔑 Fetching entry codes...');

            // Query 1: Get manually added entry codes from entry_codes table
            const { data: manualCodes, error: manualError } = await supabase
                .from('entry_codes')
                .select('entry_code, city, street, location_details, id, notes')
                .order('city', { ascending: true })
                .order('street', { ascending: true });

            if (manualError) {
                console.error('Error fetching manual entry codes:', manualError);
            }

            // Query 2: Get entry codes from calls
            const { data: callCodes, error: callError } = await supabase
                .from('calls')
                .select('entry_code, city, street, location')
                .not('entry_code', 'is', null)
                .not('entry_code', 'eq', '')
                .order('city', { ascending: true })
                .order('street', { ascending: true });

            if (callError) {
                console.error('Error fetching entry codes from calls:', callError);
            }

            // Process and deduplicate the results
            const entryCodesMap = new Map();
            
            // Add manual codes first (they have priority)
            if (manualCodes) {
                manualCodes.forEach(code => {
                    const key = `${code.entry_code}|${code.city}|${code.street}`;
                    entryCodesMap.set(key, {
                        entry_code: code.entry_code,
                        city: code.city || '',
                        street: code.street || '',
                        location_details: code.location_details || '',
                        source: 'manual',
                        id: code.id
                    });
                });
            }
            
            // Add codes from calls (skip if already exists)
            if (callCodes) {
                callCodes.forEach(call => {
                    // Extract location details (everything after city and street)
                    let locationDetails = '';
                    if (call.location) {
                        const parts = call.location.split(',').map(s => s.trim());
                        if (parts.length > 2) {
                            locationDetails = parts.slice(2).join(', ');
                        }
                    }

                    // Create a unique key for each combination
                    const key = `${call.entry_code}|${call.city}|${call.street}`;
                    
                    if (!entryCodesMap.has(key)) {
                        entryCodesMap.set(key, {
                            entry_code: call.entry_code,
                            city: call.city || '',
                            street: call.street || '',
                            location_details: locationDetails,
                            source: 'call'
                        });
                    }
                });
            }

            // Convert map to array
            const uniqueEntryCodes = Array.from(entryCodesMap.values());

            console.log(`🔑 Found ${uniqueEntryCodes.length} unique entry codes`);

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                    success: true,
                    data: uniqueEntryCodes,
                    count: uniqueEntryCodes.length
                })
            };
        }

        return {
            statusCode: 404,
            body: JSON.stringify({ success: false, message: 'Endpoint not found' })
        };

    } catch (error) {
        console.error('🔑 Entry codes function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                message: 'שגיאת שרת פנימית',
                error: error.message
            })
        };
    }
};
