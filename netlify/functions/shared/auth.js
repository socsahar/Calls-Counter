const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mda-callcounter-secret-key-2025';

function authenticateToken(headers) {
    const authHeader = headers.authorization || headers.Authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return { error: 'Authentication required', statusCode: 401 };
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Return user object with Render-compatible structure
        const user = {
            user_id: decoded.userId,
            username: decoded.username,
            mda_code: decoded.mdaCode,
            full_name: decoded.fullName,
            is_admin: decoded.isAdmin || false
        };
        return { user };
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return { error: 'Invalid or expired token', statusCode: 403 };
    }
}

function generateToken(user) {
    return jwt.sign(
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
}

module.exports = { authenticateToken, generateToken, JWT_SECRET };
