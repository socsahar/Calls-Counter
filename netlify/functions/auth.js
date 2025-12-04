const { supabase } = require('./shared/supabase');
const { generateToken } = require('./shared/auth');
const crypto = require('crypto');

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

            // Try to find user by email, full_name, or mda_code
            let users = null;
            let error = null;

            // First try email
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
            console.log('✅ User found:', user.email, user.full_name, user.mda_code);
            
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            console.log('🔐 Password check - Input hash:', hashedPassword.substring(0, 10), 'Stored hash:', user.password_hash?.substring(0, 10));

            if (hashedPassword !== user.password_hash) {
                console.log('❌ Password mismatch');
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ success: false, message: 'סיסמה שגויה' })
                };
            }
            
            console.log('✅ Login successful');

            const token = generateToken(user);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'התחברת בהצלחה!',
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        full_name: user.full_name,
                        mda_code: user.mda_code,
                        role: user.role
                    }
                })
            };
        }

        // POST /api/auth/register
        if (event.httpMethod === 'POST' && isRegister) {
            const { email, password, fullName, mdaCode } = JSON.parse(event.body);

            if (!email || !password || !fullName || !mdaCode) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: 'נא למלא את כל השדות' })
                };
            }

            const { data: existingUsers } = await supabase
                .from('users')
                .select('id')
                .eq('email', email.toLowerCase())
                .limit(1);

            if (existingUsers && existingUsers.length > 0) {
                return {
                    statusCode: 409,
                    headers,
                    body: JSON.stringify({ success: false, message: 'משתמש עם אימייל זה כבר קיים' })
                };
            }

            const { data: existingMdaCodes } = await supabase
                .from('users')
                .select('id')
                .eq('mda_code', mdaCode)
                .limit(1);

            if (existingMdaCodes && existingMdaCodes.length > 0) {
                return {
                    statusCode: 409,
                    headers,
                    body: JSON.stringify({ success: false, message: 'קוד MDA זה כבר רשום במערכת' })
                };
            }

            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

            const { data: newUser, error } = await supabase
                .from('users')
                .insert([{
                    email: email.toLowerCase(),
                    password_hash: hashedPassword,
                    full_name: fullName,
                    mda_code: mdaCode,
                    role: 'user'
                }])
                .select()
                .single();

            if (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'שגיאה ביצירת משתמש' })
                };
            }

            const token = generateToken(newUser);

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'נרשמת בהצלחה!',
                    token,
                    user: {
                        id: newUser.id,
                        email: newUser.email,
                        full_name: newUser.full_name,
                        mda_code: newUser.mda_code,
                        role: newUser.role
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
                .select('id, email, full_name, mda_code, role')
                .eq('id', authResult.user.id)
                .single();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, user })
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
