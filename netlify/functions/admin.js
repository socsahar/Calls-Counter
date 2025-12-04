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
    if (!authResult.user.is_admin) {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ success: false, message: 'גישה נדחתה - נדרשות הרשאות מנהל' })
        };
    }

    const path = event.path.replace('/.netlify/functions/admin', '').replace('/api/admin', '');
    console.log('🔧 Admin function - Path:', event.path, 'Parsed:', path);

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
                .select('user_id, full_name, mda_code, email, username, is_admin, created_at');

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
                .select('user_id, email, full_name, mda_code, username, is_admin, created_at')
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

        // GET /api/admin/calls
        if (event.httpMethod === 'GET' && path === '/calls') {
            const queryParams = event.queryStringParameters || {};
            const limit = parseInt(queryParams.limit) || 50;
            const offset = parseInt(queryParams.offset) || 0;
            
            const { data: calls, error } = await supabase
                .from('calls')
                .select(`
                    *,
                    users!inner(username, mda_code)
                `)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            
            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בטעינת כל הקריאות' })
                };
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, calls: calls || [] })
            };
        }

        // GET /api/admin/codes/alert
        if (event.httpMethod === 'GET' && path === '/codes/alert') {
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
                body: JSON.stringify({ success: true, data: codes || [] })
            };
        }

        // GET /api/admin/codes/medical
        if (event.httpMethod === 'GET' && path === '/codes/medical') {
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
                body: JSON.stringify({ success: true, data: codes || [] })
            };
        }

        // GET /api/admin/api-keys
        if (event.httpMethod === 'GET' && path === '/api-keys') {
            const { data, error } = await supabase
                .from('api_keys')
                .select('id, key_name, permissions, is_active, last_used_at, created_at, updated_at')
                .eq('user_id', authResult.user.user_id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching API keys:', error);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בטעינת מפתחות API' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, api_keys: data || [] })
            };
        }

        // POST /api/admin/codes/alert
        if (event.httpMethod === 'POST' && path === '/codes/alert') {
            const { code } = JSON.parse(event.body);
            
            if (!code) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שם הקוד הוא שדה חובה' })
                };
            }
            
            const { data, error } = await supabase
                .from('alert_codes')
                .insert([{ code }])
                .select()
                .single();
            
            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה ביצירת קוד הזנקה' })
                };
            }
            
            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ success: true, message: 'קוד הזנקה נוצר בהצלחה', data })
            };
        }

        // POST /api/admin/codes/medical
        if (event.httpMethod === 'POST' && path === '/codes/medical') {
            const { code } = JSON.parse(event.body);
            
            if (!code) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שם הקוד הוא שדה חובה' })
                };
            }
            
            const { data, error } = await supabase
                .from('medical_codes')
                .insert([{ code }])
                .select()
                .single();
            
            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה ביצירת קוד רפואי' })
                };
            }
            
            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ success: true, message: 'קוד רפואי נוצר בהצלחה', data })
            };
        }

        // DELETE /api/admin/users/:id
        if (event.httpMethod === 'DELETE' && path.startsWith('/users/')) {
            const userIdToDelete = path.replace('/users/', '');

            // First delete user's calls
            const { error: callsError } = await supabase
                .from('calls')
                .delete()
                .eq('user_id', userIdToDelete);
            
            if (callsError) {
                console.error('Error deleting user calls:', callsError);
            }

            // Then delete the user
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('user_id', userIdToDelete);

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

        // DELETE /api/admin/codes/alert/:id
        if (event.httpMethod === 'DELETE' && path.startsWith('/codes/alert/')) {
            const codeId = path.replace('/codes/alert/', '');

            const { error } = await supabase
                .from('alert_codes')
                .delete()
                .eq('id', codeId);

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה במחיקת קוד הזנקה' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'קוד הזנקה נמחק בהצלחה' })
            };
        }

        // DELETE /api/admin/codes/medical/:id
        if (event.httpMethod === 'DELETE' && path.startsWith('/codes/medical/')) {
            const codeId = path.replace('/codes/medical/', '');

            const { error } = await supabase
                .from('medical_codes')
                .delete()
                .eq('id', codeId);

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה במחיקת קוד רפואי' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'קוד רפואי נמחק בהצלחה' })
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
