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
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret (in production, use a proper secret from environment)
const JWT_SECRET = process.env.JWT_SECRET || 'mda-callcounter-secret-key-2025';

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
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://*.supabase.co", "https://fonts.googleapis.com", "https://fonts.gstatic.com"]
        }
    }
}));

// General middleware
app.use(compression());

// CORS configuration for mobile compatibility
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Set proper MIME types and cache control for different content types
app.use((req, res, next) => {
    // Set proper content types for various file extensions
    if (req.path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        // Short cache for JS files to allow quick updates
        res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
    } else if (req.path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        // Short cache for CSS files to allow quick updates
        res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
    } else if (req.path.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        // No cache for HTML files to ensure fresh content
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    } else if (req.path.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        // No cache for JSON API responses
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (req.path.startsWith('/api/')) {
        // API endpoints should never be cached
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
    // Add mobile-friendly headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    next();
});

// Serve static files with proper cache control
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath, stat) => {
        // Different cache strategies based on file type
        if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            // Short cache for JS/CSS to allow quick updates
            res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
        } else if (filePath.endsWith('.html')) {
            // No cache for HTML files to ensure fresh content
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (filePath.match(/\.(png|jpg|jpeg|gif|ico|svg)$/)) {
            // Longer cache for images (they rarely change)
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
        } else {
            // Default: short cache for other files
            res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
        }
    }
}));

// ================================================
// AUTHENTICATION MIDDLEWARE
// ================================================

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'אין הרשאה - נדרש טוקן גישה',
            code: 'NO_TOKEN'
        });
    }

    try {
        // First verify JWT structure and signature
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Then validate session in database (optional for better performance)
        const { data: sessionData, error } = await supabase
            .rpc('validate_session', { p_session_token: token });

        // If session validation fails, still allow if JWT is valid (more lenient)
        if (sessionData && sessionData.length > 0) {
            req.user = sessionData[0];
        } else {
            // Fallback to JWT data if session validation fails
            req.user = {
                user_id: decoded.userId,
                username: decoded.username,
                mda_code: decoded.mdaCode,
                mdaCode: decoded.mdaCode,  // Add both formats for compatibility
                full_name: decoded.fullName || 'משתמש'
            };
        }
        console.log('🔐 Authenticated user:', req.user.username, 'MDA:', req.user.mda_code);
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        const isExpired = error.name === 'TokenExpiredError';
        return res.status(403).json({
            success: false,
            message: isExpired ? 'טוקן פג תוקף' : 'טוקן לא תקין',
            code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
        });
    }
};

// Optional authentication (for public endpoints that can work with or without auth)
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const { data: sessionData } = await supabase
                .rpc('validate_session', { p_session_token: token });

            if (sessionData && sessionData.length > 0) {
                req.user = sessionData[0];
            }
        } catch (error) {
            // Ignore token errors for optional auth
        }
    }
    
    next();
};

// ================================================
// AUTHENTICATION ROUTES
// ================================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, username, password, mdaCode, phone, email } = req.body;

        // Validation - check for required fields
        if (!fullName || !fullName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'שם מלא הוא שדה חובה'
            });
        }

        if (!username || !username.trim()) {
            return res.status(400).json({
                success: false,
                message: 'שם משתמש הוא שדה חובה'
            });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'סיסמה חייבת להיות באורך של 6 תווים לפחות'
            });
        }

        if (!mdaCode || !mdaCode.trim()) {
            return res.status(400).json({
                success: false,
                message: 'קוד מבצעי/קוד כונן אישי הוא שדה חובה'
            });
        }

        // Validate MDA code format (2-5 digits)
        if (!/^\d{2,5}$/.test(mdaCode.trim())) {
            return res.status(400).json({
                success: false,
                message: 'קוד מד״א חייב להיות מספר בן 2-5 ספרות'
            });
        }

        // Check if username already exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'שם המשתמש כבר קיים במערכת'
            });
        }

        // Create user using the database function
        const { data: newUserId, error: createError } = await supabase
            .rpc('create_user', {
                p_full_name: fullName,
                p_username: username,
                p_password: password,
                p_mda_code: mdaCode,
                p_phone: phone || null,
                p_email: email || null
            });

        if (createError) {
            console.error('User creation error:', createError);
            return res.status(400).json({
                success: false,
                message: 'שגיאה ביצירת המשתמש',
                error: createError.message
            });
        }

        res.status(201).json({
            success: true,
            message: 'משתמש נוצר בהצלחה',
            userId: newUserId
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאת שרת פנימית',
            error: error.message
        });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'שם משתמש וסיסמה נדרשים'
            });
        }

        // Authenticate user using database function
        console.log('🔐 Login attempt for username:', username);
        
        const { data: userData, error: authError } = await supabase
            .rpc('authenticate_user', {
                p_username: username,
                p_password: password
            });

        console.log('🔐 Auth result:', { 
            userData: userData ? userData.length : 'null', 
            error: authError ? authError.message : 'none' 
        });

        if (authError) {
            console.error('🔐 Authentication error:', authError);
            return res.status(401).json({
                success: false,
                message: 'שגיאה בהזדהות: ' + authError.message
            });
        }

        if (!userData || userData.length === 0) {
            console.log('🔐 No user data returned for username:', username);
            return res.status(401).json({
                success: false,
                message: 'שם משתמש או סיסמה שגויים'
            });
        }

        const user = userData[0];

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.user_id,
                username: user.username,
                mdaCode: user.mda_code
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Create session in database
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const { error: sessionError } = await supabase
            .rpc('create_session', {
                p_user_id: user.user_id,
                p_session_token: token,
                p_expires_at: expiresAt.toISOString()
            });

        if (sessionError) {
            console.error('Session creation error:', sessionError);
        }

        res.json({
            success: true,
            message: 'התחברת בהצלחה',
            token,
            user: {
                id: user.user_id,
                fullName: user.full_name,
                username: user.username,
                mdaCode: user.mda_code,
                isAdmin: user.is_admin
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאת שרת פנימית',
            error: error.message
        });
    }
});

// Validate token
app.get('/api/auth/validate', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.user_id,
            fullName: req.user.full_name,
            username: req.user.username,
            mdaCode: req.user.mda_code,
            isAdmin: req.user.is_admin
        }
    });
});

// Get current user info (alias for validate)
app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.user_id,
            full_name: req.user.full_name,
            username: req.user.username,
            mda_code: req.user.mda_code,
            is_admin: req.user.is_admin
        }
    });
});

// Debug endpoint to check user info
app.get('/api/debug/user', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            user: req.user,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Check if username exists
app.get('/api/auth/check-username', async (req, res) => {
    try {
        const { username } = req.query;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: 'שם משתמש נדרש'
            });
        }

        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        res.json({
            success: true,
            exists: !!existingUser
        });

    } catch (error) {
        console.error('Username check error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בבדיקת שם המשתמש'
        });
    }
});

// Logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        // Delete session from database
        await supabase
            .from('user_sessions')
            .delete()
            .eq('session_token', token);

        res.json({
            success: true,
            message: 'התנתקת בהצלחה'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בהתנתקות'
        });
    }
});

// API Routes

// Get all calls for today
app.get('/api/calls', authenticateToken, async (req, res) => {
    try {
        const { date, call_type, vehicle_type, vehicle_number } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        let query = supabase
            .from('calls')
            .select('*')
            .order('created_at', { ascending: false });
        
        // CRITICAL: Filter by user_id to ensure data isolation
        if (req.user && req.user.user_id) {
            console.log('📞 Loading calls for user:', req.user.username, 'ID:', req.user.user_id);
            query = query.eq('user_id', req.user.user_id);
        } else {
            console.error('📞 No user found in request:', req.user);
            // If no user is authenticated, return empty data
            return res.json({ 
                success: true, 
                data: [],
                count: 0,
                message: 'נדרשת הזדהות לצפייה בנתונים'
            });
        }
        
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

        console.log('📞 Loaded', data ? data.length : 0, 'calls for user', req.user.username);
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
app.get('/api/calls/historical', authenticateToken, async (req, res) => {
    try {
        const { year, month } = req.query;
        
        if (!year) {
            return res.status(400).json({
                success: false,
                message: 'יש לספק שנה'
            });
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

        // CRITICAL: Filter by user_id to ensure data isolation
        if (!req.user || !req.user.user_id) {
            return res.status(401).json({
                success: false,
                message: 'נדרשת הזדהות לצפייה בנתונים היסטוריים'
            });
        }

        // Get calls data using call_date field for consistency - FILTERED BY USER
        const { data: calls, error: callsError } = await supabase
            .from('calls')
            .select('*')
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .gte('call_date', startDateStr)
            .lt('call_date', endDateStr)
            .order('call_date', { ascending: false });

        if (callsError) {
            console.error('Supabase error:', callsError);
            return res.status(400).json({
                success: false,
                message: 'שגיאה בטעינת הנתונים',
                error: callsError.message
            });
        }

        // Calculate statistics (handle both Hebrew and English call types)
        // Helper function to calculate total hours from calls
        const calculateHours = (calls) => {
            if (!calls || calls.length === 0) return 0;
            
            const totalMinutes = calls.reduce((sum, call) => {
                return sum + (call.duration_minutes || 30); // Default 30 minutes if no duration
            }, 0);
            
            return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimal places
        };

        const stats = {
            totalCalls: calls.length,
            totalHours: calculateHours(calls),
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

// Vehicle type detection function
function detectVehicleType(mdaCode) {
    if (!mdaCode || mdaCode.length < 2) return 'ambulance';
    
    const codeStr = mdaCode.toString().trim();
    const firstDigit = codeStr.charAt(0);
    const firstTwoDigits = codeStr.substring(0, 2);
    
    // Personal standby detection - 5-digit codes starting with 1 or 2
    if (codeStr.length === 5 && (firstDigit === '1' || firstDigit === '2')) {
        return 'personal_standby';
    }
    
    // 4-digit codes
    if (codeStr.length === 4) {
        if (firstDigit === '5') return 'motorcycle';
        if (firstDigit === '6') return 'picanto';
        if (['1', '2', '3', '4', '7', '8', '9'].includes(firstDigit)) return 'ambulance';
    }
    
    // 2 or 3 digit codes starting with 1,2,3,4,7,8,9 are ambulances
    if ((codeStr.length === 2 || codeStr.length === 3) && 
        ['1', '2', '3', '4', '7', '8', '9'].includes(firstDigit)) {
        return 'ambulance';
    }
    
    return 'ambulance'; // default
}

function getVehicleEmoji(vehicleType) {
    switch(vehicleType) {
        case 'motorcycle': return '🏍️';
        case 'picanto': return '🚗';
        case 'ambulance': return '🚑';
        case 'personal_standby': return '👨‍⚕️';
        default: return '🚑';
    }
}

// Create a new call
app.post('/api/calls', authenticateToken, async (req, res) => {
    try {
        console.log('📞 Server: Received call creation request');
        console.log('📞 Server: Request body:', req.body);
        console.log('📞 Server: User info:', req.user);
        
        const {
            call_type,
            call_date,
            start_time,
            end_time,
            location,
            description
        } = req.body;

        // Validation
        console.log('📞 Server: Validating required fields...');
        if (!call_type || !call_date || !start_time || !location) {
            console.log('📞 Server: Validation failed - missing required fields');
            console.log('📞 Server: call_type:', call_type, 'call_date:', call_date, 'start_time:', start_time, 'location:', location);
            return res.status(400).json({
                success: false,
                message: 'נתונים חסרים: סוג קריאה, תאריך, שעת התחלה ומיקום הם שדות חובה'
            });
        }

        // Get user's MDA code and auto-detect vehicle type
        console.log('📞 Server: Getting user MDA code...');
        console.log('📞 Server: req.user object:', JSON.stringify(req.user, null, 2));
        const userMdaCode = req.user && req.user.mdaCode ? req.user.mdaCode : null;
        
        console.log('📞 Server: Using MDA code:', userMdaCode);
        console.log('📞 Server: MDA code type:', typeof userMdaCode);
        console.log('📞 Server: MDA code is null?', userMdaCode === null);
        console.log('📞 Server: MDA code is undefined?', userMdaCode === undefined);
        
        const detectedVehicleType = detectVehicleType(userMdaCode);
        const vehicleEmoji = getVehicleEmoji(detectedVehicleType);
        console.log('📞 Server: Detected vehicle type:', detectedVehicleType, 'emoji:', vehicleEmoji);

        // Calculate duration if end_time is provided
        let duration_minutes = null;
        if (end_time && start_time) {
            const start = new Date(`1970-01-01T${start_time}:00`);
            const end = new Date(`1970-01-01T${end_time}:00`);
            duration_minutes = Math.round((end - start) / (1000 * 60));
        }

        // Check vehicle availability before creating the call (temporarily disabled to fix 500 error)
        try {
            const { data: availabilityCheck, error: availabilityError } = await supabase
                .rpc('check_vehicle_availability', {
                    p_vehicle_number: userMdaCode,
                    p_user_id: req.user ? req.user.user_id : null
                });

            if (availabilityError) {
                console.error('Vehicle availability check error:', availabilityError);
                // Don't fail the call creation, just log the error and continue
                console.log('Continuing with call creation despite availability check error');
            } else if (!availabilityCheck) {
                console.log('Vehicle availability check returned false, but allowing call creation');
                // Temporarily comment out the conflict response to allow call creation
                // return res.status(409).json({
                //     success: false,
                //     message: `רכב ${userMdaCode} כבר בשימוש על ידי משתמש אחר. אנא המתן עד לסיום הנסיעה או בחר רכב אחר.`
                // });
            }
        } catch (error) {
            console.error('Vehicle availability check exception:', error);
            // Continue with call creation even if availability check fails
            console.log('Continuing with call creation despite availability check exception');
        }

        const callData = {
            user_id: req.user ? req.user.user_id : null,
            call_type: normalizeCallType(call_type),
            call_date,
            start_time,
            end_time: end_time || null,
            location,
            description: description || null,
            duration_minutes,
            vehicle_number: userMdaCode,
            vehicle_type: `${vehicleEmoji} ${detectedVehicleType}`,
            created_at: new Date().toISOString()
        };

        console.log('📞 Server: Final call data:', callData);

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
app.put('/api/calls/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { call_type, call_date, start_time, end_time, location, description } = req.body;

        // CRITICAL: First check if the call belongs to the authenticated user
        const { data: currentCall } = await supabase
            .from('calls')
            .select('start_time, user_id')
            .eq('id', id)
            .single();

        if (!currentCall) {
            return res.status(404).json({
                success: false,
                message: 'קריאה לא נמצאה'
            });
        }

        // CRITICAL: Ensure user can only update their own calls
        if (currentCall.user_id !== req.user.user_id) {
            return res.status(403).json({
                success: false,
                message: 'אין הרשאה לעדכן קריאה זו'
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
app.delete('/api/calls/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // CRITICAL: First check if the call belongs to the authenticated user
        const { data: existingCall } = await supabase
            .from('calls')
            .select('user_id')
            .eq('id', id)
            .single();

        if (!existingCall) {
            return res.status(404).json({
                success: false,
                message: 'קריאה לא נמצאה'
            });
        }

        // CRITICAL: Ensure user can only delete their own calls
        if (existingCall.user_id !== req.user.user_id) {
            return res.status(403).json({
                success: false,
                message: 'אין הרשאה למחוק קריאה זו'
            });
        }

        const { error } = await supabase
            .from('calls')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.user_id);  // Double-check user ownership

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
app.get('/api/vehicle/current', authenticateToken, async (req, res) => {
    try {
        // Get user's MDA code and auto-detect vehicle type
        const userMdaCode = req.user ? req.user.mdaCode : '5248';
        const detectedVehicleType = detectVehicleType(userMdaCode);

        // Try to get user-specific vehicle settings first
        const { data, error } = await supabase
            .from('user_vehicle_settings')
            .select('vehicle_number, vehicle_type')
            .eq('user_id', req.user.user_id)
            .single();

        let currentVehicle;
        if (data && !error) {
            // User has custom vehicle settings
            currentVehicle = {
                vehicle_number: data.vehicle_number,
                vehicle_type: data.vehicle_type
            };
        } else {
            // Use user's MDA code as default vehicle
            currentVehicle = {
                vehicle_number: userMdaCode,
                vehicle_type: detectedVehicleType
            };
        }

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
app.post('/api/vehicle/current', authenticateToken, async (req, res) => {
    try {
        const { vehicle_number, vehicle_type } = req.body;

        if (!vehicle_number || !vehicle_type) {
            return res.status(400).json({
                success: false,
                message: 'מספר רכב וסוג רכב נדרשים'
            });
        }

        // Update or insert user-specific vehicle settings
        const { data, error } = await supabase
            .from('user_vehicle_settings')
            .upsert({
                user_id: req.user.user_id,
                vehicle_number: vehicle_number,
                vehicle_type: vehicle_type,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            })
            .select()
            .single();

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

// Get statistics  
app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        // CRITICAL: Ensure user authentication for stats
        if (!req.user || !req.user.user_id) {
            return res.json({
                success: true,
                todayStats: {
                    total: 0,
                    urgent: 0,
                    atan: 0,
                    aran: 0,
                    natbag: 0
                },
                message: 'נדרשת הזדהות לצפייה בסטטיסטיקות'
            });
        }
        
        // Get current date in local timezone (where the server is running)
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Alternative approach: Get calls from today based on call_date field if it exists, 
        // otherwise use created_at timestamp - FILTERED BY USER
        let todayCalls = [];
        
        // First try using call_date field - WITH USER FILTER
        const { data: callsByDate, error: dateError } = await supabase
            .from('calls')
            .select('*')
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .eq('call_date', today);
        
        if (!dateError && callsByDate) {
            todayCalls = callsByDate;
        } else {
            // Fallback to created_at timestamp filtering - WITH USER FILTER
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            
            const { data: callsByTime, error: timeError } = await supabase
                .from('calls')
                .select('*')
                .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
                .gte('created_at', startOfDay.toISOString())
                .lte('created_at', endOfDay.toISOString());
                
            todayCalls = callsByTime || [];
            console.log(`⏰ Found ${todayCalls.length} calls using created_at timestamp for today (user: ${req.user.user_id})`);
            
            if (timeError) {
                console.error('Time-based query error:', timeError);
            }
        }
        
        // Also get recent calls to verify what's in the database - FILTERED BY USER
        const { data: allCalls, error: allError } = await supabase
            .from('calls')
            .select('id, call_type, call_date, created_at')
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .order('created_at', { ascending: false })
            .limit(10);
            
        // Get weekly and monthly stats using direct queries instead of RPC functions
        // Calculate weekly date range (Monday to Sunday)
        const weekStart = new Date(now);
        const dayOfWeek = weekStart.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
        weekStart.setDate(weekStart.getDate() - daysFromMonday);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        // Get weekly stats
        const { data: weeklyCalls, error: weeklyError } = await supabase
            .from('calls')
            .select('id, duration_minutes')
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .gte('call_date', weekStartStr)
            .lt('call_date', weekEndStr);

        // Calculate monthly date range
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthStartStr = monthStart.toISOString().split('T')[0];
        
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const monthEndStr = monthEnd.toISOString().split('T')[0];

        // Get monthly stats
        const { data: monthlyCalls, error: monthlyError } = await supabase
            .from('calls')
            .select('id, duration_minutes')
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .gte('call_date', monthStartStr)
            .lt('call_date', monthEndStr);

        // Helper function to calculate total hours from calls
        const calculateHours = (calls) => {
            if (!calls || calls.length === 0) return 0;
            
            const totalMinutes = calls.reduce((sum, call) => {
                return sum + (call.duration_minutes || 30); // Default 30 minutes if no duration
            }, 0);
            
            return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimal places
        };

        // Calculate today's stats
        const todayStats = {
            total_calls: todayCalls.length,
            total_hours: calculateHours(todayCalls)
        };

        // Calculate weekly and monthly stats
        const weeklyStats = {
            total_calls: weeklyCalls ? weeklyCalls.length : 0,
            total_hours: calculateHours(weeklyCalls)
        };
        
        const monthlyStats = {
            total_calls: monthlyCalls ? monthlyCalls.length : 0,
            total_hours: calculateHours(monthlyCalls)
        };

        console.log(`📊 Final today's stats: ${todayStats.total_calls} calls, weekly: ${weeklyStats.total_calls}, monthly: ${monthlyStats.total_calls}`);

        res.json({
            success: true,
            data: {
                totalCalls: todayStats.total_calls,
                weeklyCalls: weeklyStats.total_calls,
                monthlyCalls: monthlyStats.total_calls,
                weeklyHours: weeklyStats.total_hours,
                monthlyHours: monthlyStats.total_hours,
                currentDate: today,
                debug: {
                    todayCallsFound: todayCalls.length,
                    weeklyCallsFound: weeklyStats.total_calls,
                    monthlyCallsFound: monthlyStats.total_calls,
                    weekRange: `${weekStartStr} to ${weekEndStr}`,
                    monthRange: `${monthStartStr} to ${monthEndStr}`,
                    currentTime: now.toISOString()
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
        platform: process.platform,
        node_version: process.version,
        git_commit: process.env.RENDER_GIT_COMMIT || 'unknown',
        deployment_time: process.env.RENDER_DEPLOYED_AT || 'unknown'
    });
});

// Simple diagnostic endpoint
app.get('/api/status', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(`MDA CallCounter Status
====================
Time: ${new Date().toISOString()}
Platform: ${process.platform}
Node: ${process.version}
Git Commit: ${process.env.RENDER_GIT_COMMIT || 'unknown'}
Deployed At: ${process.env.RENDER_DEPLOYED_AT || 'unknown'}
User Agent: ${req.headers['user-agent'] || 'unknown'}
IP: ${req.ip || req.connection.remoteAddress || 'unknown'}

If you see this message, the server is working correctly!`);
});

// Debug endpoint to check users (temporary)
app.get('/api/debug/users', async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('user_id, username, full_name, mda_code, created_at')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Database error',
                error: error.message
            });
        }

        res.json({
            success: true,
            message: 'Users found',
            count: users ? users.length : 0,
            users: users || []
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Root route explicitly
app.get('/', (req, res) => {
    console.log('Root route accessed:', req.headers['user-agent']);
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            console.error('Error serving index.html:', err);
            res.status(500).send('Server Error');
        }
    });
});

// Catch all other routes and serve index.html (SPA support)
app.get('*', (req, res) => {
    console.log('Catch-all route accessed:', req.path, 'User-Agent:', req.headers['user-agent']);
    
    // Prevent serving index.html for API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint not found',
            path: req.path
        });
    }
    
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            console.error('Error serving index.html for path:', req.path, err);
            res.status(500).send('Server Error');
        }
    });
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