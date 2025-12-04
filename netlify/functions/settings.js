const { supabase } = require('./shared/supabase');
const { authenticateToken } = require('./shared/auth');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const authResult = authenticateToken(event.headers);
    if (authResult.error) {
        return {
            statusCode: authResult.statusCode,
            headers,
            body: JSON.stringify({ success: false, message: authResult.error })
        };
    }

    const userId = authResult.user.user_id;
    const path = event.path.replace('/.netlify/functions/settings', '').replace('/api/settings', '');
    console.log('⚙️ Settings function - Path:', event.path, 'Parsed:', path);

    try {
        // GET /api/settings/entry-code
        if (event.httpMethod === 'GET' && path === '/entry-code') {
            const { data: settings } = await supabase
                .from('user_settings')
                .select('entry_code')
                .eq('user_id', userId)
                .maybeSingle();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    entry_code: settings?.entry_code || null 
                })
            };
        }

        // PUT /api/settings/entry-code
        if (event.httpMethod === 'PUT' && path === '/entry-code') {
            const { entry_code } = JSON.parse(event.body);

            const { data: existing } = await supabase
                .from('user_settings')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('user_settings')
                    .update({ entry_code })
                    .eq('user_id', userId);
            } else {
                await supabase
                    .from('user_settings')
                    .insert([{ user_id: userId, entry_code }]);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'קוד כניסה נשמר בהצלחה' 
                })
            };
        }

        // GET /api/settings/meter-visa
        if (event.httpMethod === 'GET' && path === '/meter-visa') {
            const { data: settings } = await supabase
                .from('user_settings')
                .select('meter_number, visa_number')
                .eq('user_id', userId)
                .maybeSingle();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    meter_number: settings?.meter_number || null,
                    visa_number: settings?.visa_number || null
                })
            };
        }

        // PUT /api/settings/meter-visa
        if (event.httpMethod === 'PUT' && path === '/meter-visa') {
            const { meter_number, visa_number } = JSON.parse(event.body);

            const { data: existing } = await supabase
                .from('user_settings')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('user_settings')
                    .update({ meter_number, visa_number })
                    .eq('user_id', userId);
            } else {
                await supabase
                    .from('user_settings')
                    .insert([{ user_id: userId, meter_number, visa_number }]);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'הגדרות נשמרו בהצלחה' 
                })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, message: 'Not found' })
        };

    } catch (error) {
        console.error('Settings error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'שגיאת שרת' })
        };
    }
};
