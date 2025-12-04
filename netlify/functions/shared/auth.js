const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mda-callcounter-secret-key-2025';

function authenticateToken(headers) {
    const authHeader = headers.authorization || headers.Authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return { error: 'Authentication required', statusCode: 401 };
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        return { user };
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return { error: 'Invalid or expired token', statusCode: 403 };
    }
}

function generateToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email,
            full_name: user.full_name,
            mda_code: user.mda_code,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

module.exports = { authenticateToken, generateToken, JWT_SECRET };
