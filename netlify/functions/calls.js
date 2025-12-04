const { supabase } = require('./shared/supabase');
const { authenticateToken } = require('./shared/auth');
const { normalizeCallType } = require('./shared/helpers');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
    const path = event.path.replace('/.netlify/functions/calls', '');

    try {
        // GET /api/calls - Get today's calls
        if (event.httpMethod === 'GET' && (path === '' || path === '/')) {
            const queryParams = event.queryStringParameters || {};
            const vehicleNumber = queryParams.vehicle_number;

            const today = new Date().toISOString().split('T')[0];
            
            let query = supabase
                .from('calls')
                .select('*')
                .eq('user_id', userId)
                .eq('call_date', today)
                .order('created_at', { ascending: false });

            if (vehicleNumber) {
                query = query.eq('vehicle_number', vehicleNumber);
            }

            const { data: calls, error } = await query;

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בטעינת נתונים' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, calls: calls || [] })
            };
        }

        // POST /api/calls - Add new call
        if (event.httpMethod === 'POST' && (path === '' || path === '/')) {
            const callData = JSON.parse(event.body);
            
            const normalizedCallType = normalizeCallType(callData.call_type);
            
            const newCall = {
                user_id: userId,
                call_type: normalizedCallType,
                call_date: callData.call_date,
                start_time: callData.start_time,
                end_time: callData.end_time || null,
                duration_minutes: callData.duration_minutes || null,
                location: callData.location,
                city: callData.city || null,
                street: callData.street || null,
                description: callData.description || null,
                vehicle_type: callData.vehicle_type,
                vehicle_number: callData.vehicle_number,
                alert_code_id: callData.alert_code_id || null,
                medical_code_id: callData.medical_code_id || null,
                entry_code: callData.entry_code || null,
                meter_visa_number: callData.meter_visa_number || null
            };

            const { data, error } = await supabase
                .from('calls')
                .insert([newCall])
                .select()
                .single();

            if (error) {
                console.error('Error adding call:', error);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בשמירת הנסיעה' })
                };
            }

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ success: true, message: 'נסיעה נרשמה בהצלחה!', call: data })
            };
        }

        // DELETE /api/calls/:id
        if (event.httpMethod === 'DELETE' && path.startsWith('/')) {
            const callId = path.substring(1);

            const { error } = await supabase
                .from('calls')
                .delete()
                .eq('id', callId)
                .eq('user_id', userId);

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה במחיקת הנסיעה' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'נסיעה נמחקה בהצלחה' })
            };
        }

        // GET /api/calls/history - Get historical calls
        if (event.httpMethod === 'GET' && path === '/history') {
            const queryParams = event.queryStringParameters || {};
            const vehicleNumber = queryParams.vehicle_number;

            let query = supabase
                .from('calls')
                .select('*')
                .eq('user_id', userId)
                .order('call_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (vehicleNumber) {
                query = query.eq('vehicle_number', vehicleNumber);
            }

            const { data: calls, error } = await query;

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בטעינת היסטוריה' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, calls: calls || [] })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, message: 'Not found' })
        };

    } catch (error) {
        console.error('Calls error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'שגיאת שרת' })
        };
    }
};
