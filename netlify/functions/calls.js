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
    const path = event.path.replace('/.netlify/functions/calls', '').replace('/api/calls', '');
    console.log('📞 Calls function - Path:', event.path, 'Parsed:', path);

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

        // GET /api/calls/historical - Get historical calls by year/month
        if (event.httpMethod === 'GET' && path === '/historical') {
            const queryParams = event.queryStringParameters || {};
            const { year, month } = queryParams;
            
            if (!year) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: 'יש לספק שנה' })
                };
            }

            // Build date range for call_date filtering
            let startDateStr, endDateStr;
            
            if (month) {
                // Specific month
                const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                const endDate = new Date(parseInt(year), parseInt(month), 1);
                startDateStr = startDate.toISOString().split('T')[0];
                endDateStr = endDate.toISOString().split('T')[0];
            } else {
                // Entire year
                const startDate = new Date(parseInt(year), 0, 1);
                const endDate = new Date(parseInt(year) + 1, 0, 1);
                startDateStr = startDate.toISOString().split('T')[0];
                endDateStr = endDate.toISOString().split('T')[0];
            }

            console.log(`📅 Historical query range: ${startDateStr} to ${endDateStr}`);

            // Get user's selected vehicle to filter by
            let userVehicleNumber = null;
            try {
                const { data: vehicleData } = await supabase
                    .rpc('get_user_vehicle', {
                        p_user_id: userId
                    });
                
                if (vehicleData && vehicleData.length > 0) {
                    userVehicleNumber = vehicleData[0].vehicle_number;
                    console.log('📅 Filtering historical calls by vehicle:', userVehicleNumber);
                }
            } catch (vehicleError) {
                console.log('📅 Could not fetch user vehicle, showing all calls');
            }

            // Get calls data - JOIN with alert_codes and medical_codes
            let query = supabase
                .from('calls')
                .select(`
                    *,
                    alert_codes:alert_code_id(code),
                    medical_codes:medical_code_id(code)
                `)
                .eq('user_id', userId)
                .gte('call_date', startDateStr)
                .lt('call_date', endDateStr);

            if (userVehicleNumber) {
                query = query.eq('vehicle_number', userVehicleNumber);
            }

            query = query.order('call_date', { ascending: false });

            const { data: calls, error: callsError } = await query;

            if (callsError) {
                console.error('Supabase error:', callsError);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        message: 'שגיאה בטעינת הנתונים',
                        error: callsError.message
                    })
                };
            }

            // Transform calls to flatten the joined data
            const transformedCalls = calls ? calls.map(call => ({
                ...call,
                alert_code: call.alert_codes?.code || null,
                medical_code: call.medical_codes?.code || null
            })) : [];

            // Calculate statistics
            const calculateHours = (calls) => {
                if (!calls || calls.length === 0) return 0;
                const totalMinutes = calls.reduce((sum, call) => {
                    return sum + (call.duration_minutes || 30);
                }, 0);
                return Math.round(totalMinutes / 60 * 10) / 10;
            };

            const stats = {
                total: transformedCalls.length,
                urgent: transformedCalls.filter(c => c.call_type === 'דחוף').length,
                atan: transformedCalls.filter(c => c.call_type === 'אט"ן' || c.call_type === 'אט״ן').length,
                aran: transformedCalls.filter(c => c.call_type === 'ארן').length,
                natbag: transformedCalls.filter(c => c.call_type === 'נתבג').length,
                total_hours: calculateHours(transformedCalls)
            };

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    calls: transformedCalls,
                    statistics: stats
                })
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
