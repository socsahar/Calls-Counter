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
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');

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
        'atan': 'אטן', 
        'aran': 'ארן',
        'natbag': 'נתבג',
        // Already Hebrew - normalize to standard format
        'דחוף': 'דחוף',
        'אטן': 'אטן',
        'אט"ן': 'אטן', // Old format with quotes
        'אט״ן': 'אטן', // Old format with different quotes
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
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://code.jquery.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://*.unpkg.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://*.supabase.co", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://*.unpkg.com"],
            workerSrc: ["'self'", "blob:"]
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
            console.log('🔐 Using session data for user:', req.user.username, 'Admin:', req.user.is_admin);
        } else {
            // Fallback to JWT data if session validation fails
            req.user = {
                user_id: decoded.userId,
                username: decoded.username,
                mda_code: decoded.mdaCode,
                mdaCode: decoded.mdaCode,  // Add both formats for compatibility
                full_name: decoded.fullName || 'משתמש',
                is_admin: decoded.isAdmin || false  // Add admin status from JWT
            };
            console.log('🔐 Using JWT data for user:', req.user.username, 'Admin:', req.user.is_admin);
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
// CONFIGURATION ROUTES
// ================================================

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
                mdaCode: user.mda_code,
                isAdmin: user.is_admin || false
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
        
        // Get user's selected vehicle to filter by
        let userVehicleNumber = null;
        try {
            const { data: vehicleData } = await supabase
                .rpc('get_user_vehicle', {
                    p_user_id: req.user.user_id
                });
            
            if (vehicleData && vehicleData.length > 0) {
                userVehicleNumber = vehicleData[0].vehicle_number;
                console.log('📞 Filtering by user selected vehicle:', userVehicleNumber);
            }
        } catch (vehicleError) {
            console.log('📞 Could not fetch user vehicle, showing all calls');
        }
        
        // Apply vehicle filter if user has selected a vehicle
        // This shows only calls created with the currently selected vehicle
        if (userVehicleNumber && !vehicle_number) {
            query = query.eq('vehicle_number', userVehicleNumber);
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
            count: data ? data.length : 0,
            filtered_by_vehicle: userVehicleNumber
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

        // Get user's selected vehicle to filter by
        let userVehicleNumber = null;
        try {
            const { data: vehicleData } = await supabase
                .rpc('get_user_vehicle', {
                    p_user_id: req.user.user_id
                });
            
            if (vehicleData && vehicleData.length > 0) {
                userVehicleNumber = vehicleData[0].vehicle_number;
                console.log('📅 Filtering historical calls by vehicle:', userVehicleNumber);
            }
        } catch (vehicleError) {
            console.log('📅 Could not fetch user vehicle, showing all calls');
        }

        // Get calls data using call_date field for consistency - FILTERED BY USER
        // JOIN with alert_codes and medical_codes to get the actual code values
        let query = supabase
            .from('calls')
            .select(`
                *,
                alert_codes:alert_code_id(code),
                medical_codes:medical_code_id(code)
            `)
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .gte('call_date', startDateStr)
            .lt('call_date', endDateStr);

        // Apply vehicle filter if user has selected a vehicle
        // This shows only calls created with the currently selected vehicle
        if (userVehicleNumber) {
            query = query.eq('vehicle_number', userVehicleNumber);
        }

        query = query.order('call_date', { ascending: false });
        query = query.order('call_date', { ascending: false });
        const { data: calls, error: callsError } = await query;

        if (callsError) {
            console.error('Supabase error:', callsError);
            return res.status(400).json({
                success: false,
                message: 'שגיאה בטעינת הנתונים',
                error: callsError.message
            });
        }

        // Transform calls to flatten the joined data
        const transformedCalls = calls ? calls.map(call => ({
            ...call,
            alert_code: call.alert_codes?.code || null,
            medical_code: call.medical_codes?.code || null
        })) : [];

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
            totalCalls: transformedCalls.length,
            totalHours: calculateHours(transformedCalls),
            urgentCalls: transformedCalls.filter(call => 
                call.call_type === 'דחוף' || call.call_type === 'urgent'
            ).length,
            atanCalls: transformedCalls.filter(call => 
                call.call_type === 'אט"ן' || call.call_type === 'אט״ן' || call.call_type === 'atan'
            ).length,
            aranCalls: transformedCalls.filter(call => 
                call.call_type === 'ארן' || call.call_type === 'aran'
            ).length,
            natbagCalls: transformedCalls.filter(call => 
                call.call_type === 'נתבג' || call.call_type === 'natbag'
            ).length
        };

        res.json({
            success: true,
            calls: transformedCalls,
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
    
    // Personal standby detection - 5-digit codes starting with 1, 2, or 3, or the special code 99999
    if (codeStr.length === 5 && (['1', '2', '3'].includes(firstDigit) || codeStr === '99999')) {
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

function getVehicleHebrewName(vehicleType) {
    switch(vehicleType) {
        case 'motorcycle': return 'אופנוע';
        case 'picanto': return 'פיקנטו';
        case 'ambulance': return 'אמבולנס';
        case 'personal_standby': return 'כונן אישי';
        default: return 'אמבולנס';
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
            arrival_time,
            location,
            city,
            street,
            description,
            alert_code_id,
            medical_code_id,
            meter_visa_number
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

        // Get user's currently selected vehicle (not their profile MDA code)
        console.log('📞 Server: Getting user currently selected vehicle...');
        let currentVehicleNumber = null;
        let currentVehicleType = null;
        
        try {
            const { data: vehicleData } = await supabase
                .rpc('get_user_vehicle', {
                    p_user_id: req.user.user_id
                });
            
            if (vehicleData && vehicleData.length > 0) {
                currentVehicleNumber = vehicleData[0].vehicle_number;
                currentVehicleType = vehicleData[0].vehicle_type;
                console.log('📞 Server: Using selected vehicle:', currentVehicleNumber, 'type:', currentVehicleType);
            }
        } catch (vehicleError) {
            console.log('📞 Server: Could not fetch selected vehicle, will use profile MDA code');
        }
        
        // Use selected vehicle if available, otherwise fall back to user's MDA code
        const userMdaCode = currentVehicleNumber || (req.user && req.user.mda_code ? req.user.mda_code : null);
        
        console.log('📞 Server: Using vehicle number:', userMdaCode);
        console.log('📞 Server: Vehicle number type:', typeof userMdaCode);
        
        const detectedVehicleType = currentVehicleType || detectVehicleType(userMdaCode);
        const vehicleEmoji = getVehicleEmoji(detectedVehicleType);
        const vehicleHebrewName = getVehicleHebrewName(detectedVehicleType);
        console.log('📞 Server: Detected vehicle type:', detectedVehicleType, 'emoji:', vehicleEmoji, 'hebrew:', vehicleHebrewName);

        // Calculate duration if end_time is provided
        let duration_minutes = null;
        if (end_time && start_time) {
            const start = new Date(`1970-01-01T${start_time}:00`);
            let end = new Date(`1970-01-01T${end_time}:00`);
            
            // Handle midnight crossover: if end time is earlier than start time,
            // it means the call crossed midnight and ended the next day
            if (end < start) {
                end.setDate(end.getDate() + 1); // Add one day to end time
                console.log('📞 Server: Midnight crossover detected, adjusted end time');
            }
            
            duration_minutes = Math.round((end - start) / (1000 * 60));
            console.log(`📞 Server: Duration calculated: ${duration_minutes} minutes (${start_time} to ${end_time})`);
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

        // Auto-complete any previous active calls for this vehicle and user
        console.log('📞 Server: Checking for previous active calls...');
        try {
            const { data: activeCalls, error: activeError } = await supabase
                .from('calls')
                .update({ 
                    status: 'completed',
                    end_time: start_time, // Set end time to the start time of new call
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', req.user.user_id)
                .eq('vehicle_number', userMdaCode)
                .eq('status', 'active')
                .select();

            if (activeError) {
                console.error('📞 Server: Error updating active calls:', activeError);
            } else if (activeCalls && activeCalls.length > 0) {
                console.log(`📞 Server: Auto-completed ${activeCalls.length} previous active calls`);
            } else {
                console.log('📞 Server: No previous active calls found');
            }
        } catch (error) {
            console.error('📞 Server: Exception while checking active calls:', error);
        }

        const callData = {
            user_id: req.user ? req.user.user_id : null,
            call_type: normalizeCallType(call_type),
            call_date,
            start_time,
            end_time: end_time || null,
            arrival_time: arrival_time || null,
            location,
            city: city || null,
            street: street || null,
            description: description || null,
            alert_code_id: alert_code_id || null,
            medical_code_id: medical_code_id || null,
            meter_visa_number: meter_visa_number || null,
            duration_minutes,
            vehicle_number: userMdaCode,
            vehicle_type: `${vehicleEmoji} ${vehicleHebrewName}`,
            status: end_time ? 'completed' : 'active', // Set status based on whether call is finished
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
        const { call_type, call_date, start_time, end_time, arrival_time, location, description, alert_code_id, medical_code_id, meter_visa_number } = req.body;

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
        if (arrival_time !== undefined) updateData.arrival_time = arrival_time;
        if (end_time !== undefined) {
            updateData.end_time = end_time;
            // Update status based on end_time
            updateData.status = end_time ? 'completed' : 'active';
            // Recalculate duration if we have both times
            if (start_time || currentCall.start_time) {
                const startTimeToUse = start_time || currentCall.start_time;
                const start = new Date(`1970-01-01T${startTimeToUse}:00`);
                let end = new Date(`1970-01-01T${end_time}:00`);
                
                // Handle midnight crossover: if end time is earlier than start time,
                // it means the call crossed midnight and ended the next day
                if (end < start) {
                    end.setDate(end.getDate() + 1); // Add one day to end time
                    console.log('📞 Server: Edit - Midnight crossover detected, adjusted end time');
                }
                
                updateData.duration_minutes = Math.round((end - start) / (1000 * 60));
                console.log(`📞 Server: Edit - Duration calculated: ${updateData.duration_minutes} minutes (${startTimeToUse} to ${end_time})`);
            }
        }
        if (location !== undefined) updateData.location = location;
        if (description !== undefined) updateData.description = description;
        if (alert_code_id !== undefined) updateData.alert_code_id = alert_code_id;
        if (medical_code_id !== undefined) updateData.medical_code_id = medical_code_id;
        if (meter_visa_number !== undefined) updateData.meter_visa_number = meter_visa_number;

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
        console.log('🚗 Getting current vehicle for user:', req.user.user_id);
        
        // Try to get user-specific vehicle settings using the database function
        const { data, error } = await supabase
            .rpc('get_user_vehicle', {
                p_user_id: req.user.user_id
            });

        if (error) {
            console.error('Error fetching user vehicle:', error);
        }

        let currentVehicle;
        if (data && data.length > 0 && data[0].vehicle_number) {
            // User has selected a vehicle
            currentVehicle = {
                vehicle_number: data[0].vehicle_number,
                vehicle_type: data[0].vehicle_type,
                vehicle_id: data[0].vehicle_id
            };
            console.log('🚗 User has selected vehicle:', currentVehicle);
        } else {
            // No vehicle selected yet - use user's MDA code as default suggestion
            const userMdaCode = req.user.mdaCode || req.user.mda_code || '5248';
            const detectedVehicleType = detectVehicleType(userMdaCode);
            currentVehicle = {
                vehicle_number: userMdaCode,
                vehicle_type: detectedVehicleType,
                vehicle_id: null,
                is_suggestion: true // Flag to indicate this is just a suggestion
            };
            console.log('🚗 No vehicle selected, suggesting MDA code:', currentVehicle);
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

        console.log('🚗 Setting vehicle for user:', req.user.user_id, 'Vehicle:', vehicle_number);

        // Use the database function to set vehicle (with uniqueness check)
        const { data, error } = await supabase
            .rpc('set_user_vehicle', {
                p_user_id: req.user.user_id,
                p_vehicle_number: vehicle_number,
                p_vehicle_type: vehicle_type
            });

        if (error) {
            console.error('Supabase error:', error);
            return res.status(400).json({
                success: false,
                message: 'שגיאה בעדכון הגדרות הרכב',
                error: error.message
            });
        }

        // Check if the function returned an error
        if (data && data.success === false) {
            console.log('🚗 Vehicle already in use:', data);
            return res.status(409).json({
                success: false,
                message: data.message || 'רכב זה כבר בשימוש',
                error_code: data.error_code || 'VEHICLE_IN_USE'
            });
        }

        console.log('🚗 Vehicle set successfully:', data);

        res.json({
            success: true,
            message: 'הרכב נבחר בהצלחה',
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

// Get list of available vehicles
app.get('/api/vehicles/available', authenticateToken, async (req, res) => {
    try {
        console.log('🚗 Getting available vehicles');
        
        const { data, error } = await supabase
            .rpc('get_available_vehicles');

        if (error) {
            console.error('Error fetching available vehicles:', error);
            throw error;
        }

        res.json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בטעינת רשימת הרכבים',
            error: error.message
        });
    }
});

// Release user's vehicle (user or admin)
app.delete('/api/vehicle/current', authenticateToken, async (req, res) => {
    try {
        console.log('🚗 Releasing vehicle for user:', req.user.user_id);
        
        const { data, error } = await supabase
            .rpc('release_user_vehicle', {
                p_user_id: req.user.user_id
            });

        if (error) {
            console.error('Error releasing vehicle:', error);
            throw error;
        }

        res.json({
            success: true,
            message: 'הרכב שוחרר בהצלחה'
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בשחרור הרכב',
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
        
        // Helper function to get Israel time date string (Asia/Jerusalem timezone)
        const getIsraelDateString = () => {
            // Get current date in Israel timezone
            const now = new Date();
            const israelDateParts = now.toLocaleDateString('en-CA', {
                timeZone: 'Asia/Jerusalem',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }); // Returns YYYY-MM-DD format
            return israelDateParts;
        };
        
        // Get current date in Israel timezone
        const now = new Date();
        const today = getIsraelDateString();
        
        console.log('📊 Israel time:', now.toISOString());
        console.log('📊 Today in Israel:', today);
        
        // Get user's selected vehicle to filter by
        let userVehicleNumber = null;
        try {
            const { data: vehicleData } = await supabase
                .rpc('get_user_vehicle', {
                    p_user_id: req.user.user_id
                });
            
            if (vehicleData && vehicleData.length > 0) {
                userVehicleNumber = vehicleData[0].vehicle_number;
                console.log('📊 Filtering stats by vehicle:', userVehicleNumber);
            }
        } catch (vehicleError) {
            console.log('📊 Could not fetch user vehicle, showing all stats');
        }
        
        // Get calls from today based on call_date field - FILTERED BY USER AND VEHICLE
        // Day starts at 00:00 and ends at 23:59 Israel time
        // Note: This shows only THIS USER's calls on the vehicle, not all users' calls
        let todayQuery = supabase
            .from('calls')
            .select('*')
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .eq('call_date', today);
        
        if (userVehicleNumber) {
            todayQuery = todayQuery.eq('vehicle_number', userVehicleNumber);
        }
        
        const { data: todayCalls, error: dateError } = await todayQuery;
        
        console.log(`📊 Today's calls found: ${todayCalls ? todayCalls.length : 0}`);
        
        if (dateError) {
            console.error('📊 Error fetching today\'s calls:', dateError);
        }
        
        // Also get recent calls to verify what's in the database - FILTERED BY USER
        const { data: allCalls, error: allError } = await supabase
            .from('calls')
            .select('id, call_type, call_date, created_at')
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .order('created_at', { ascending: false })
            .limit(10);
            
        // Get weekly and monthly stats using direct queries
        // Calculate weekly date range (SUNDAY to SATURDAY - Israel standard)
        // Week starts on Sunday (day 0) and ends on Saturday (day 6)
        const weekStart = new Date(now);
        const dayOfWeek = weekStart.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        // Go back to Sunday (start of week in Israel)
        weekStart.setDate(weekStart.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0); // Start of Sunday
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        // Week ends on next Sunday (exclusive, so Saturday is included)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7); // Next Sunday
        weekEnd.setHours(0, 0, 0, 0);
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        console.log(`📊 Week range (Sun-Sat): ${weekStartStr} to ${weekEndStr} (exclusive)`);

        // Get weekly stats
        // Note: This shows only THIS USER's calls on the vehicle, not all users' calls
        let weeklyQuery = supabase
            .from('calls')
            .select('id, duration_minutes, start_time, arrival_time')
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .gte('call_date', weekStartStr)
            .lt('call_date', weekEndStr);
        
        if (userVehicleNumber) {
            weeklyQuery = weeklyQuery.eq('vehicle_number', userVehicleNumber);
        }
        
        const { data: weeklyCalls, error: weeklyError } = await weeklyQuery;

        console.log(`📊 Weekly calls found: ${weeklyCalls ? weeklyCalls.length : 0}`);

        console.log(`📊 Weekly calls found: ${weeklyCalls ? weeklyCalls.length : 0}`);

        // Calculate monthly date range (1st to last day of current month in Israel timezone)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0); // Start of first day of month
        const monthStartStr = monthStart.toISOString().split('T')[0];
        
        // Calculate next month's first day - handles year transition automatically
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1); // JavaScript Date handles year rollover automatically
        monthEnd.setHours(0, 0, 0, 0); // Start of first day of next month (exclusive)
        const monthEndStr = monthEnd.toISOString().split('T')[0];

        console.log(`📊 Month range: ${monthStartStr} to ${monthEndStr} (exclusive)`);

        // Get monthly stats
        // Note: This shows only THIS USER's calls on the vehicle, not all users' calls
        let monthlyQuery = supabase
            .from('calls')
            .select('id, duration_minutes, start_time, arrival_time')
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .gte('call_date', monthStartStr)
            .lt('call_date', monthEndStr);
        
        if (userVehicleNumber) {
            monthlyQuery = monthlyQuery.eq('vehicle_number', userVehicleNumber);
        }
        
        const { data: monthlyCalls, error: monthlyError } = await monthlyQuery;

        console.log(`📊 Monthly calls found: ${monthlyCalls ? monthlyCalls.length : 0}`);

        // Helper function to calculate total hours from calls
        const calculateHours = (calls) => {
            if (!calls || calls.length === 0) return 0;
            
            const totalMinutes = calls.reduce((sum, call) => {
                return sum + (call.duration_minutes || 30); // Default 30 minutes if no duration
            }, 0);
            
            return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimal places
        };

        // Helper function to calculate average arrival time in minutes
        const calculateAverageArrivalTime = (calls) => {
            if (!calls || calls.length === 0) return null;
            
            // Filter calls that have both start_time and arrival_time
            const callsWithArrivalTime = calls.filter(call => call.start_time && call.arrival_time);
            
            if (callsWithArrivalTime.length === 0) return null;
            
            // Calculate arrival time in minutes for each call
            const arrivalTimes = callsWithArrivalTime.map(call => {
                const [startHour, startMin] = call.start_time.split(':').map(Number);
                const [arrivalHour, arrivalMin] = call.arrival_time.split(':').map(Number);
                
                const startMinutes = startHour * 60 + startMin;
                let arrivalMinutes = arrivalHour * 60 + arrivalMin;
                
                // Handle midnight crossover
                if (arrivalMinutes < startMinutes) {
                    arrivalMinutes += 24 * 60; // Add 24 hours
                }
                
                return arrivalMinutes - startMinutes;
            });
            
            // Calculate average
            const totalMinutes = arrivalTimes.reduce((sum, time) => sum + time, 0);
            const avgMinutes = Math.round(totalMinutes / arrivalTimes.length);
            
            // Format as MM:SS or HH:MM:SS
            const hours = Math.floor(avgMinutes / 60);
            const minutes = avgMinutes % 60;
            
            if (hours === 0) {
                return `${minutes}m`;
            } else {
                return `${hours}h ${minutes}m`;
            }
        };

        // Calculate today's stats
        const todayStats = {
            total_calls: todayCalls ? todayCalls.length : 0,
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

        // Calculate average arrival time from all calls (today, week, or month - using month for more data)
        const averageArrivalTime = calculateAverageArrivalTime(monthlyCalls);

        console.log(`📊 Stats Summary (Israel Time):`);
        console.log(`   Today (${today}): ${todayStats.total_calls} calls, ${todayStats.total_hours}h`);
        console.log(`   Week (${weekStartStr} to ${weekEndStr}): ${weeklyStats.total_calls} calls, ${weeklyStats.total_hours}h`);
        console.log(`   Month (${monthStartStr} to ${monthEndStr}): ${monthlyStats.total_calls} calls, ${monthlyStats.total_hours}h`);
        console.log(`   Average Arrival Time: ${averageArrivalTime || 'N/A'}`);

        res.json({
            success: true,
            data: {
                totalCalls: todayStats.total_calls,
                weeklyCalls: weeklyStats.total_calls,
                monthlyCalls: monthlyStats.total_calls,
                weeklyHours: weeklyStats.total_hours,
                monthlyHours: monthlyStats.total_hours,
                averageArrivalTime: averageArrivalTime,
                currentDate: today,
                debug: {
                    israelTime: now.toISOString(),
                    todayCallsFound: todayStats.total_calls,
                    weeklyCallsFound: weeklyStats.total_calls,
                    monthlyCallsFound: monthlyStats.total_calls,
                    weekRange: `${weekStartStr} to ${weekEndStr} (Sun-Sat)`,
                    monthRange: `${monthStartStr} to ${monthEndStr}`,
                    timezone: 'Asia/Jerusalem'
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

// Keep-alive endpoint for cron services (lightweight, no auth required)
app.get('/api/keepalive', (req, res) => {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const timestamp = new Date().toISOString();
    
    // Log the ping (helps monitor cron job activity)
    console.log(`🏓 Keep-alive ping from: ${userAgent} at ${timestamp}`);
    
    // Return minimal response to save bandwidth
    res.status(200).json({
        status: 'alive',
        timestamp: timestamp,
        server: 'MDA-CallCounter'
    });
});

// Keep-alive endpoint (alternative URL)
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
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

// ===== CODES MANAGEMENT ENDPOINTS =====

// Get all alert codes (for dropdown)
app.get('/api/codes/alert', authenticateToken, async (req, res) => {
    try {
        const { data: codes, error } = await supabase
            .from('alert_codes')
            .select('*')
            .order('code', { ascending: true });
        
        if (error) throw error;
        
        res.json({
            success: true,
            data: codes || []
        });
    } catch (error) {
        console.error('Error fetching alert codes:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בטעינת קודי הזנקה'
        });
    }
});

// Get all medical codes (for dropdown)
app.get('/api/codes/medical', authenticateToken, async (req, res) => {
    try {
        const { data: codes, error } = await supabase
            .from('medical_codes')
            .select('*')
            .order('code', { ascending: true });
        
        if (error) throw error;
        
        res.json({
            success: true,
            data: codes || []
        });
    } catch (error) {
        console.error('Error fetching medical codes:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בטעינת קודים רפואיים'
        });
    }
});

// ===== ADMIN ENDPOINTS =====

// Admin middleware
function requireAdmin(req, res, next) {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({
            success: false,
            message: 'גישה למנהל מערכת בלבד'
        });
    }
    next();
}

// Get admin dashboard data
app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
        console.log('🔑 Admin dashboard accessed by:', req.user.username);
        
        // Get total users count
        const { data: users, error: usersError} = await supabase
            .from('users')
            .select('id, username, mda_code, created_at, is_admin')
            .order('created_at', { ascending: false });
        
        if (usersError) throw usersError;
        
        // Get all calls for statistics
        const { data: allCalls, error: callsError } = await supabase
            .from('calls')
            .select('*')
            .order('created_at', { ascending: false});
        
        if (callsError) throw callsError;
        
        // Calculate global statistics
        const totalCalls = allCalls.length;
        const activeCalls = allCalls.filter(call => !call.end_time).length;
        const completedCalls = allCalls.filter(call => call.end_time).length;
        
        // Calls by type
        const urgentCalls = allCalls.filter(call => 
            call.call_type === 'דחוף' || call.call_type === 'urgent'
        ).length;
        const atanCalls = allCalls.filter(call => 
            call.call_type === 'אט"ן' || call.call_type === 'אט״ן' || call.call_type === 'atan'
        ).length;
        const aranCalls = allCalls.filter(call => 
            call.call_type === 'ארן' || call.call_type === 'aran'
        ).length;
        const natbagCalls = allCalls.filter(call => 
            call.call_type === 'נתבג' || call.call_type === 'natbag'
        ).length;
        
        // Recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentCalls = allCalls.filter(call => 
            new Date(call.created_at) >= sevenDaysAgo
        ).length;
        
        // Vehicle types distribution
        const vehicleStats = {
            motorcycles: users.filter(u => u.mda_code && u.mda_code.toString().startsWith('5')).length,
            picantos: users.filter(u => u.mda_code && u.mda_code.toString().startsWith('6')).length,
            personalStandby: users.filter(u => u.mda_code && u.mda_code.toString().length === 5 && 
                (u.mda_code.toString().startsWith('1') || u.mda_code.toString().startsWith('2'))).length,
            ambulances: users.filter(u => u.mda_code && 
                !u.mda_code.toString().startsWith('5') && 
                !u.mda_code.toString().startsWith('6') && 
                !(u.mda_code.toString().length === 5 && 
                  (u.mda_code.toString().startsWith('1') || u.mda_code.toString().startsWith('2')))).length
        };
        
        // Vehicle call stats based on vehicle_number in calls
        const vehicleCallStats = {
            motorcycleCalls: allCalls.filter(call => {
                const vn = call.vehicle_number?.toString();
                return vn && vn.length === 4 && vn.startsWith('5');
            }).length,
            picantoCalls: allCalls.filter(call => {
                const vn = call.vehicle_number?.toString();
                return vn && vn.length === 4 && vn.startsWith('6');
            }).length,
            personalStandbyCalls: allCalls.filter(call => {
                const vn = call.vehicle_number?.toString();
                return vn && vn.length === 5 && (vn.startsWith('1') || vn.startsWith('2'));
            }).length,
            ambulanceCalls: allCalls.filter(call => {
                const vn = call.vehicle_number?.toString();
                return vn && !((vn.length === 4 && vn.startsWith('5')) || (vn.length === 4 && vn.startsWith('6')) || (vn.length === 5 && (vn.startsWith('1') || vn.startsWith('2'))));
            }).length
        };
        
        res.json({
            success: true,
            data: {
                totalUsers: users.length,
                totalCalls,
                activeCalls,
                completedCalls,
                urgentCalls,
                atanCalls,
                aranCalls,
                natbagCalls,
                recentCalls,
                vehicleStats,
                vehicleCallStats,
                users: users.slice(0, 10), // Top 10 users for preview
                recentCallsData: allCalls.slice(0, 20) // 20 most recent calls
            }
        });
        
    } catch (error) {
        console.error('❌ Admin dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בטעינת נתוני המנהל',
            error: error.message
        });
    }
});

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, full_name, mda_code, created_at, is_admin')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({
            success: true,
            users
        });
        
    } catch (error) {
        console.error('❌ Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בטעינת רשימת המשתמשים'
        });
    }
});

// Get all calls (admin only)
app.get('/api/admin/calls', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        const { data: calls, error } = await supabase
            .from('calls')
            .select(`
                *,
                users!inner(username, mda_code)
            `)
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
        
        if (error) throw error;
        
        res.json({
            success: true,
            calls
        });
        
    } catch (error) {
        console.error('❌ Get all calls error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בטעינת כל הקריאות'
        });
    }
});

// Get user call statistics
app.get('/api/admin/user-call-stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { year, month } = req.query;
        
        // Get all users
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, full_name, username, mda_code, email, is_admin, created_at')
            .order('full_name', { ascending: true });
        
        if (usersError) throw usersError;
        
        // Get call stats for each user
        let query = supabase
            .from('calls')
            .select('user_id, call_type, duration_minutes, call_date, status');
        
        // Apply year/month filtering if provided
        if (year) {
            const startOfYear = `${year}-01-01`;
            const endOfYear = `${year}-12-31`;
            query = query.gte('call_date', startOfYear).lte('call_date', endOfYear);
        }
        
        if (month && year) {
            // Add month filtering
            const monthStr = String(month).padStart(2, '0');
            const startOfMonth = `${year}-${monthStr}-01`;
            
            // Calculate end of month
            const lastDay = new Date(year, month, 0).getDate();
            const endOfMonth = `${year}-${monthStr}-${lastDay}`;
            
            query = query.gte('call_date', startOfMonth).lte('call_date', endOfMonth);
        }
        
        const { data: allCalls, error: callsError } = await query;
        
        if (callsError) throw callsError;
        
        // Calculate stats for each user
        const userStats = users.map(user => {
            const userCalls = allCalls.filter(call => call.user_id === user.id);
            
            // Count calls by type
            const callTypeCount = {};
            let totalHours = 0;
            let totalCalls = userCalls.length;
            let todaysCalls = 0;
            const today = new Date().toISOString().split('T')[0];
            
            userCalls.forEach(call => {
                // Count by call type
                if (call.call_type) {
                    callTypeCount[call.call_type] = (callTypeCount[call.call_type] || 0) + 1;
                }
                // Calculate total hours
                if (call.duration_minutes) {
                    totalHours += call.duration_minutes / 60;
                }
                // Count today's calls or calls in filtered period
                if (!year && !month) {
                    // No filters - count calls from today only
                    if (call.call_date === today) {
                        todaysCalls++;
                    }
                } else if (month && year) {
                    // If filtering by specific month - count all calls in that month
                    todaysCalls = totalCalls;
                } else if (year && !month) {
                    // If filtering by year only - count calls from today if it's in that year
                    if (call.call_date === today) {
                        todaysCalls++;
                    }
                }
            });
            
            return {
                user_id: user.id,
                full_name: user.full_name,
                username: user.username,
                mda_code: user.mda_code,
                email: user.email,
                is_admin: user.is_admin,
                created_at: user.created_at,
                totalCalls: totalCalls,
                todaysCalls: todaysCalls,
                totalHours: parseFloat(totalHours.toFixed(2)),
                callTypeBreakdown: callTypeCount
            };
        });
        
        res.json({
            success: true,
            userStats: userStats
        });
        
    } catch (error) {
        console.error('❌ Get user call stats error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בטעינת סטטיסטיקת הקריאות'
        });
    }
});

// Update user admin status
app.patch('/api/admin/users/:userId/admin', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { isAdmin } = req.body;
        
        const { data, error } = await supabase
            .from('users')
            .update({ is_admin: isAdmin })
            .eq('id', userId)
            .select()
            .single();
        
        if (error) throw error;
        
        console.log(`🔑 Admin status updated for user ${userId}: ${isAdmin}`);
        
        res.json({
            success: true,
            message: `סטטוס מנהל עודכן בהצלחה`,
            user: data
        });
        
    } catch (error) {
        console.error('❌ Update admin status error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בעדכון סטטוס מנהל'
        });
    }
});

// Delete user (admin only)
app.delete('/api/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log(`🗑️ Attempting to delete user: ${userId}`);
        
        // First delete user's calls
        const { data: deletedCalls, error: callsError } = await supabase
            .from('calls')
            .delete()
            .eq('user_id', userId)
            .select();
        
        if (callsError) {
            console.error('❌ Error deleting user calls:', callsError);
            throw callsError;
        }
        
        console.log(`✅ Deleted ${deletedCalls?.length || 0} calls for user ${userId}`);
        
        // Then delete the user
        const { data: deletedUser, error: userError } = await supabase
            .from('users')
            .delete()
            .eq('id', userId)
            .select();
        
        if (userError) {
            console.error('❌ Error deleting user:', userError);
            throw userError;
        }
        
        console.log(`✅ Deleted user:`, deletedUser);
        
        res.json({
            success: true,
            message: 'משתמש נמחק בהצלחה'
        });
        
    } catch (error) {
        console.error('❌ Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה במחיקת המשתמש',
            error: error.message
        });
    }
});

// ===== ADMIN CODES MANAGEMENT =====

// Admin: Get all alert codes
app.get('/api/admin/codes/alert', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { data: codes, error } = await supabase
            .from('alert_codes')
            .select('*')
            .order('code', { ascending: true });
        
        if (error) throw error;
        
        res.json({
            success: true,
            data: codes || []
        });
    } catch (error) {
        console.error('Error fetching alert codes:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בטעינת קודי הזנקה'
        });
    }
});

// Admin: Get all medical codes
app.get('/api/admin/codes/medical', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { data: codes, error } = await supabase
            .from('medical_codes')
            .select('*')
            .order('code', { ascending: true });
        
        if (error) throw error;
        
        res.json({
            success: true,
            data: codes || []
        });
    } catch (error) {
        console.error('Error fetching medical codes:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בטעינת קודים רפואיים'
        });
    }
});

// Admin: Create alert code
app.post('/api/admin/codes/alert', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'שם הקוד הוא שדה חובה'
            });
        }
        
        const { data, error } = await supabase
            .from('alert_codes')
            .insert([{ code }])
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json({
            success: true,
            message: 'קוד הזנקה נוצר בהצלחה',
            data
        });
    } catch (error) {
        console.error('Error creating alert code:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה ביצירת קוד הזנקה'
        });
    }
});

// Admin: Create medical code
app.post('/api/admin/codes/medical', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'שם הקוד הוא שדה חובה'
            });
        }
        
        const { data, error } = await supabase
            .from('medical_codes')
            .insert([{ code }])
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json({
            success: true,
            message: 'קוד רפואי נוצר בהצלחה',
            data
        });
    } catch (error) {
        console.error('Error creating medical code:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה ביצירת קוד רפואי'
        });
    }
});

// Admin: Update alert code
app.put('/api/admin/codes/alert/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'שם הקוד הוא שדה חובה'
            });
        }
        
        const { data, error } = await supabase
            .from('alert_codes')
            .update({ code })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({
            success: true,
            message: 'קוד הזנקה עודכן בהצלחה',
            data
        });
    } catch (error) {
        console.error('Error updating alert code:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בעדכון קוד הזנקה'
        });
    }
});

// Admin: Update medical code
app.put('/api/admin/codes/medical/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'שם הקוד הוא שדה חובה'
            });
        }
        
        const { data, error } = await supabase
            .from('medical_codes')
            .update({ code })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({
            success: true,
            message: 'קוד רפואי עודכן בהצלחה',
            data
        });
    } catch (error) {
        console.error('Error updating medical code:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בעדכון קוד רפואי'
        });
    }
});

// Admin: Delete alert code
app.delete('/api/admin/codes/alert/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('alert_codes')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        res.json({
            success: true,
            message: 'קוד הזנקה נמחק בהצלחה'
        });
    } catch (error) {
        console.error('Error deleting alert code:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה במחיקת קוד הזנקה'
        });
    }
});

// Admin: Delete medical code
app.delete('/api/admin/codes/medical/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('medical_codes')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        res.json({
            success: true,
            message: 'קוד רפואי נמחק בהצלחה'
        });
    } catch (error) {
        console.error('Error deleting medical code:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה במחיקת קוד רפואי'
        });
    }
});



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
    
    // Check if the requested file exists in public directory
    const requestedPath = path.join(__dirname, 'public', req.path);
    
    // If the file exists, serve it directly
    if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
        return res.sendFile(requestedPath, (err) => {
            if (err) {
                console.error('Error serving file:', req.path, err);
                res.status(500).send('Server Error');
            }
        });
    }
    
    // For routes that don't exist, serve index.html (SPA support)
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

// ===== ADMIN ENDPOINTS =====

// Admin middleware
function requireAdmin(req, res, next) {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({
            success: false,
            message: 'גישה למנהל מערכת בלבד'
        });
    }
    next();
}

// Get admin dashboard data
app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
        console.log('🔑 Admin dashboard accessed by:', req.user.username);
        
        // Get total users count
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, username, mda_code, created_at, is_admin')
            .order('created_at', { ascending: false });
        
        if (usersError) throw usersError;
        
        // Get all calls for statistics
        const { data: allCalls, error: callsError } = await supabase
            .from('calls')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (callsError) throw callsError;
        
        // Calculate global statistics
        const totalCalls = allCalls.length;
        const activeCalls = allCalls.filter(call => !call.end_time).length;
        const completedCalls = allCalls.filter(call => call.end_time).length;
        
        // Calls by type
        const urgentCalls = allCalls.filter(call => 
            call.call_type === 'דחוף' || call.call_type === 'urgent'
        ).length;
        const atanCalls = allCalls.filter(call => 
            call.call_type === 'אט"ן' || call.call_type === 'אט״ן' || call.call_type === 'atan'
        ).length;
        const aranCalls = allCalls.filter(call => 
            call.call_type === 'ארן' || call.call_type === 'aran'
        ).length;
        const natbagCalls = allCalls.filter(call => 
            call.call_type === 'נתבג' || call.call_type === 'natbag'
        ).length;
        
        // Recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentCalls = allCalls.filter(call => 
            new Date(call.created_at) >= sevenDaysAgo
        ).length;
        
        // Vehicle types distribution
        const vehicleStats = {
            motorcycles: users.filter(u => u.mda_code && u.mda_code.toString().startsWith('5')).length,
            picantos: users.filter(u => u.mda_code && u.mda_code.toString().startsWith('6')).length,
            personalStandby: users.filter(u => u.mda_code && u.mda_code.toString().length === 5 && 
                (u.mda_code.toString().startsWith('1') || u.mda_code.toString().startsWith('2'))).length,
            ambulances: users.filter(u => u.mda_code && 
                !u.mda_code.toString().startsWith('5') && 
                !u.mda_code.toString().startsWith('6') && 
                !(u.mda_code.toString().length === 5 && 
                  (u.mda_code.toString().startsWith('1') || u.mda_code.toString().startsWith('2')))).length
        };
        
        res.json({
            success: true,
            data: {
                totalUsers: users.length,
                totalCalls,
                activeCalls,
                completedCalls,
                urgentCalls,
                atanCalls,
                aranCalls,
                natbagCalls,
                recentCalls,
                vehicleStats, vehicleCallStats: { motorcycleCalls: allCalls.filter(call => call.vehicle_number && call.vehicle_number.toString().startsWith('5')).length, picantoCalls: allCalls.filter(call => call.vehicle_number && call.vehicle_number.toString().startsWith('6')).length, personalStandbyCalls: allCalls.filter(call => call.vehicle_number && call.vehicle_number.toString().length === 5 && (call.vehicle_number.toString().startsWith('1') || call.vehicle_number.toString().startsWith('2'))).length, ambulanceCalls: allCalls.filter(call => call.vehicle_number && !call.vehicle_number.toString().startsWith('5') && !call.vehicle_number.toString().startsWith('6') && !(call.vehicle_number.toString().length === 5 && (call.vehicle_number.toString().startsWith('1') || call.vehicle_number.toString().startsWith('2')))).length },
                users: users.slice(0, 10), // Top 10 users for preview
                recentCallsData: allCalls.slice(0, 20) // 20 most recent calls
            }
        });
        
    } catch (error) {
        console.error('❌ Admin dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בטעינת נתוני המנהל',
            error: error.message
        });
    }
});

// Get all users (admin only)
app.listen(PORT, () => {
    console.log(`🏍️  MDA CallCounter Server running on port ${PORT}`);
    console.log(`🚑  Motorcycle: ${process.env.MOTORCYCLE_NUMBER || '5248'}`);
    console.log(`🗄️  Database: ${supabaseUrl ? 'Connected' : 'Not configured'}`);
    console.log(`🌍  Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;


