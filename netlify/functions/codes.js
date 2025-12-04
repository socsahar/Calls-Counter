const { supabase } = require('./shared/supabase');
const { authenticateToken } = require('./shared/auth');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    const path = event.path.replace('/.netlify/functions/codes', '');

    try {
        // GET /api/codes/alert
        if (event.httpMethod === 'GET' && path === '/alert') {
            const { data: codes, error } = await supabase
                .from('alert_codes')
                .select('*')
                .order('code', { ascending: true });

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בטעינת קודי הזנקה' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, codes: codes || [] })
            };
        }

        // GET /api/codes/medical
        if (event.httpMethod === 'GET' && path === '/medical') {
            const { data: codes, error } = await supabase
                .from('medical_codes')
                .select('*')
                .order('code', { ascending: true });

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בטעינת קודים רפואיים' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, codes: codes || [] })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, message: 'Not found' })
        };

    } catch (error) {
        console.error('Codes error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'שגיאת שרת' })
        };
    }
};
