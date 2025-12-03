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
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://code.jquery.com", "https://cdn.jsdelivr.net", "https://shir-gw.checkpoint.com", "https://zerophishing.iaas.checkpoint.com"],
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

// API Key authentication middleware
const authenticateAPIKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({
            success: false,
            message: 'API key required',
            code: 'NO_API_KEY'
        });
    }

    try {
        // Hash the provided API key to compare with stored hash
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        
        // Look up the API key in the database
        const { data: apiKeyData, error } = await supabase
            .from('api_keys')
            .select('*, users(*)')
            .eq('key_hash', keyHash)
            .eq('is_active', true)
            .single();

        if (error || !apiKeyData) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or inactive API key',
                code: 'INVALID_API_KEY'
            });
        }

        // Update last_used_at timestamp
        await supabase
            .from('api_keys')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', apiKeyData.id);

        // Attach user info from the API key's owner
        req.user = {
            user_id: apiKeyData.user_id,
            username: apiKeyData.users.username,
            mda_code: apiKeyData.users.mda_code,
            mdaCode: apiKeyData.users.mda_code,
            full_name: apiKeyData.users.full_name,
            is_admin: apiKeyData.users.is_admin
        };
        
        req.apiKey = apiKeyData;
        
        console.log('🔑 API Key authenticated for user:', req.user.username);
        next();
    } catch (error) {
        console.error('API Key verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error verifying API key',
            code: 'API_KEY_ERROR'
        });
    }
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
        // JOIN with alert_codes and medical_codes to get the actual code values
        const { data: calls, error: callsError } = await supabase
            .from('calls')
            .select(`
                *,
                alert_codes:alert_code_id(code),
                medical_codes:medical_code_id(code)
            `)
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
            location,
            city,
            street,
            description,
            alert_code_id,
            medical_code_id,
            meter_visa_number,
            entry_code
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
        const userMdaCode = req.user && req.user.mda_code ? req.user.mda_code : null;
        
        console.log('📞 Server: Using MDA code:', userMdaCode);
        console.log('📞 Server: MDA code type:', typeof userMdaCode);
        console.log('📞 Server: MDA code is null?', userMdaCode === null);
        console.log('📞 Server: MDA code is undefined?', userMdaCode === undefined);
        
        const detectedVehicleType = detectVehicleType(userMdaCode);
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
            location,
            city: city || null,
            street: street || null,
            description: description || null,
            alert_code_id: alert_code_id || null,
            medical_code_id: medical_code_id || null,
            meter_visa_number: meter_visa_number || null,
            entry_code: entry_code || null,
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
        const { call_type, call_date, start_time, end_time, location, description, alert_code_id, medical_code_id, meter_visa_number, entry_code } = req.body;

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
        if (entry_code !== undefined) updateData.entry_code = entry_code;

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

// Get all unique entry codes with their locations
app.get('/api/entry-codes', authenticateToken, async (req, res) => {
    try {
        console.log('🔑 Fetching entry codes...');

        // Query 1: Get manually added entry codes from entry_codes table
        const { data: manualCodes, error: manualError } = await supabase
            .from('entry_codes')
            .select('entry_code, city, street, location_details, id, notes')
            .order('city', { ascending: true })
            .order('street', { ascending: true });

        if (manualError) {
            console.error('Error fetching manual entry codes:', manualError);
        }

        // Query 2: Get entry codes from calls
        const { data: callCodes, error: callError } = await supabase
            .from('calls')
            .select('entry_code, city, street, location')
            .not('entry_code', 'is', null)
            .not('entry_code', 'eq', '')
            .order('city', { ascending: true })
            .order('street', { ascending: true });

        if (callError) {
            console.error('Error fetching entry codes from calls:', callError);
        }

        // Process and deduplicate the results
        const entryCodesMap = new Map();
        
        // Add manual codes first (they have priority)
        if (manualCodes) {
            manualCodes.forEach(code => {
                const key = `${code.entry_code}|${code.city}|${code.street}`;
                entryCodesMap.set(key, {
                    entry_code: code.entry_code,
                    city: code.city || '',
                    street: code.street || '',
                    location_details: code.location_details || '',
                    source: 'manual',
                    id: code.id
                });
            });
        }
        
        // Add codes from calls (skip if already exists)
        if (callCodes) {
            callCodes.forEach(call => {
                // Extract location details (everything after city and street)
                let locationDetails = '';
                if (call.location) {
                    const parts = call.location.split(',').map(s => s.trim());
                    if (parts.length > 2) {
                        locationDetails = parts.slice(2).join(', ');
                    }
                }

                // Create a unique key for each combination
                const key = `${call.entry_code}|${call.city}|${call.street}`;
                
                if (!entryCodesMap.has(key)) {
                    entryCodesMap.set(key, {
                        entry_code: call.entry_code,
                        city: call.city || '',
                        street: call.street || '',
                        location_details: locationDetails,
                        source: 'call'
                    });
                }
            });
        }

        // Convert map to array
        const uniqueEntryCodes = Array.from(entryCodesMap.values());

        console.log(`🔑 Found ${uniqueEntryCodes.length} unique entry codes (${manualCodes?.length || 0} manual, ${callCodes?.length || 0} from calls)`);

        res.json({
            success: true,
            data: uniqueEntryCodes,
            count: uniqueEntryCodes.length
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

// ===== ADMIN ENTRY CODES MANAGEMENT =====

// Create new entry code (Admin only)
app.post('/api/admin/entry-codes', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user || !req.user.is_admin) {
            return res.status(403).json({
                success: false,
                message: 'גישה נדחתה - נדרשות הרשאות מנהל'
            });
        }

        const { entry_code, city, street, location_details, notes } = req.body;

        // Validation
        if (!entry_code || !city || !street) {
            return res.status(400).json({
                success: false,
                message: 'קוד כניסה, עיר ורחוב הם שדות חובה'
            });
        }

        // Insert new entry code
        const { data, error } = await supabase
            .from('entry_codes')
            .insert([{
                entry_code: entry_code.trim(),
                city: city.trim(),
                street: street.trim(),
                location_details: location_details?.trim() || null,
                notes: notes?.trim() || null,
                created_by: req.user.user_id
            }])
            .select()
            .single();

        if (error) {
            // Check for duplicate
            if (error.code === '23505') {
                return res.status(409).json({
                    success: false,
                    message: 'קוד כניסה זה כבר קיים עבור מיקום זה'
                });
            }
            
            console.error('Error creating entry code:', error);
            return res.status(400).json({
                success: false,
                message: 'שגיאה ביצירת קוד כניסה',
                error: error.message
            });
        }

        console.log(`🔑 Admin ${req.user.username} created entry code: ${entry_code} for ${city}, ${street}`);

        res.json({
            success: true,
            message: 'קוד הכניסה נוסף בהצלחה',
            data: data
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

// Update entry code (Admin only)
app.put('/api/admin/entry-codes/:id', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user || !req.user.is_admin) {
            return res.status(403).json({
                success: false,
                message: 'גישה נדחתה - נדרשות הרשאות מנהל'
            });
        }

        const { id } = req.params;
        const { entry_code, city, street, location_details, notes } = req.body;

        // Validation
        if (!entry_code || !city || !street) {
            return res.status(400).json({
                success: false,
                message: 'קוד כניסה, עיר ורחוב הם שדות חובה'
            });
        }

        // Update entry code
        const { data, error } = await supabase
            .from('entry_codes')
            .update({
                entry_code: entry_code.trim(),
                city: city.trim(),
                street: street.trim(),
                location_details: location_details?.trim() || null,
                notes: notes?.trim() || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            // Check for duplicate
            if (error.code === '23505') {
                return res.status(409).json({
                    success: false,
                    message: 'קוד כניסה זה כבר קיים עבור מיקום זה'
                });
            }
            
            console.error('Error updating entry code:', error);
            return res.status(400).json({
                success: false,
                message: 'שגיאה בעדכון קוד כניסה',
                error: error.message
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'קוד כניסה לא נמצא'
            });
        }

        console.log(`🔑 Admin ${req.user.username} updated entry code: ${id}`);

        res.json({
            success: true,
            message: 'קוד הכניסה עודכן בהצלחה',
            data: data
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

// Delete entry code (Admin only)
app.delete('/api/admin/entry-codes/:id', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user || !req.user.is_admin) {
            return res.status(403).json({
                success: false,
                message: 'גישה נדחתה - נדרשות הרשאות מנהל'
            });
        }

        const { id } = req.params;

        // Delete entry code
        const { error } = await supabase
            .from('entry_codes')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting entry code:', error);
            return res.status(400).json({
                success: false,
                message: 'שגיאה במחיקת קוד כניסה',
                error: error.message
            });
        }

        console.log(`🔑 Admin ${req.user.username} deleted entry code: ${id}`);

        res.json({
            success: true,
            message: 'קוד הכניסה נמחק בהצלחה'
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
        
        // Helper function to get Israel time (Asia/Jerusalem timezone)
        const getIsraelTime = () => {
            // Convert current time to Israel timezone
            const israelTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Jerusalem"});
            return new Date(israelTime);
        };
        
        // Get current date in Israel timezone
        const now = getIsraelTime();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format in Israel
        
        console.log('📊 Israel time:', now.toISOString());
        console.log('📊 Today in Israel:', today);
        
        // Get calls from today based on call_date field - FILTERED BY USER
        // Day starts at 00:00 and ends at 23:59 Israel time
        const { data: todayCalls, error: dateError } = await supabase
            .from('calls')
            .select('*')
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .eq('call_date', today);
        
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
        const { data: weeklyCalls, error: weeklyError } = await supabase
            .from('calls')
            .select('id, duration_minutes')
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .gte('call_date', weekStartStr)
            .lt('call_date', weekEndStr);

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
        const { data: monthlyCalls, error: monthlyError } = await supabase
            .from('calls')
            .select('id, duration_minutes')
            .eq('user_id', req.user.user_id)  // CRITICAL: Only user's own data
            .gte('call_date', monthStartStr)
            .lt('call_date', monthEndStr);

        console.log(`📊 Monthly calls found: ${monthlyCalls ? monthlyCalls.length : 0}`);

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

        console.log(`📊 Stats Summary (Israel Time):`);
        console.log(`   Today (${today}): ${todayStats.total_calls} calls, ${todayStats.total_hours}h`);
        console.log(`   Week (${weekStartStr} to ${weekEndStr}): ${weeklyStats.total_calls} calls, ${weeklyStats.total_hours}h`);
        console.log(`   Month (${monthStartStr} to ${monthEndStr}): ${monthlyStats.total_calls} calls, ${monthlyStats.total_hours}h`);

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

// ============================================
// API KEY MANAGEMENT ROUTES (Admin Only)
// ============================================

// Generate new API key
app.post('/api/admin/api-keys', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { key_name, permissions } = req.body;
        
        if (!key_name || !key_name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'שם המפתח חובה'
            });
        }

        // Generate random API key (32 bytes = 64 hex characters)
        const apiKey = crypto.randomBytes(32).toString('hex');
        
        // Hash the key before storing
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        
        // Default permissions if not specified
        const keyPermissions = Array.isArray(permissions) && permissions.length > 0 
            ? permissions 
            : ['calls:read', 'calls:write', 'stats:read'];

        const { data, error } = await supabase
            .from('api_keys')
            .insert({
                key_name: key_name.trim(),
                key_hash: keyHash,
                user_id: req.user.user_id,
                permissions: keyPermissions,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating API key:', error);
            return res.status(500).json({
                success: false,
                message: 'שגיאה ביצירת מפתח API'
            });
        }

        // Return the unhashed key ONLY this one time
        res.json({
            success: true,
            message: 'מפתח API נוצר בהצלחה',
            api_key: apiKey, // This will never be shown again!
            key_info: {
                id: data.id,
                key_name: data.key_name,
                permissions: data.permissions,
                created_at: data.created_at
            }
        });
    } catch (error) {
        console.error('Error in POST /api/admin/api-keys:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה ביצירת מפתח API'
        });
    }
});

// List all API keys for the authenticated user
app.get('/api/admin/api-keys', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('api_keys')
            .select('id, key_name, permissions, is_active, last_used_at, created_at, updated_at')
            .eq('user_id', req.user.user_id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching API keys:', error);
            return res.status(500).json({
                success: false,
                message: 'שגיאה בטעינת מפתחות API'
            });
        }

        res.json({
            success: true,
            api_keys: data || []
        });
    } catch (error) {
        console.error('Error in GET /api/admin/api-keys:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בטעינת מפתחות API'
        });
    }
});

// Revoke (delete) an API key
app.delete('/api/admin/api-keys/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const keyId = req.params.id;

        // Verify the key belongs to the authenticated user
        const { data: keyData, error: fetchError } = await supabase
            .from('api_keys')
            .select('id, user_id')
            .eq('id', keyId)
            .single();

        if (fetchError || !keyData) {
            return res.status(404).json({
                success: false,
                message: 'מפתח API לא נמצא'
            });
        }

        if (keyData.user_id !== req.user.user_id) {
            return res.status(403).json({
                success: false,
                message: 'אין הרשאה למחוק מפתח זה'
            });
        }

        // Delete the key
        const { error: deleteError } = await supabase
            .from('api_keys')
            .delete()
            .eq('id', keyId);

        if (deleteError) {
            console.error('Error deleting API key:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'שגיאה במחיקת מפתח API'
            });
        }

        res.json({
            success: true,
            message: 'מפתח API נמחק בהצלחה'
        });
    } catch (error) {
        console.error('Error in DELETE /api/admin/api-keys/:id:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה במחיקת מפתח API'
        });
    }
});

// ============================================
// PUBLIC API v1 ENDPOINTS (API Key Auth)
// ============================================

// Create a new call via API
app.post('/api/v1/calls', authenticateAPIKey, async (req, res) => {
    try {
        // Check permission
        if (!req.apiKey.permissions.includes('calls:write')) {
            return res.status(403).json({
                success: false,
                message: 'API key does not have permission to create calls'
            });
        }

        const {
            city,
            street,
            location,
            location_details,
            call_type_id,
            call_type,
            alert_code_id,
            medical_code_id,
            meter_visa_number,
            entry_code,
            description,
            call_date,
            start_time,
            end_time,
            vehicle_number: provided_vehicle_number,
            vehicle_type,
            status,
            patient_count,
            duration_minutes,
            user_id
        } = req.body;

        // Validate required fields
        if (!call_type_id && !call_type) {
            return res.status(400).json({
                success: false,
                message: 'Missing required field: call_type_id or call_type is required'
            });
        }

        // Use provided vehicle number or get from settings
        let vehicle_number = provided_vehicle_number;
        
        if (!vehicle_number) {
            const { data: settingsData, error: settingsError } = await supabase
                .from('vehicle_settings')
                .select('vehicle_number')
                .limit(1)
                .single();

            if (settingsError || !settingsData) {
                return res.status(500).json({
                    success: false,
                    message: 'Error fetching vehicle settings'
                });
            }
            
            vehicle_number = settingsData.vehicle_number;
        }

        // Use provided date or current date in Israel timezone
        const israelDate = call_date || new Date().toLocaleDateString('en-CA', {
            timeZone: 'Asia/Jerusalem'
        });

        // Get default user_id from vehicle settings if not provided
        let finalUserId = user_id;
        if (!finalUserId) {
            const { data: userData } = await supabase
                .from('users')
                .select('id')
                .eq('username', 'סהר')
                .single();
            finalUserId = userData?.id || null;
        }

        // If call_type not provided but call_type_id is, fetch the type name
        let finalCallType = call_type;
        if (!finalCallType && call_type_id) {
            const { data: typeData } = await supabase
                .from('call_types')
                .select('hebrew_name')
                .eq('id', call_type_id)
                .single();
            finalCallType = typeData?.hebrew_name || 'לא ידוע';
        }

        const callData = {
            user_id: finalUserId,
            vehicle_number,
            vehicle_type: vehicle_type || '🏍️ אופנוע',
            call_type: finalCallType || 'לא ידוע',
            call_type_id: call_type_id || null,
            location: location || (city && street ? `${city}, ${street}` : city || street || 'לא צוין'),
            destination: location_details || null,
            alert_code_id: alert_code_id || null,
            medical_code_id: medical_code_id || null,
            meter_visa_number: meter_visa_number || null,
            entry_code: entry_code || null,
            description: description || '',
            call_date: israelDate,
            start_time: start_time || '00:00:00',
            end_time: end_time || null,
            duration_minutes: duration_minutes || null,
            status: status || 'completed',
            patient_count: patient_count || 1,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('calls')
            .insert([callData])
            .select()
            .single();

        if (error) {
            console.error('Error creating call via API:', error);
            return res.status(500).json({
                success: false,
                message: 'Error creating call'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Call created successfully',
            call: data
        });
    } catch (error) {
        console.error('Error in POST /api/v1/calls:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get calls via API with filtering
app.get('/api/v1/calls', authenticateAPIKey, async (req, res) => {
    try {
        // Check permission
        if (!req.apiKey.permissions.includes('calls:read')) {
            return res.status(403).json({
                success: false,
                message: 'API key does not have permission to read calls'
            });
        }

        const {
            date,
            start_date,
            end_date,
            city,
            type,
            call_type_id,
            limit = 100,
            offset = 0
        } = req.query;

        // Build query
        let query = supabase
            .from('calls')
            .select(`
                *,
                call_types!call_type_id(id, hebrew_name, english_name),
                alert_codes!alert_code_id(id, code),
                medical_codes!medical_code_id(id, code)
            `, { count: 'exact' });

        // Apply date filters
        // Support both 'date' (exact date) and 'start_date/end_date' (range)
        if (date) {
            query = query.eq('call_date', date);
        } else {
            if (start_date) {
                query = query.gte('call_date', start_date);
            }
            if (end_date) {
                query = query.lte('call_date', end_date);
            }
        }

        // Apply city filter
        if (city) {
            query = query.ilike('city', `%${city}%`);
        }

        // Apply type filter
        // Support both 'type' (call type name) and 'call_type_id' (ID)
        if (type) {
            // Query by call type name (search both hebrew and english names)
            const { data: callTypes, error: typeError } = await supabase
                .from('call_types')
                .select('id')
                .or(`hebrew_name.ilike.%${type}%,english_name.ilike.%${type}%`);

            if (!typeError && callTypes && callTypes.length > 0) {
                const typeIds = callTypes.map(ct => ct.id);
                query = query.in('call_type_id', typeIds);
            }
        } else if (call_type_id) {
            query = query.eq('call_type_id', parseInt(call_type_id));
        }

        // Validate and apply pagination
        const safeLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 1000);
        const safeOffset = Math.max(parseInt(offset) || 0, 0);

        query = query
            .range(safeOffset, safeOffset + safeLimit - 1)
            .order('created_at', { ascending: false });

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching calls via API:', error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching calls',
                error: error.message
            });
        }

        res.json({
            success: true,
            calls: data || [],
            pagination: {
                total: count || 0,
                limit: safeLimit,
                offset: safeOffset,
                returned: data?.length || 0
            }
        });
    } catch (error) {
        console.error('Error in GET /api/v1/calls:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Get statistics via API
app.get('/api/v1/stats', authenticateAPIKey, async (req, res) => {
    try {
        // Check permission
        if (!req.apiKey.permissions.includes('stats:read')) {
            return res.status(403).json({
                success: false,
                message: 'API key does not have permission to read stats'
            });
        }

        const { date, city, type } = req.query;
        
        // Use provided date or today in Israel timezone
        const targetDate = date || new Date().toLocaleDateString('en-CA', {
            timeZone: 'Asia/Jerusalem'
        });

        // Get vehicle number
        const { data: settingsData, error: settingsError } = await supabase
            .from('vehicle_settings')
            .select('vehicle_number')
            .limit(1)
            .single();

        if (settingsError) {
            console.error('Error fetching settings:', settingsError);
        }

        const vehicle_number = settingsData?.vehicle_number || '5248';

        // Build query for calls
        let query = supabase
            .from('calls')
            .select('*, call_types!call_type_id(id, hebrew_name, english_name)')
            .eq('vehicle_number', vehicle_number)
            .eq('call_date', targetDate);

        // Apply optional filters
        if (city) {
            query = query.ilike('city', `%${city}%`);
        }

        if (type) {
            // Query by call type name (search both hebrew and english names)
            const { data: callTypes } = await supabase
                .from('call_types')
                .select('id')
                .or(`hebrew_name.ilike.%${type}%,english_name.ilike.%${type}%`);

            if (callTypes && callTypes.length > 0) {
                const typeIds = callTypes.map(ct => ct.id);
                query = query.in('call_type_id', typeIds);
            }
        }

        const { data: calls, error: callsError } = await query;

        if (callsError) {
            console.error('Error fetching stats via API:', callsError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching statistics',
                error: callsError.message
            });
        }

        // Calculate statistics
        const totalCalls = calls?.length || 0;
        const callsByType = {};
        const callsByCity = {};
        
        if (calls) {
            calls.forEach(call => {
                const typeName = call.call_types?.hebrew_name || call.call_types?.english_name || 'Unknown';
                callsByType[typeName] = (callsByType[typeName] || 0) + 1;

                const cityName = call.city || 'Unknown';
                callsByCity[cityName] = (callsByCity[cityName] || 0) + 1;
            });
        }

        res.json({
            success: true,
            date: targetDate,
            vehicle_number,
            filters: {
                city: city || null,
                type: type || null
            },
            stats: {
                total_calls: totalCalls,
                calls_by_type: callsByType,
                calls_by_city: callsByCity
            }
        });
    } catch (error) {
        console.error('Error in GET /api/v1/stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
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

