require('dotenv').config();

// Fix SSL certificate issues for local development only
const isLocalDevelopment = !process.env.RENDER && (
    process.env.NODE_ENV === 'development' ||
    process.env.PORT === '3000' ||
    process.platform === 'win32'
);

if (isLocalDevelopment) {
    console.log('🔧 Local development detected: Applying SSL certificate fix...');
    console.log('⚠️  Note: This SSL bypass is for local development only');
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
} else {
    console.log('🚀 Production environment: Using secure SSL connections');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to convert English call types to Hebrew for backward compatibility
function normalizeCallType(callType) {
    const callTypeMap = {
        'urgent': 'דחוף',
        'atan': 'אט"ן', 
        'aran': 'ארן',
        'natbag': 'נתבג',
        // Already Hebrew - return as is
        'דחוף': 'דחוף',
        'אט"ן': 'אט"ן',
        'אט״ן': 'אט"ן', // Handle different quote marks
        'ארן': 'ארן',
        'נתבג': 'נתבג'
    };
    
    return callTypeMap[callType] || callType;
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://*.supabase.co", "https://fonts.googleapis.com", "https://fonts.gstatic.com"]
        }
    }
}));

// General middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// Get all calls for today
app.get('/api/calls', async (req, res) => {
    try {
        const { date, call_type, vehicle_type, vehicle_number } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        let query = supabase
            .from('calls')
            .select('*')
            .order('created_at', { ascending: false });
        
        // Apply filters only if provided
        if (date) {
            query = query.gte('call_date', targetDate)
                        .lt('call_date', new Date(new Date(targetDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
        }
        if (call_type) {
            query = query.eq('call_type', call_type);
        }
        if (vehicle_type) {
            query = query.eq('vehicle_type', vehicle_type);
        }
        if (vehicle_number) {
            query = query.eq('vehicle_number', vehicle_number);
        }
        
        const { data, error } = await query;

        if (error) {
            console.error('Supabase error:', error);
            return res.status(400).json({ 
                success: false, 
                message: 'שגיאה בטעינת הנתונים',
                error: error.message 
            });
        }

        res.json({ 
            success: true, 
            data: data || [],
            count: data ? data.length : 0
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'שגיאת שרת פנימית',
            error: error.message 
        });
    }
});

// Get historical calls (by year and optional month)
app.get('/api/calls/historical', async (req, res) => {
    try {
        const { year, month } = req.query;
        
        if (!year) {
            return res.status(400).json({
                success: false,
                message: 'יש לספק שנה'
            });
        }

        // Build date range
        let startDate, endDate;
        
        if (month) {
            // Specific month
            startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            endDate = new Date(parseInt(year), parseInt(month), 1);
        } else {
            // Entire year
            startDate = new Date(parseInt(year), 0, 1);
            endDate = new Date(parseInt(year) + 1, 0, 1);
        }

        // Get calls data
        const { data: calls, error: callsError } = await supabase
            .from('calls')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lt('created_at', endDate.toISOString())
            .order('created_at', { ascending: false });

        if (callsError) {
            console.error('Supabase error:', callsError);
            return res.status(400).json({
                success: false,
                message: 'שגיאה בטעינת הנתונים',
                error: callsError.message
            });
        }

        // Calculate statistics (handle both Hebrew and English call types)
        const stats = {
            totalCalls: calls.length,
            urgentCalls: calls.filter(call => 
                call.call_type === 'דחוף' || call.call_type === 'urgent'
            ).length,
            atanCalls: calls.filter(call => 
                call.call_type === 'אט"ן' || call.call_type === 'אט״ן' || call.call_type === 'atan'
            ).length,
            aranCalls: calls.filter(call => 
                call.call_type === 'ארן' || call.call_type === 'aran'
            ).length,
            natbagCalls: calls.filter(call => 
                call.call_type === 'נתבג' || call.call_type === 'natbag'
            ).length
        };

        res.json({
            success: true,
            calls: calls || [],
            stats,
            period: {
                year: parseInt(year),
                month: month ? parseInt(month) : null
            }
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאת שרת פנימית',
            error: error.message
        });
    }
});

// Create a new call
app.post('/api/calls', async (req, res) => {
    try {
        const {
            call_type,
            call_date,
            start_time,
            end_time,
            location,
            description,
            vehicle_number,
            vehicle_type
        } = req.body;

        // Validation
        if (!call_type || !call_date || !start_time || !location) {
            return res.status(400).json({
                success: false,
                message: 'נתונים חסרים: סוג קריאה, תאריך, שעת התחלה ומיקום הם שדות חובה'
            });
        }

        // Calculate duration if end_time is provided
        let duration_minutes = null;
        if (end_time && start_time) {
            const start = new Date(`1970-01-01T${start_time}:00`);
            const end = new Date(`1970-01-01T${end_time}:00`);
            duration_minutes = Math.round((end - start) / (1000 * 60));
        }

        const callData = {
            call_type: normalizeCallType(call_type),
            call_date,
            start_time,
            end_time: end_time || null,
            location,
            description: description || null,
            duration_minutes,
            vehicle_number: vehicle_number || process.env.MOTORCYCLE_NUMBER || '5248',
            vehicle_type: vehicle_type || 'motorcycle',
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('calls')
            .insert([callData])
            .select()
            .single();

        if (error) {
            console.error('Supabase error:', error);
            return res.status(400).json({
                success: false,
                message: 'שגיאה ברישום הקריאה',
                error: error.message
            });
        }

        res.status(201).json({
            success: true,
            message: 'קריאה נרשמה בהצלחה',
            data
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאת שרת פנימית',
            error: error.message
        });
    }
});

// Update call (mark as completed)
app.put('/api/calls/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { call_type, call_date, start_time, end_time, location, description } = req.body;

        // Get the current call to calculate duration
        const { data: currentCall } = await supabase
            .from('calls')
            .select('start_time')
            .eq('id', id)
            .single();

        if (!currentCall) {
            return res.status(404).json({
                success: false,
                message: 'קריאה לא נמצאה'
            });
        }

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (call_type !== undefined) updateData.call_type = normalizeCallType(call_type);
        if (call_date !== undefined) updateData.call_date = call_date;
        if (start_time !== undefined) updateData.start_time = start_time;
        if (end_time !== undefined) {
            updateData.end_time = end_time;
            // Recalculate duration if we have both times
            if (start_time || currentCall.start_time) {
                const startTimeToUse = start_time || currentCall.start_time;
                const start = new Date(`1970-01-01T${startTimeToUse}:00`);
                const end = new Date(`1970-01-01T${end_time}:00`);
                updateData.duration_minutes = Math.round((end - start) / (1000 * 60));
            }
        }
        if (location !== undefined) updateData.location = location;
        if (description !== undefined) updateData.description = description;

        const { data, error } = await supabase
            .from('calls')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Supabase error:', error);
            return res.status(400).json({
                success: false,
                message: 'שגיאה בעדכון הקריאה',
                error: error.message
            });
        }

        res.json({
            success: true,
            message: 'קריאה עודכנה בהצלחה',
            data
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאת שרת פנימית',
            error: error.message
        });
    }
});

// Delete call
app.delete('/api/calls/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('calls')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Supabase error:', error);
            return res.status(400).json({
                success: false,
                message: 'שגיאה במחיקת הקריאה',
                error: error.message
            });
        }

        res.json({
            success: true,
            message: 'קריאה נמחקה בהצלחה'
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאת שרת פנימית',
            error: error.message
        });
    }
});

// Get current vehicle settings
app.get('/api/vehicle/current', async (req, res) => {
    try {
        const { data, error } = await supabase.rpc('get_current_vehicle');

        if (error) {
            console.error('Supabase error:', error);
            return res.status(400).json({
                success: false,
                message: 'שגיאה בטעינת הגדרות הרכב',
                error: error.message
            });
        }

        // If no current vehicle set, return default
        const currentVehicle = data && data.length > 0 ? data[0] : {
            vehicle_number: '5248',
            vehicle_type: 'motorcycle',
            driver_name: 'סהר מלול'
        };

        res.json({
            success: true,
            data: currentVehicle
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאת שרת פנימית',
            error: error.message
        });
    }
});

// Update current vehicle settings
app.post('/api/vehicle/current', async (req, res) => {
    try {
        const { vehicle_number, vehicle_type } = req.body;

        if (!vehicle_number || !vehicle_type) {
            return res.status(400).json({
                success: false,
                message: 'מספר רכב וסוג רכב נדרשים'
            });
        }

        const { data, error } = await supabase.rpc('set_current_vehicle', {
            new_vehicle_number: vehicle_number,
            new_vehicle_type: vehicle_type
        });

        if (error) {
            console.error('Supabase error:', error);
            return res.status(400).json({
                success: false,
                message: 'שגיאה בעדכון הגדרות הרכב',
                error: error.message
            });
        }

        res.json({
            success: true,
            message: 'הגדרות הרכב עודכנו בהצלחה',
            data: { vehicle_number, vehicle_type }
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאת שרת פנימית',
            error: error.message
        });
    }
});
app.delete('/api/calls/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('calls')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Supabase error:', error);
            return res.status(400).json({
                success: false,
                message: 'שגיאה במחיקת הקריאה',
                error: error.message
            });
        }

        res.json({
            success: true,
            message: 'קריאה נמחקה בהצלחה'
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאת שרת פנימית',
            error: error.message
        });
    }
});

// Get statistics  
app.get('/api/stats', async (req, res) => {
    try {
        // Get current date in local timezone (where the server is running)
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Alternative approach: Get calls from today based on call_date field if it exists, 
        // otherwise use created_at timestamp
        let todayCalls = [];
        
        // First try using call_date field
        const { data: callsByDate, error: dateError } = await supabase
            .from('calls')
            .select('*')
            .eq('call_date', today);
        
        if (!dateError && callsByDate) {
            todayCalls = callsByDate;
            if (isLocalDevelopment) {
                console.log(`📅 Found ${callsByDate.length} calls using call_date field for ${today}`);
            }
        } else {
            // Fallback to created_at timestamp filtering
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            
            const { data: callsByTime, error: timeError } = await supabase
                .from('calls')
                .select('*')
                .gte('created_at', startOfDay.toISOString())
                .lte('created_at', endOfDay.toISOString());
                
            todayCalls = callsByTime || [];
            console.log(`⏰ Found ${todayCalls.length} calls using created_at timestamp for today`);
            
            if (timeError) {
                console.error('Time-based query error:', timeError);
            }
        }
        
        // Also get all calls to verify what's in the database
        const { data: allCalls, error: allError } = await supabase
            .from('calls')
            .select('id, call_type, call_date, created_at')
            .order('created_at', { ascending: false })
            .limit(10);
            
        console.log('🔍 Recent calls in database:', allCalls?.map(call => ({
            id: call.id,
            type: call.call_type,
            call_date: call.call_date,
            created_at: call.created_at
        })));
        
        // Get weekly and monthly stats
        const { data: weeklyData, error: weeklyError } = await supabase.rpc('get_weekly_stats');
        const { data: monthlyData, error: monthlyError } = await supabase.rpc('get_monthly_stats');

        // Calculate today's stats
        const todayStats = {
            total_calls: todayCalls.length,
            total_hours: Math.round(todayCalls.length * 0.5 * 10) / 10
        };

        // Extract weekly and monthly stats
        const weeklyStats = weeklyData && weeklyData.length > 0 ? weeklyData[0] : { total_calls: 0, total_hours: 0 };
        const monthlyStats = monthlyData && monthlyData.length > 0 ? monthlyData[0] : { total_calls: 0, total_hours: 0 };

        console.log(`� Final today's stats: ${todayStats.total_calls} calls`);

        res.json({
            success: true,
            data: {
                totalCalls: parseInt(todayStats.total_calls || 0),
                weeklyCalls: parseInt(weeklyStats.total_calls || 0),
                monthlyCalls: parseInt(monthlyStats.total_calls || 0),
                weeklyHours: parseFloat(weeklyStats.total_hours || 0),
                monthlyHours: parseFloat(monthlyStats.total_hours || 0),
                currentDate: today,
                debug: {
                    todayCallsFound: todayCalls.length,
                    currentTime: now.toISOString(),
                    recentCalls: allCalls?.slice(0, 3)
                }
            }
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאת שרת פנימית',
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        motorcycle: process.env.MOTORCYCLE_NUMBER || '5248'
    });
});

// Catch all other routes and serve index.html (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'שגיאת שרת פנימית',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🏍️  MDA CallCounter Server running on port ${PORT}`);
    console.log(`🚑  Motorcycle: ${process.env.MOTORCYCLE_NUMBER || '5248'}`);
    console.log(`🗄️  Database: ${supabaseUrl ? 'Connected' : 'Not configured'}`);
    console.log(`🌍  Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;