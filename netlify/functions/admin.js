const { supabase } = require('./shared/supabase');
const { authenticateToken } = require('./shared/auth');

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

    // Check if user is admin
    if (authResult.user.role !== 'admin') {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ success: false, message: 'גישה נדחתה - נדרשות הרשאות מנהל' })
        };
    }

    const path = event.path.replace('/.netlify/functions/admin', '');

    try {
        // GET /api/admin/dashboard
        if (event.httpMethod === 'GET' && path === '/dashboard') {
            const today = new Date().toISOString().split('T')[0];
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Get all users
            const { data: users } = await supabase
                .from('users')
                .select('id, full_name, mda_code, email, role, created_at');

            // Get today's calls
            const { data: todayCalls } = await supabase
                .from('calls')
                .select('*')
                .eq('call_date', today);

            // Get weekly calls
            const { data: weeklyCalls } = await supabase
                .from('calls')
                .select('*')
                .gte('call_date', sevenDaysAgo.toISOString().split('T')[0]);

            // Get monthly calls
            const { data: monthlyCalls } = await supabase
                .from('calls')
                .select('*')
                .gte('call_date', thirtyDaysAgo.toISOString().split('T')[0]);

            // Calculate stats by vehicle type
            const vehicleCallStats = {
                motorcycle: 0,
                picanto: 0,
                ambulance: 0,
                personal_standby: 0
            };

            const callTypeStats = {
                'דחוף': 0,
                'אט"ן': 0,
                'ארן': 0,
                'נתבג': 0
            };

            monthlyCalls.forEach(call => {
                if (call.vehicle_number) {
                    const num = call.vehicle_number.toString();
                    const len = num.length;
                    const firstDigit = num.charAt(0);
                    
                    if (len === 5 && (firstDigit === '1' || firstDigit === '2')) {
                        vehicleCallStats.personal_standby++;
                    } else if (len === 4 && firstDigit === '5') {
                        vehicleCallStats.motorcycle++;
                    } else if (len === 4 && firstDigit === '6') {
                        vehicleCallStats.picanto++;
                    } else {
                        vehicleCallStats.ambulance++;
                    }
                }
                
                if (call.call_type && callTypeStats.hasOwnProperty(call.call_type)) {
                    callTypeStats[call.call_type]++;
                }
            });

            const totalHoursToday = todayCalls.reduce((sum, call) => 
                sum + (call.duration_minutes || 0), 0) / 60;
            const totalHoursWeekly = weeklyCalls.reduce((sum, call) => 
                sum + (call.duration_minutes || 0), 0) / 60;
            const totalHoursMonthly = monthlyCalls.reduce((sum, call) => 
                sum + (call.duration_minutes || 0), 0) / 60;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    dashboard: {
                        totalUsers: users.length,
                        totalCallsToday: todayCalls.length,
                        totalCallsWeekly: weeklyCalls.length,
                        totalCallsMonthly: monthlyCalls.length,
                        totalHoursToday: parseFloat(totalHoursToday.toFixed(2)),
                        totalHoursWeekly: parseFloat(totalHoursWeekly.toFixed(2)),
                        totalHoursMonthly: parseFloat(totalHoursMonthly.toFixed(2)),
                        vehicleCallStats,
                        callTypeStats,
                        users: users || []
                    }
                })
            };
        }

        // GET /api/admin/users
        if (event.httpMethod === 'GET' && path === '/users') {
            const { data: users, error } = await supabase
                .from('users')
                .select('id, email, full_name, mda_code, role, created_at')
                .order('created_at', { ascending: false });

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בטעינת משתמשים' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, users: users || [] })
            };
        }

        // DELETE /api/admin/users/:id
        if (event.httpMethod === 'DELETE' && path.startsWith('/users/')) {
            const userIdToDelete = path.replace('/users/', '');

            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', userIdToDelete);

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה במחיקת משתמש' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'משתמש נמחק בהצלחה' })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, message: 'Not found' })
        };

    } catch (error) {
        console.error('Admin error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'שגיאת שרת' })
        };
    }
};
