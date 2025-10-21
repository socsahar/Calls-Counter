class AdminPanel {
    constructor() {
        this.init();
    }

    async init() {
        try {
            // Check authentication and admin status first
            if (!this.checkAuthentication()) {
                return;
            }

            // Ensure loading overlay is hidden at start
            this.setLoading(false);
            
            // Update admin name in header
            this.updateAdminInfo();
            
            this.bindEvents();
            await this.loadDashboard();
            
            console.log('🔧 MDA CallCounter Admin - Initialized successfully');
        } catch (error) {
            console.error('❌ Admin initialization error:', error);
            this.showToast('שגיאה באתחול ממשק המנהל', 'error');
        }
    }

    updateAdminInfo() {
        try {
            const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
            if (userData) {
                const user = JSON.parse(userData);
                const adminNameEl = document.getElementById('adminName');
                if (adminNameEl) {
                    const fullName = user.full_name || user.fullName || 'מנהל';
                    const mdaCode = user.mda_code || user.mdaCode || '';
                    adminNameEl.textContent = mdaCode ? `${fullName} (${mdaCode})` : fullName;
                }
            }
        } catch (error) {
            console.error('Error updating admin info:', error);
        }
    }

    checkAuthentication() {
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!token) {
            console.log('❌ No token found, redirecting to login');
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    bindEvents() {
        // Back button
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = '/index.html';
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadDashboard();
            });
        }

        // Action buttons
        document.getElementById('viewUsersBtn')?.addEventListener('click', () => {
            this.showUsersSection();
        });

        document.getElementById('viewAllCallsBtn')?.addEventListener('click', () => {
            this.showAllCallsSection();
        });

        document.getElementById('systemStatsBtn')?.addEventListener('click', () => {
            this.showSystemStats();
        });

        // Close section buttons
        document.getElementById('closeUsersBtn')?.addEventListener('click', () => {
            document.getElementById('usersSection').style.display = 'none';
        });

        document.getElementById('closeCallsBtn')?.addEventListener('click', () => {
            document.getElementById('allCallsSection').style.display = 'none';
        });
    }

    async loadDashboard() {
        try {
            this.setLoading(true);

            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch('/api/admin/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    this.showToast('אין הרשאות מנהל - מועבר לדף הראשי', 'error');
                    setTimeout(() => {
                        window.location.href = '/index.html';
                    }, 2000);
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📊 Dashboard data loaded:', data);

            this.displayDashboardStats(data.data);
            this.displayRecentActivity(data.data.recentCallsData);

        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showToast('שגיאה בטעינת נתוני המנהל', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    displayDashboardStats(data) {
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;

        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-content">
                    <div class="stat-number">${data.totalUsers}</div>
                    <div class="stat-label">סך המשתמשים</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">📞</div>
                <div class="stat-content">
                    <div class="stat-number">${data.totalCalls}</div>
                    <div class="stat-label">סך הקריאות</div>
                </div>
            </div>
            
            <div class="stat-card urgent">
                <div class="stat-icon">🚨</div>
                <div class="stat-content">
                    <div class="stat-number">${data.urgentCalls}</div>
                    <div class="stat-label">קריאות דחופות</div>
                </div>
            </div>
            
            <div class="stat-card atan">
                <div class="stat-icon">🔴</div>
                <div class="stat-content">
                    <div class="stat-number">${data.atanCalls}</div>
                    <div class="stat-label">קריאות אט"ן</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-content">
                    <div class="stat-number">${data.recentCalls}</div>
                    <div class="stat-label">קריאות בשבוע האחרון</div>
                </div>
            </div>
        `;
        
        // Display vehicles in separate section
        this.displayVehicleStats(data.vehicleStats);
        this.displayVehicleCallStats(data.vehicleCallStats || {
            motorcycleCalls: 0,
            picantoCalls: 0,
            ambulanceCalls: 0,
            personalStandbyCalls: 0
        });
    }

    displayVehicleStats(vehicleStats) {
        const vehiclesGrid = document.getElementById('vehiclesGrid');
        if (!vehiclesGrid || !vehicleStats) return;

        vehiclesGrid.innerHTML = `
            <div class="stat-card vehicles">
                <div class="stat-icon">🏍️</div>
                <div class="stat-content">
                    <div class="stat-number">${vehicleStats.motorcycles}</div>
                    <div class="stat-label">אופנועים</div>
                </div>
            </div>
            
            <div class="stat-card vehicles">
                <div class="stat-icon">🚗</div>
                <div class="stat-content">
                    <div class="stat-number">${vehicleStats.picantos}</div>
                    <div class="stat-label">פיקנטו</div>
                </div>
            </div>
            
            <div class="stat-card vehicles">
                <div class="stat-icon">🚑</div>
                <div class="stat-content">
                    <div class="stat-number">${vehicleStats.ambulances}</div>
                    <div class="stat-label">אמבולנסים</div>
                </div>
            </div>
            
            <div class="stat-card vehicles">
                <div class="stat-icon">👨‍⚕️</div>
                <div class="stat-content">
                    <div class="stat-number">${vehicleStats.personalStandby}</div>
                    <div class="stat-label">כונן אישי</div>
                </div>
            </div>
        `;
    }

    displayVehicleCallStats(vehicleCallStats) {
        const vehicleCallsGrid = document.getElementById('vehicleCallsGrid');
        if (!vehicleCallsGrid || !vehicleCallStats) return;

        vehicleCallsGrid.innerHTML = `
            <div class="stat-card vehicle-calls">
                <div class="stat-icon">🏍️</div>
                <div class="stat-content">
                    <div class="stat-number">${vehicleCallStats.motorcycleCalls}</div>
                    <div class="stat-label">קריאות אופנועים</div>
                </div>
            </div>
            
            <div class="stat-card vehicle-calls">
                <div class="stat-icon">🚗</div>
                <div class="stat-content">
                    <div class="stat-number">${vehicleCallStats.picantoCalls}</div>
                    <div class="stat-label">קריאות פיקנטו</div>
                </div>
            </div>
            
            <div class="stat-card vehicle-calls">
                <div class="stat-icon">🚑</div>
                <div class="stat-content">
                    <div class="stat-number">${vehicleCallStats.ambulanceCalls}</div>
                    <div class="stat-label">קריאות אמבולנסים</div>
                </div>
            </div>
            
            <div class="stat-card vehicle-calls">
                <div class="stat-icon">👨‍⚕️</div>
                <div class="stat-content">
                    <div class="stat-number">${vehicleCallStats.personalStandbyCalls}</div>
                    <div class="stat-label">קריאות כונן אישי</div>
                </div>
            </div>
        `;
    }

    displayVehicleCallStats(vehicleCallStats) {
        const vehicleCallsGrid = document.getElementById('vehicleCallsGrid');
        if (!vehicleCallsGrid) return;

        console.log('🚗 Vehicle call stats received:', vehicleCallStats);

        vehicleCallsGrid.innerHTML = `
            <div class="stat-card vehicle-calls">
                <div class="stat-icon">🏍️</div>
                <div class="stat-content">
                    <div class="stat-number">${vehicleCallStats?.motorcycleCalls || 0}</div>
                    <div class="stat-label">קריאות אופנועים</div>
                </div>
            </div>
            
            <div class="stat-card vehicle-calls">
                <div class="stat-icon">🚗</div>
                <div class="stat-content">
                    <div class="stat-number">${vehicleCallStats?.picantoCalls || 0}</div>
                    <div class="stat-label">קריאות פיקנטו</div>
                </div>
            </div>
            
            <div class="stat-card vehicle-calls">
                <div class="stat-icon">🚑</div>
                <div class="stat-content">
                    <div class="stat-number">${vehicleCallStats?.ambulanceCalls || 0}</div>
                    <div class="stat-label">קריאות אמבולנסים</div>
                </div>
            </div>
            
            <div class="stat-card vehicle-calls">
                <div class="stat-icon">👨‍⚕️</div>
                <div class="stat-content">
                    <div class="stat-number">${vehicleCallStats?.personalStandbyCalls || 0}</div>
                    <div class="stat-label">קריאות כונן אישי</div>
                </div>
            </div>
        `;
    }

    displayRecentActivity(calls) {
        const activityContainer = document.getElementById('activityContainer');
        if (!activityContainer || !calls) return;

        const recentCalls = calls.slice(0, 10);
        
        if (recentCalls.length === 0) {
            activityContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p class="empty-text">אין פעילות אחרונה</p>
                </div>
            `;
            return;
        }

        const activityHtml = recentCalls.map(call => {
            const callDate = new Date(call.call_date || call.created_at);
            const formattedDate = callDate.toLocaleDateString('he-IL');
            const formattedTime = call.start_time || 'לא צוין';
            
            let callTypeDisplay = call.call_type || 'לא צוין';
            if (callTypeDisplay === 'urgent') callTypeDisplay = '🚨 דחוף';
            else if (callTypeDisplay === 'דחוף') callTypeDisplay = '🚨 דחוף';
            else if (callTypeDisplay === 'atan') callTypeDisplay = '🔴 אט"ן';
            else if (callTypeDisplay === 'אט"ן') callTypeDisplay = '🔴 אט"ן';

            return `
                <div class="activity-item">
                    <div class="activity-header">
                        <span class="activity-type">${callTypeDisplay}</span>
                        <span class="activity-date">${formattedDate} ${formattedTime}</span>
                    </div>
                    <div class="activity-details">
                        <div class="activity-location">📍 ${call.location || 'לא צוין'}</div>
                        <div class="activity-status">${call.end_time ? '✅ הושלם' : '🔄 פעיל'}</div>
                    </div>
                </div>
            `;
        }).join('');

        activityContainer.innerHTML = activityHtml;
    }

    async showUsersSection() {
        try {
            this.setLoading(true);
            
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch users');
            
            const data = await response.json();
            this.displayUsers(data.users);
            
            document.getElementById('usersSection').style.display = 'block';
            document.getElementById('usersSection').scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error('Error loading users:', error);
            this.showToast('שגיאה בטעינת רשימת המשתמשים', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    displayUsers(users) {
        const usersContainer = document.getElementById('usersContainer');
        if (!usersContainer) return;

        console.log('👥 Users data received:', users);

        const usersHtml = users.map(user => {
            console.log('👤 User:', user.full_name, 'Username:', user.username);
            const joinDate = new Date(user.created_at).toLocaleDateString('he-IL');
            let vehicleType = 'לא צוין';
            let vehicleEmoji = '🚑';
            
            if (user.mda_code) {
                const num = user.mda_code.toString();
                if (num.startsWith('5')) {
                    vehicleType = 'אופנוע';
                    vehicleEmoji = '🏍️';
                } else if (num.startsWith('6')) {
                    vehicleType = 'פיקנטו';
                    vehicleEmoji = '🚗';
                } else if (num.length === 5 && (num.startsWith('1') || num.startsWith('2'))) {
                    vehicleType = 'כונן אישי';
                    vehicleEmoji = '👨‍⚕️';
                }
            }

            return `
                <div class="user-card" data-user-id="${user.id}">
                    <div class="user-header">
                        <div class="user-info">
                            <div class="user-name">${user.full_name && user.full_name.trim() !== '' ? user.full_name : user.username}</div>
                            <div class="user-details">
                                <span class="user-username">@${user.username}</span>
                                <span class="user-vehicle">${vehicleEmoji} ${vehicleType} ${user.mda_code || ''}</span>
                            </div>
                        </div>
                        <div class="user-badges">
                            ${user.is_admin ? '<span class="admin-badge">מנהל</span>' : ''}
                        </div>
                    </div>
                    <div class="user-details">
                        <div class="user-join-date">📅 הצטרף: ${joinDate}</div>
                    </div>
                    <div class="user-actions">
                        <button class="toggle-admin-btn" onclick="adminPanel.toggleUserAdmin('${user.id}', ${!user.is_admin})">
                            ${user.is_admin ? 'הסר הרשאות מנהל' : 'הפוך למנהל'}
                        </button>
                        <button class="delete-user-btn" onclick="adminPanel.deleteUser('${user.id}', '${user.username}')">
                            מחק משתמש
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        usersContainer.innerHTML = usersHtml;
    }

    async toggleUserAdmin(userId, makeAdmin) {
        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch(`/api/admin/users/${userId}/admin`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isAdmin: makeAdmin })
            });

            if (!response.ok) throw new Error('Failed to update admin status');
            
            const data = await response.json();
            this.showToast(data.message, 'success');
            
            // Refresh users list
            this.showUsersSection();

        } catch (error) {
            console.error('Error updating admin status:', error);
            this.showToast('שגיאה בעדכון הרשאות המנהל', 'error');
        }
    }

    async deleteUser(userId, username) {
        if (!confirm(`האם אתה בטוח שברצונך למחוק את המשתמש "${username}"?\nפעולה זו תמחק גם את כל הקריאות של המשתמש ולא ניתן לבטלה!`)) {
            return;
        }

        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to delete user');
            
            const data = await response.json();
            this.showToast(data.message, 'success');
            
            // Refresh dashboard and users list
            this.loadDashboard();
            this.showUsersSection();

        } catch (error) {
            console.error('Error deleting user:', error);
            this.showToast('שגיאה במחיקת המשתמש', 'error');
        }
    }

    async showAllCallsSection() {
        try {
            this.setLoading(true);
            
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch('/api/admin/calls', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch calls');
            
            const data = await response.json();
            this.displayAllCalls(data.calls);
            
            document.getElementById('allCallsSection').style.display = 'block';
            document.getElementById('allCallsSection').scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error('Error loading all calls:', error);
            this.showToast('שגיאה בטעינת כל הקריאות', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    displayAllCalls(calls) {
        const callsContainer = document.getElementById('allCallsContainer');
        if (!callsContainer) return;

        const callsHtml = calls.map(call => {
            const callDate = new Date(call.call_date || call.created_at);
            const formattedDate = callDate.toLocaleDateString('he-IL');
            const formattedTime = `${call.start_time}${call.end_time ? ` - ${call.end_time}` : ' (פעיל)'}`;
            
            let callTypeDisplay = call.call_type || 'לא צוין';
            if (callTypeDisplay === 'urgent') callTypeDisplay = '🚨 דחוף';
            else if (callTypeDisplay === 'דחוף') callTypeDisplay = '🚨 דחוף';
            else if (callTypeDisplay === 'atan') callTypeDisplay = '🔴 אט"ן';
            else if (callTypeDisplay === 'אט"ן') callTypeDisplay = '🔴 אט"ן';

            const duration = call.duration_minutes 
                ? `${call.duration_minutes} דקות`
                : (call.end_time ? 'לא חושב' : 'בתהליך');

            return `
                <div class="admin-call-item">
                    <div class="admin-call-header">
                        <div class="admin-call-type">${callTypeDisplay}</div>
                        <div class="admin-call-user">👤 ${call.users?.username || 'לא ידוע'}</div>
                        <div class="admin-call-date">${formattedDate}</div>
                    </div>
                    <div class="admin-call-content">
                        <div class="admin-call-time">⏰ ${formattedTime}</div>
                        <div class="admin-call-duration">⏱️ ${duration}</div>
                        <div class="admin-call-location">📍 ${call.location || 'לא צוין'}</div>
                        ${call.description ? `<div class="admin-call-description">💬 ${call.description}</div>` : ''}
                        <div class="admin-call-vehicle">
                            🚑 ${call.users?.vehicle_type || 'לא צוין'} ${call.users?.vehicle_number || ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        callsContainer.innerHTML = callsHtml;
    }

    showSystemStats() {
        this.showToast('סטטיסטיקות מערכת מוצגות בסקירה הכללית', 'info');
        document.querySelector('.dashboard-section').scrollIntoView({ behavior: 'smooth' });
    }

    setLoading(loading) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = loading ? 'flex' : 'none';
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 MDA CallCounter Admin - Starting initialization...');
    window.adminPanel = new AdminPanel();
});

// Handle visibility change to refresh data when tab becomes active
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.adminPanel) {
        window.adminPanel.loadDashboard();
    }
});