const { supabase } = require('./shared/supabase');
const { generateToken, JWT_SECRET } = require('./shared/auth');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Parse the endpoint from path
    const path = event.path;
    const isLogin = path.includes('/login');
    const isRegister = path.includes('/register');
    const isVerify = path.includes('/verify');
    
    try {
        // POST /api/auth/login
        if (event.httpMethod === 'POST' && isLogin) {
            const body = JSON.parse(event.body);
            const email = body.email || body.username; // Support both email and username fields
            const password = body.password;
            const rememberMe = body.rememberMe;

            if (!email || !password) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: 'נא למלא את כל השדות' })
                };
            }

            // Try to find user by username, email, full_name, or mda_code
            let users = null;
            let error = null;

            // First try username (primary login field)
            const usernameResult = await supabase
                .from('users')
                .select('*')
                .eq('username', email)
                .limit(1);
            
            if (usernameResult.data && usernameResult.data.length > 0) {
                users = usernameResult.data;
            } else {
                // Try email
                const emailResult = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', email.toLowerCase())
                    .limit(1);
                
                if (emailResult.data && emailResult.data.length > 0) {
                    users = emailResult.data;
                } else {
                    // Try by full_name
                    const nameResult = await supabase
                        .from('users')
                        .select('*')
                        .eq('full_name', email)
                        .limit(1);
                    
                    if (nameResult.data && nameResult.data.length > 0) {
                        users = nameResult.data;
                    } else {
                        // Try by mda_code
                        const mdaResult = await supabase
                            .from('users')
                            .select('*')
                            .eq('mda_code', email)
                            .limit(1);
                        
                        users = mdaResult.data;
                        error = mdaResult.error;
                    }
                }
            }

            if (error || !users || users.length === 0) {
                console.log('❌ User not found. Searched for:', email);
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ 
                        success: false, 
                        message: 'משתמש לא נמצא. נסה עם מייל, שם מלא או קוד MDA' 
                    })
                };
            }

            const user = users[0];
            console.log('✅ User found:', user.email, user.full_name, user.username, user.mda_code);
            
            // Use Supabase RPC to authenticate (uses bcrypt)
            const { data: authData, error: authError } = await supabase
                .rpc('authenticate_user', {
                    p_username: user.username,
                    p_password: password
                });

            console.log('🔐 Auth RPC result:', authData ? 'success' : 'failed', authError ? authError.message : '');

            if (authError || !authData || authData.length === 0) {
                console.log('❌ Password mismatch');
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ success: false, message: 'סיסמה שגויה' })
                };
            }
            
            console.log('✅ Login successful');

            // Generate JWT token with Render-compatible structure
            const token = jwt.sign(
                {
                    userId: user.user_id,
                    username: user.username,
                    mdaCode: user.mda_code,
                    fullName: user.full_name,
                    isAdmin: user.is_admin || false
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'התחברת בהצלחה',
                    token,
                    user: {
                        id: user.user_id,
                        fullName: user.full_name,
                        username: user.username,
                        mdaCode: user.mda_code,
                        isAdmin: user.is_admin || false
                    }
                })
            };
        }

        // POST /api/auth/register
        if (event.httpMethod === 'POST' && isRegister) {
            const { email, password, fullName, username, mdaCode, phone } = JSON.parse(event.body);

            if (!fullName || !username || !password || !mdaCode) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: 'נא למלא את כל השדות החובה' })
                };
            }

            if (password.length < 6) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: 'סיסמה חייבת להיות באורך של 6 תווים לפחות' })
                };
            }

            // Check for existing username
            const { data: existingUsername } = await supabase
                .from('users')
                .select('user_id')
                .eq('username', username)
                .limit(1);

            if (existingUsername && existingUsername.length > 0) {
                return {
                    statusCode: 409,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שם משתמש זה כבר קיים' })
                };
            }

            // Check for existing MDA code
            const { data: existingMdaCodes } = await supabase
                .from('users')
                .select('user_id')
                .eq('mda_code', mdaCode)
                .limit(1);

            if (existingMdaCodes && existingMdaCodes.length > 0) {
                return {
                    statusCode: 409,
                    headers,
                    body: JSON.stringify({ success: false, message: 'קוד MDA זה כבר רשום במערכת' })
                };
            }

            // Use RPC function to create user with proper bcrypt hashing
            const { data: newUserId, error: createError } = await supabase
                .rpc('create_user', {
                    p_full_name: fullName,
                    p_username: username,
                    p_password: password,
                    p_mda_code: mdaCode,
                    p_phone: phone || null,
                    p_email: email ? email.toLowerCase() : null
                });

            if (createError) {
                console.error('Registration error:', createError);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה ביצירת משתמש' })
                };
            }

            // Fetch the created user
            const { data: newUser, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .eq('user_id', newUserId)
                .single();

            if (fetchError || !newUser) {
                console.error('Fetch user error:', fetchError);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה בטעינת פרטי משתמש' })
                };
            }

            const token = jwt.sign(
                {
                    userId: newUser.user_id,
                    username: newUser.username,
                    mdaCode: newUser.mda_code,
                    fullName: newUser.full_name,
                    isAdmin: false
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'נרשמת בהצלחה!',
                    token,
                    user: {
                        id: newUser.user_id,
                        username: newUser.username,
                        fullName: newUser.full_name,
                        mdaCode: newUser.mda_code,
                        isAdmin: false
                    }
                })
            };
        }

        // GET /api/auth/verify
        if (event.httpMethod === 'GET' && isVerify) {
            const { authenticateToken } = require('./shared/auth');
            const authResult = authenticateToken(event.headers);

            if (authResult.error) {
                return {
                    statusCode: authResult.statusCode,
                    headers,
                    body: JSON.stringify({ success: false, message: authResult.error })
                };
            }

            const { data: user } = await supabase
                .from('users')
                .select('user_id, email, username, full_name, mda_code, is_admin')
                .eq('user_id', authResult.user.user_id)
                .single();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    user: {
                        id: user.user_id,
                        fullName: user.full_name,
                        username: user.username,
                        mdaCode: user.mda_code,
                        isAdmin: user.is_admin
                    }
                })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, message: 'Not found' })
        };

    } catch (error) {
        console.error('Auth error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'שגיאת שרת' })
        };
    }
};
