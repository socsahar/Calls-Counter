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

            const { data: users, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email.toLowerCase())
                .limit(1);

            if (error || !users || users.length === 0) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ success: false, message: 'אימייל או סיסמה שגויים' })
                };
            }

            const user = users[0];
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

            if (hashedPassword !== user.password_hash) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ success: false, message: 'אימייל או סיסמה שגויים' })
                };
            }

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
