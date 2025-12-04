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

    const userId = authResult.user.id;
    const path = event.path.replace('/.netlify/functions/stats', '');
    const queryParams = event.queryStringParameters || {};
    const vehicleNumber = queryParams.vehicle_number;

    try {
        // GET /api/stats/today
        if (event.httpMethod === 'GET' && path === '/today') {
            const today = new Date().toISOString().split('T')[0];

            let query = supabase
                .from('calls')
                .select('duration_minutes')
                .eq('user_id', userId)
                .eq('call_date', today)
                .not('duration_minutes', 'is', null);

            if (vehicleNumber) {
                query = query.eq('vehicle_number', vehicleNumber);
            }

            const { data: calls, error } = await query;

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בטעינת סטטיסטיקות' })
                };
            }

            const totalCalls = calls.length;
            const totalHours = calls.reduce((sum, call) => sum + (call.duration_minutes || 0), 0) / 60;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    stats: { totalCalls, totalHours: parseFloat(totalHours.toFixed(2)) }
                })
            };
        }

        // GET /api/stats/weekly
        if (event.httpMethod === 'GET' && path === '/weekly') {
            const today = new Date();
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);

            let query = supabase
                .from('calls')
                .select('duration_minutes')
                .eq('user_id', userId)
                .gte('call_date', sevenDaysAgo.toISOString().split('T')[0])
                .not('duration_minutes', 'is', null);

            if (vehicleNumber) {
                query = query.eq('vehicle_number', vehicleNumber);
            }

            const { data: calls, error } = await query;

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בטעינת סטטיסטיקות' })
                };
            }

            const weeklyCalls = calls.length;
            const weeklyHours = calls.reduce((sum, call) => sum + (call.duration_minutes || 0), 0) / 60;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    stats: { weeklyCalls, weeklyHours: parseFloat(weeklyHours.toFixed(2)) }
                })
            };
        }

        // GET /api/stats/monthly
        if (event.httpMethod === 'GET' && path === '/monthly') {
            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);

            let query = supabase
                .from('calls')
                .select('duration_minutes')
                .eq('user_id', userId)
                .gte('call_date', thirtyDaysAgo.toISOString().split('T')[0])
                .not('duration_minutes', 'is', null);

            if (vehicleNumber) {
                query = query.eq('vehicle_number', vehicleNumber);
            }

            const { data: calls, error } = await query;

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בטעינת סטטיסטיקות' })
                };
            }

            const monthlyCalls = calls.length;
            const monthlyHours = calls.reduce((sum, call) => sum + (call.duration_minutes || 0), 0) / 60;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    stats: { monthlyCalls, monthlyHours: parseFloat(monthlyHours.toFixed(2)) }
                })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, message: 'Not found' })
        };

    } catch (error) {
        console.error('Stats error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'שגיאת שרת' })
        };
    }
};
