const { supabase } = require('./shared/supabase');
const { authenticateToken } = require('./shared/auth');
const { detectVehicleType } = require('./shared/helpers');

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
    const path = event.path.replace('/.netlify/functions/vehicle', '').replace('/api/vehicle', '');
    console.log('🚗 Vehicle function - Path:', event.path, 'Parsed:', path);

    try {
        // GET /api/vehicle/current - Get current vehicle
        if (event.httpMethod === 'GET' && path === '/current') {
            const { data, error } = await supabase
                .from('user_vehicle_settings')
                .select('vehicle_number, vehicle_type')
                .eq('user_id', userId)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בטעינת הגדרות רכב' })
                };
            }

            if (!data) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, data: null })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data })
            };
        }

        // POST /api/vehicle/current - Set current vehicle
        if (event.httpMethod === 'POST' && path === '/current') {
            const { vehicle_number, vehicle_type } = JSON.parse(event.body);

            if (!vehicle_number || !vehicle_type) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: 'נא להזין מספר רכב וסוג רכב' })
                };
            }

            // Check if vehicle is already assigned to another user
            const { data: existingAssignment } = await supabase
                .from('user_vehicle_settings')
                .select('user_id')
                .eq('vehicle_number', vehicle_number)
                .neq('user_id', userId)
                .maybeSingle();

            if (existingAssignment) {
                return {
                    statusCode: 409,
                    headers,
                    body: JSON.stringify({ success: false, message: 'רכב זה כבר בשימוש על ידי משתמש אחר' })
                };
            }

            // Delete user's previous vehicle assignment
            await supabase
                .from('user_vehicle_settings')
                .delete()
                .eq('user_id', userId);

            // Insert new vehicle assignment
            const { data, error } = await supabase
                .from('user_vehicle_settings')
                .insert([{
                    user_id: userId,
                    vehicle_number,
                    vehicle_type
                }])
                .select()
                .single();

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בשמירת הגדרות רכב' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'רכב נבחר בהצלחה', data })
            };
        }

        // DELETE /api/vehicle/current - Release current vehicle
        if (event.httpMethod === 'DELETE' && path === '/current') {
            const { error } = await supabase
                .from('user_vehicle_settings')
                .delete()
                .eq('user_id', userId);

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בשחרור רכב' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'רכב שוחרר בהצלחה' })
            };
        }

        // GET /api/vehicle/available - Get available vehicles
        if (event.httpMethod === 'GET' && path === '/available') {
            const { data: assignedVehicles } = await supabase
                .from('user_vehicle_settings')
                .select('vehicle_number, vehicle_type');

            const { data: allVehicles } = await supabase
                .from('vehicles')
                .select('vehicle_number, vehicle_type');

            const assignedNumbers = new Set(assignedVehicles.map(v => v.vehicle_number));
            const available = allVehicles.filter(v => !assignedNumbers.has(v.vehicle_number));

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, vehicles: available || [] })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, message: 'Not found' })
        };

    } catch (error) {
        console.error('Vehicle error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'שגיאת שרת' })
        };
    }
};
