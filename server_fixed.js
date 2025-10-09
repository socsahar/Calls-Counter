// Add the corrected admin section with proper column names

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
        
        // Vehicle types distribution based on mda_code
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
                vehicleStats,
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
            .select('id, username, mda_code, created_at, is_admin')
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
        
        // Don't allow demoting the last admin
        if (!isAdmin) {
            const { data: currentAdmins } = await supabase
                .from('users')
                .select('id')
                .eq('is_admin', true);
                
            if (currentAdmins && currentAdmins.length <= 1) {
                return res.status(400).json({
                    success: false,
                    message: 'לא ניתן להסיר את המנהל האחרון'
                });
            }
        }
        
        const { data, error } = await supabase
            .from('users')
            .update({ is_admin: isAdmin })
            .eq('id', userId)
            .select();
        
        if (error) throw error;
        
        res.json({
            success: true,
            message: isAdmin ? 'המשתמש הוגדר כמנהל' : 'הרשאות מנהל הוסרו',
            user: data[0]
        });
        
    } catch (error) {
        console.error('❌ Update admin status error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בעדכון הרשאות המשתמש'
        });
    }
});

// Delete user (admin only)
app.delete('/api/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Don't allow deleting admin users
        const { data: user } = await supabase
            .from('users')
            .select('is_admin, username')
            .eq('id', userId)
            .single();
            
        if (user && user.is_admin) {
            return res.status(400).json({
                success: false,
                message: 'לא ניתן למחוק מנהל מערכת'
            });
        }
        
        // Delete user's calls first (if needed, or set up CASCADE in DB)
        await supabase
            .from('calls')
            .delete()
            .eq('user_id', userId);
        
        // Delete the user
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);
        
        if (error) throw error;
        
        res.json({
            success: true,
            message: 'המשתמש נמחק בהצלחה'
        });
        
    } catch (error) {
        console.error('❌ Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה במחיקת המשתמש'
        });
    }
});

app.listen(PORT, () => {
    console.log(`🏍️  MDA CallCounter Server running on port ${PORT}`);
    console.log(`🚑  Motorcycle: ${process.env.MOTORCYCLE_NUMBER || '5248'}`);
    console.log(`🗄️  Database: ${supabaseUrl ? 'Connected' : 'Not configured'}`);
    console.log(`🌍  Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;