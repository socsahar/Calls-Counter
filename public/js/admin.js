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
                const fullName = user.full_name || user.fullName || 'מנהל';
                const mdaCode = user.mda_code || user.mdaCode || '';
                const displayName = mdaCode ? `${fullName} (${mdaCode})` : fullName;
                
                // Update desktop admin name
                const adminNameEl = document.getElementById('adminName');
                if (adminNameEl) {
                    adminNameEl.textContent = displayName;
                }
                
                // Update mobile admin name
                const mobileAdminNameEl = document.getElementById('mobileAdminName');
                if (mobileAdminNameEl) {
                    mobileAdminNameEl.textContent = displayName;
                }
            }
        } catch (error) {
            console.error('Error updating admin info:', error);
        }
    }

    checkAuthentication() {
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!token) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    bindEvents() {
        // Header navigation buttons
        const mainPageBtn = document.getElementById('mainPageBtn');
        if (mainPageBtn) {
            mainPageBtn.addEventListener('click', () => {
                window.location.href = '/index.html';
            });
        }

        const entryCodesBtn = document.getElementById('entryCodesBtn');
        if (entryCodesBtn) {
            entryCodesBtn.addEventListener('click', () => {
                window.location.href = '/entry-codes.html';
            });
        }

        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                window.location.href = '/history.html';
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('האם אתה בטוח שברצונך להתנתק?')) {
                    this.logout();
                }
            });
        }

        // Mobile menu functionality
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
        const mobileMenuClose = document.getElementById('mobileMenuClose');

        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenuOverlay.classList.add('active');
                mobileMenuBtn.classList.add('active');
            });
        }

        if (mobileMenuClose) {
            mobileMenuClose.addEventListener('click', () => {
                mobileMenuOverlay.classList.remove('active');
                mobileMenuBtn.classList.remove('active');
            });
        }

        if (mobileMenuOverlay) {
            mobileMenuOverlay.addEventListener('click', (e) => {
                if (e.target === mobileMenuOverlay) {
                    mobileMenuOverlay.classList.remove('active');
                    mobileMenuBtn.classList.remove('active');
                }
            });
        }

        // Mobile menu buttons
        const mobileMainPageBtn = document.getElementById('mobileMainPageBtn');
        if (mobileMainPageBtn) {
            mobileMainPageBtn.addEventListener('click', () => {
                window.location.href = '/index.html';
            });
        }

        const mobileEntryCodesBtn = document.getElementById('mobileEntryCodesBtn');
        if (mobileEntryCodesBtn) {
            mobileEntryCodesBtn.addEventListener('click', () => {
                window.location.href = '/entry-codes.html';
            });
        }

        const mobileHistoryBtn = document.getElementById('mobileHistoryBtn');
        if (mobileHistoryBtn) {
            mobileHistoryBtn.addEventListener('click', () => {
                window.location.href = '/history.html';
            });
        }

        const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', () => {
                if (confirm('האם אתה בטוח שברצונך להתנתק?')) {
                    this.logout();
                }
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

        document.getElementById('viewUserCallStatsBtn')?.addEventListener('click', () => {
            this.showUserCallStatsSection();
        });

        document.getElementById('viewAllCallsBtn')?.addEventListener('click', () => {
            this.showAllCallsSection();
        });

        document.getElementById('manageCodesBtn')?.addEventListener('click', () => {
            this.showCodesSection();
        });

        document.getElementById('manageEntryCodesBtn')?.addEventListener('click', () => {
            this.showEntryCodesSection();
        });

        document.getElementById('manageApiKeysBtn')?.addEventListener('click', () => {
            this.showApiKeysSection();
        });

        // Close section buttons
        document.getElementById('closeUsersBtn')?.addEventListener('click', () => {
            document.getElementById('usersSection').style.display = 'none';
        });

        document.getElementById('closeUserCallStatsBtn')?.addEventListener('click', () => {
            document.getElementById('userCallStatsSection').style.display = 'none';
        });

        document.getElementById('closeCallsBtn')?.addEventListener('click', () => {
            document.getElementById('allCallsSection').style.display = 'none';
        });

        document.getElementById('closeCodesBtn')?.addEventListener('click', () => {
            document.getElementById('codesSection').style.display = 'none';
        });

        document.getElementById('closeApiKeysBtn')?.addEventListener('click', () => {
            document.getElementById('apiKeysSection').style.display = 'none';
        });

        // Codes management
        this.bindCodesEvents();
    }

    closeAllSections() {
        document.getElementById('usersSection').style.display = 'none';
        document.getElementById('userCallStatsSection').style.display = 'none';
        document.getElementById('allCallsSection').style.display = 'none';
        document.getElementById('codesSection').style.display = 'none';
        document.getElementById('entryCodesSection').style.display = 'none';
        document.getElementById('apiKeysSection').style.display = 'none';
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
            
            // Close all other sections first
            this.closeAllSections();
            
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            // Add cache-busting parameter to force fresh data
            const response = await fetch(`/api/admin/users?_=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                cache: 'no-store'
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

        const usersHtml = users.map(user => {
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
                } else if (
                    num.length === 5 &&
                    (
                        ['1','2','3'].some(prefix => num.startsWith(prefix)) ||
                        num === '99999'
                    )
                ) {
                    vehicleType = 'כונן אישי';
                    vehicleEmoji = '👨‍⚕️';
                }
            }

            return `
                <div class="user-list-item" data-user-id="${user.id}">
                    <div class="user-list-info">
                        <div class="user-list-main">
                            <span class="user-list-name">${user.full_name && user.full_name.trim() !== '' ? user.full_name : user.username}</span>
                            ${user.is_admin ? '<span class="admin-badge">מנהל</span>' : ''}
                        </div>
                        <div class="user-list-details">
                            <span class="user-list-username">👤 @${user.username}</span>
                            <span class="user-list-vehicle">${vehicleEmoji} ${vehicleType} ${user.mda_code || ''}</span>
                            <span class="user-list-date">📅 ${joinDate}</span>
                        </div>
                    </div>
                    <div class="user-list-actions">
                        <button class="toggle-admin-btn" data-user-id="${user.id}" data-is-admin="${user.is_admin}">
                            ${user.is_admin ? 'הסר הרשאות' : 'הפוך למנהל'}
                        </button>
                        <button class="delete-user-btn" data-user-id="${user.id}" data-username="${user.username}">
                            מחק
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        usersContainer.innerHTML = usersHtml;
        
        // Attach event listeners after rendering
        usersContainer.querySelectorAll('.toggle-admin-btn').forEach(btn => {
            btn.onclick = () => {
                const userId = btn.getAttribute('data-user-id');
                const isAdmin = btn.getAttribute('data-is-admin') === 'true';
                this.toggleUserAdmin(userId, !isAdmin);
            };
        });
        
        usersContainer.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.onclick = () => {
                const userId = btn.getAttribute('data-user-id');
                const username = btn.getAttribute('data-username');
                this.deleteUser(userId, username);
            };
        });
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
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Delete failed:', errorData);
                throw new Error(errorData.message || 'Failed to delete user');
            }
            
            const data = await response.json();
            this.showToast(data.message, 'success');
            
            // Hide the section first to force a complete refresh
            document.getElementById('usersSection').style.display = 'none';
            
            // Refresh dashboard and users list
            await this.loadDashboard();
            
            // Force a fresh fetch by calling showUsersSection after a small delay
            setTimeout(async () => {
                await this.showUsersSection();
            }, 100);


        } catch (error) {
            console.error('Error deleting user:', error);
            this.showToast('שגיאה במחיקת המשתמש', 'error');
        }
    }

    async showUserCallStatsSection() {
        try {
            this.setLoading(true);
            
            // Close all other sections first
            this.closeAllSections();
            
            // Populate year options
            this.populateYearOptions();
            
            // Load initial data
            await this.loadUserCallStats();
            
            document.getElementById('userCallStatsSection').style.display = 'block';
            document.getElementById('userCallStatsSection').scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error('Error loading user call stats:', error);
            this.showToast('שגיאה בטעינת סטטיסטיקת הקריאות', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    populateYearOptions() {
        const yearSelect = document.getElementById('userStatsYear');
        if (!yearSelect) return;

        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '<option value="">כל השנים</option>';
        
        // Add years from current year back to 2025
        for (let year = currentYear; year >= 2025; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        }
        
        // Add event listener to update months when year changes
        yearSelect.addEventListener('change', () => {
            this.updateMonthOptions();
        });
        
        // Update month options for the initially selected year
        this.updateMonthOptions();
    }

    updateMonthOptions() {
        const yearSelect = document.getElementById('userStatsYear');
        const monthSelect = document.getElementById('userStatsMonth');
        if (!yearSelect || !monthSelect) return;
        
        const selectedYear = parseInt(yearSelect.value);
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // 1-12
        
        // Get all month options (skip the first "all months" option)
        const monthOptions = monthSelect.querySelectorAll('option:not([value=""])');
        
        if (selectedYear === 0 || !selectedYear) {
            // No year selected - show all months
            monthOptions.forEach(option => {
                option.style.display = '';
                option.disabled = false;
            });
        } else {
            monthOptions.forEach(option => {
                const monthValue = parseInt(option.value);
                
                if (selectedYear === 2025) {
                    // For 2025: only show October (10) onwards
                    option.style.display = monthValue >= 10 ? '' : 'none';
                    option.disabled = monthValue < 10;
                } else if (selectedYear === currentYear) {
                    // For current year: show months from January up to current month
                    option.style.display = monthValue <= currentMonth ? '' : 'none';
                    option.disabled = monthValue > currentMonth;
                } else if (selectedYear < currentYear) {
                    // For past years: show all months
                    option.style.display = '';
                    option.disabled = false;
                } else {
                    // For future years: hide all months
                    option.style.display = 'none';
                    option.disabled = true;
                }
            });
        }
        
        // If currently selected month is now hidden/disabled, reset to "all months"
        const selectedMonth = parseInt(monthSelect.value);
        if (selectedMonth) {
            const selectedOption = monthSelect.querySelector(`option[value="${selectedMonth}"]`);
            if (selectedOption && (selectedOption.style.display === 'none' || selectedOption.disabled)) {
                monthSelect.value = ''; // Reset to "all months"
            }
        }
    }

    async loadUserCallStats() {
        const year = document.getElementById('userStatsYear').value;
        const month = document.getElementById('userStatsMonth').value;

        try {
            this.setLoading(true);
            
            // Build fetch URL with year/month parameters
            const params = new URLSearchParams();
            if (year) {
                params.append('year', year);
            }
            if (month) {
                params.append('month', month);
            }

            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const url = `/api/admin/user-call-stats${params.toString() ? '?' + params.toString() : ''}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch user call stats');
            
            const data = await response.json();
            
            // Store for client-side filtering
            this.userCallStatsData = data.userStats;
            
            // Bind filters and display
            this.bindUserStatsFilters(data.userStats);

        } catch (error) {
            console.error('Error loading user call stats:', error);
            this.showToast('שגיאה בטעינת סטטיסטיקת הקריאות', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    displayUserCallStats(stats) {
        const container = document.getElementById('userCallStatsContainer');
        if (!container) return;

        // Get the selected year and month to determine what period is being displayed
        const year = document.getElementById('userStatsYear').value;
        const month = document.getElementById('userStatsMonth').value;
        
        // Determine the period label and what to call the stats
        let periodLabel = 'כל הזמן';
        let todaysCallsLabel = 'קריאות היום';
        
        if (year && month) {
            const monthNames = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
                               'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
            periodLabel = `${monthNames[month]} ${year}`;
            todaysCallsLabel = 'קריאות בחודש זה';
        } else if (year) {
            periodLabel = `שנת ${year}`;
            todaysCallsLabel = 'קריאות בשנה זו';
        }

        const statsHtml = stats.map(user => {
            const vehicleEmoji = this.getVehicleEmoji(user.mda_code);
            const vehicleType = this.getVehicleType(user.mda_code);
            const joinDate = new Date(user.created_at).toLocaleDateString('he-IL');
            
            // Format call type breakdown
            const callTypeItems = Object.entries(user.callTypeBreakdown)
                .map(([type, count]) => `<div class="call-type-item"><span class="call-type-name">${type}</span><span class="call-type-count">${count}</span></div>`)
                .join('');

            return `
                <div class="user-stats-card" data-user-id="${user.user_id}" data-user-name="${user.full_name}" data-total-calls="${user.totalCalls}" data-todays-calls="${user.todaysCalls}" data-hours="${user.totalHours}">
                    <div class="stats-card-header">
                        <div class="user-info">
                            <div class="user-name">${user.full_name || user.username}</div>
                            <div class="user-details">
                                <span class="username">@${user.username}</span>
                                <span class="vehicle-info">${vehicleEmoji} ${vehicleType} ${user.mda_code || 'N/A'}</span>
                                ${user.is_admin ? '<span class="admin-badge-small">מנהל</span>' : ''}
                            </div>
                        </div>
                        <div class="period-indicator">${periodLabel}</div>
                    </div>
                    
                    <div class="stats-grid-card">
                        <div class="stat-box">
                            <div class="stat-label">סה"כ קריאות</div>
                            <div class="stat-value">${user.totalCalls}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">${todaysCallsLabel}</div>
                            <div class="stat-value">${user.todaysCalls}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">סה"כ שעות</div>
                            <div class="stat-value">${user.totalHours}</div>
                        </div>
                    </div>
                    
                    ${callTypeItems ? `
                    <div class="call-types-breakdown">
                        <div class="breakdown-title">חלוקה לפי סוג קריאה</div>
                        <div class="call-types-list">
                            ${callTypeItems}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = statsHtml || '<p class="empty-message">אין נתונים להצגה</p>';
    }

    getVehicleEmoji(mdaCode) {
        if (!mdaCode) return '🚑';
        const num = mdaCode.toString();
        if (num.startsWith('5')) return '🏍️';
        if (num.startsWith('6')) return '🚗';
        if (num.length === 5 && (num.startsWith('1') || num.startsWith('2'))) return '👨‍⚕️';
        return '🚑';
    }

    getVehicleType(mdaCode) {
        if (!mdaCode) return 'לא צוין';
        const num = mdaCode.toString();
        if (num.startsWith('5')) return 'אופנוע';
        if (num.startsWith('6')) return 'פיקנטו';
        if (num.length === 5 && (num.startsWith('1') || num.startsWith('2'))) return 'כונן אישי';
        return 'לא צוין';
    }

    bindUserStatsFilters(allStats) {
        const searchInput = document.getElementById('userStatsSearchInput');
        const yearSelect = document.getElementById('userStatsYear');
        const monthSelect = document.getElementById('userStatsMonth');
        const sortSelect = document.getElementById('userStatsSortBy');

        const filterAndSort = () => {
            const searchTerm = (searchInput?.value || '').toLowerCase();
            const sortBy = sortSelect?.value || 'name';
            
            let filteredStats = allStats.filter(user => {
                const name = (user.full_name || user.username).toLowerCase();
                const username = user.username.toLowerCase();
                return name.includes(searchTerm) || username.includes(searchTerm);
            });

            // Sort
            filteredStats.sort((a, b) => {
                switch (sortBy) {
                    case 'totalCalls':
                        return b.totalCalls - a.totalCalls;
                    case 'todaysCalls':
                        return b.todaysCalls - a.todaysCalls;
                    case 'hours':
                        return b.totalHours - a.totalHours;
                    case 'name':
                    default:
                        return (a.full_name || a.username).localeCompare(b.full_name || b.username, 'he');
                }
            });

            this.displayUserCallStats(filteredStats);
        };

        // Search and sort event listeners
        if (searchInput) {
            searchInput.addEventListener('input', filterAndSort);
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', filterAndSort);
        }

        // Year and month change event listeners
        if (yearSelect) {
            yearSelect.addEventListener('change', () => {
                this.updateMonthOptions();
                this.loadUserCallStats();
            });
        }

        if (monthSelect) {
            monthSelect.addEventListener('change', () => {
                this.loadUserCallStats();
            });
        }

        // Initial display
        filterAndSort();
    }

    async showAllCallsSection() {
        try {
            this.setLoading(true);
            
            // Close all other sections first
            this.closeAllSections();
            
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
                <div class="call-item">
                    <div class="call-header">
                        <div class="call-type-badge ${callTypeDisplay.includes('דחוף') ? 'urgent' : callTypeDisplay.includes('אט') ? 'atan' : ''}">
                            ${callTypeDisplay}
                        </div>
                        <div class="call-date">${formattedDate}</div>
                    </div>
                    <div class="call-body">
                        <div class="call-row">
                            <span class="call-label">👤 משתמש:</span>
                            <span class="call-value">${call.users?.username || 'לא ידוע'}</span>
                        </div>
                        <div class="call-row">
                            <span class="call-label">⏰ זמן:</span>
                            <span class="call-value">${formattedTime}</span>
                        </div>
                        <div class="call-row">
                            <span class="call-label">⏱️ משך:</span>
                            <span class="call-value">${duration}</span>
                        </div>
                        <div class="call-row">
                            <span class="call-label">📍 מיקום:</span>
                            <span class="call-value">${call.city || ''} ${call.street || ''} ${call.location || 'לא צוין'}</span>
                        </div>
                        ${call.description ? `
                            <div class="call-row">
                                <span class="call-label">📝 תיאור:</span>
                                <span class="call-value">${call.description}</span>
                            </div>
                        ` : ''}
                        <div class="call-row">
                            <span class="call-label">🚑 רכב:</span>
                            <span class="call-value">${call.vehicle_number || call.users?.vehicle_number || 'לא צוין'}</span>
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

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== CODES MANAGEMENT =====

    bindCodesEvents() {
        // Tab switching
        document.querySelectorAll('.codes-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchCodesTab(tabName);
            });
        });

        // Add buttons
        document.getElementById('addAlertCodeBtn')?.addEventListener('click', () => {
            this.openCodeModal('alert');
        });

        document.getElementById('addMedicalCodeBtn')?.addEventListener('click', () => {
            this.openCodeModal('medical');
        });

        // Modal close
        document.getElementById('codeModalClose')?.addEventListener('click', () => {
            document.getElementById('codeModal').classList.add('hidden');
        });

        document.getElementById('codeModalCancel')?.addEventListener('click', () => {
            document.getElementById('codeModal').classList.add('hidden');
        });

        // Form submit
        document.getElementById('codeForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCodeSubmit();
        });
    }

    switchCodesTab(tabName) {
        // Update tabs
        document.querySelectorAll('.codes-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update content
        document.getElementById('alertCodesTab').classList.toggle('hidden', tabName !== 'alert');
        document.getElementById('medicalCodesTab').classList.toggle('hidden', tabName !== 'medical');
    }

    async showCodesSection() {
        try {
            this.setLoading(true);
            
            // Close all other sections first
            this.closeAllSections();
            
            await this.loadAlertCodes();
            await this.loadMedicalCodes();
            document.getElementById('codesSection').style.display = 'block';
            document.getElementById('codesSection').scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('Error loading codes:', error);
            this.showToast('שגיאה בטעינת הקודים', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async loadAlertCodes() {
        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch('/api/admin/codes/alert', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch alert codes');

            const result = await response.json();
            this.displayAlertCodes(result.data || []);
        } catch (error) {
            console.error('Error loading alert codes:', error);
            this.showToast('שגיאה בטעינת קודי הזנקה', 'error');
        }
    }

    async loadMedicalCodes() {
        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch('/api/admin/codes/medical', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch medical codes');

            const result = await response.json();
            this.displayMedicalCodes(result.data || []);
        } catch (error) {
            console.error('Error loading medical codes:', error);
            this.showToast('שגיאה בטעינת קודים רפואיים', 'error');
        }
    }

    displayAlertCodes(codes) {
        const container = document.getElementById('alertCodesContainer');
        if (!container) return;

        if (codes.length === 0) {
            container.innerHTML = '<div class="empty-state">אין קודי הזנקה במערכת</div>';
            return;
        }

        const html = codes.map(code => `
            <div class="code-item">
                <div class="code-info">
                    <div class="code-name">${code.code}</div>
                </div>
                <div class="code-actions">
                    <button onclick="adminPanel.editCode('alert', ${code.id})" class="btn-edit">✏️ ערוך</button>
                    <button onclick="adminPanel.deleteCode('alert', ${code.id})" class="btn-delete">🗑️ מחק</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    displayMedicalCodes(codes) {
        const container = document.getElementById('medicalCodesContainer');
        if (!container) return;

        if (codes.length === 0) {
            container.innerHTML = '<div class="empty-state">אין קודים רפואיים במערכת</div>';
            return;
        }

        const html = codes.map(code => `
            <div class="code-item">
                <div class="code-info">
                    <div class="code-name">${code.code}</div>
                </div>
                <div class="code-actions">
                    <button onclick="adminPanel.editCode('medical', ${code.id})" class="btn-edit">✏️ ערוך</button>
                    <button onclick="adminPanel.deleteCode('medical', ${code.id})" class="btn-delete">🗑️ מחק</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    openCodeModal(type, codeData = null) {
        const modal = document.getElementById('codeModal');
        const title = document.getElementById('codeModalTitle');
        const form = document.getElementById('codeForm');

        document.getElementById('codeType').value = type;

        if (codeData) {
            title.textContent = 'ערוך קוד';
            document.getElementById('codeId').value = codeData.id;
            document.getElementById('codeValue').value = codeData.code;
        } else {
            title.textContent = 'הוסף קוד חדש';
            form.reset();
            document.getElementById('codeId').value = '';
        }

        modal.classList.remove('hidden');
    }

    async editCode(type, id) {
        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch(`/api/admin/codes/${type}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch code');

            const result = await response.json();
            const code = result.data.find(c => c.id == id);

            if (code) {
                this.openCodeModal(type, code);
            }
        } catch (error) {
            console.error('Error loading code for edit:', error);
            this.showToast('שגיאה בטעינת הקוד', 'error');
        }
    }

    async handleCodeSubmit() {
        try {
            const codeId = document.getElementById('codeId').value;
            const codeType = document.getElementById('codeType').value;
            const codeData = {
                code: document.getElementById('codeValue').value
            };

            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const url = codeId
                ? `/api/admin/codes/${codeType}/${codeId}`
                : `/api/admin/codes/${codeType}`;
            const method = codeId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(codeData)
            });

            if (!response.ok) throw new Error('Failed to save code');

            const result = await response.json();
            this.showToast(result.message, 'success');

            document.getElementById('codeModal').classList.add('hidden');

            // Reload codes
            if (codeType === 'alert') {
                await this.loadAlertCodes();
            } else {
                await this.loadMedicalCodes();
            }
        } catch (error) {
            console.error('Error saving code:', error);
            this.showToast('שגיאה בשמירת הקוד', 'error');
        }
    }

    async deleteCode(type, id) {
        if (!confirm('האם אתה בטוח שברצונך למחוק קוד זה?')) {
            return;
        }

        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch(`/api/admin/codes/${type}/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to delete code');

            const result = await response.json();
            this.showToast(result.message, 'success');

            // Reload codes
            if (type === 'alert') {
                await this.loadAlertCodes();
            } else {
                await this.loadMedicalCodes();
            }
        } catch (error) {
            console.error('Error deleting code:', error);
            this.showToast('שגיאה במחיקת הקוד', 'error');
        }
    }

    // ============================================
    // ENTRY CODES MANAGEMENT
    // ============================================

    async showEntryCodesSection() {
        // Close all other sections first
        this.closeAllSections();
        
        const section = document.getElementById('entryCodesSection');
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
        
        await this.loadEntryCodesForAdmin();
        this.bindEntryCodesEvents();
    }

    bindEntryCodesEvents() {
        // Add entry code button
        const addBtn = document.getElementById('addEntryCodeBtn');
        if (addBtn && !addBtn.hasListener) {
            addBtn.hasListener = true;
            addBtn.addEventListener('click', () => {
                this.showEntryCodeForm();
            });
        }

        // Close section button
        const closeBtn = document.getElementById('closeEntryCodesBtn');
        if (closeBtn && !closeBtn.hasListener) {
            closeBtn.hasListener = true;
            closeBtn.addEventListener('click', () => {
                document.getElementById('entryCodesSection').style.display = 'none';
            });
        }

        // Cancel form button
        const cancelBtn = document.getElementById('cancelFormBtn');
        if (cancelBtn && !cancelBtn.hasListener) {
            cancelBtn.hasListener = true;
            cancelBtn.addEventListener('click', () => {
                this.hideEntryCodeForm();
            });
        }

        // Form submit
        const form = document.getElementById('entryCodeForm');
        if (form && !form.hasListener) {
            form.hasListener = true;
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleEntryCodeSubmit();
            });
        }
    }

    showEntryCodeForm(entryCode = null) {
        const formContainer = document.getElementById('entryCodeFormContainer');
        const form = document.getElementById('entryCodeForm');
        const formTitle = document.getElementById('formTitle');
        
        if (entryCode) {
            // Edit mode
            formTitle.textContent = 'עריכת קוד כניסה';
            document.getElementById('entryCodeId').value = entryCode.id;
            document.getElementById('entryCodeInput').value = entryCode.entry_code;
            document.getElementById('cityInput').value = entryCode.city;
            document.getElementById('streetInput').value = entryCode.street;
            document.getElementById('locationDetailsInput').value = entryCode.location_details || '';
            document.getElementById('notesInput').value = entryCode.notes || '';
        } else {
            // Add mode
            formTitle.textContent = 'הוספת קוד כניסה חדש';
            form.reset();
            document.getElementById('entryCodeId').value = '';
        }
        
        formContainer.style.display = 'block';
        formContainer.scrollIntoView({ behavior: 'smooth' });
    }

    hideEntryCodeForm() {
        document.getElementById('entryCodeFormContainer').style.display = 'none';
        document.getElementById('entryCodeForm').reset();
    }

    async loadEntryCodesForAdmin() {
        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch('/api/entry-codes', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch entry codes');

            const result = await response.json();
            // Filter only manual codes for admin management
            const manualCodes = (result.data || []).filter(code => code.source === 'manual');
            this.displayEntryCodesTable(manualCodes);
        } catch (error) {
            console.error('Error loading entry codes:', error);
            this.showToast('שגיאה בטעינת קודי כניסה', 'error');
        }
    }

    displayEntryCodesTable(codes) {
        const tbody = document.getElementById('entryCodesTableBody');
        
        if (!codes || codes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem;">
                        <p>אין קודי כניסה ידניים במערכת</p>
                        <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">
                            קודי כניסה שנוספו בקריאות יופיעו בדף קודי הכניסה אך לא כאן
                        </p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = codes.map(code => `
            <tr>
                <td data-label="קוד:">${this.escapeHtml(code.entry_code)}</td>
                <td data-label="עיר:">${this.escapeHtml(code.city)}</td>
                <td data-label="רחוב:">${this.escapeHtml(code.street)}</td>
                <td data-label="פרטים:">${this.escapeHtml(code.location_details || '-')}</td>
                <td data-label="הערות:">${this.escapeHtml(code.notes || '-')}</td>
                <td data-label="פעולות:" class="entry-code-actions">
                    <button class="edit-btn" data-id="${code.id}">ערוך</button>
                    <button class="delete-btn" data-id="${code.id}">מחק</button>
                </td>
            </tr>
        `).join('');
        
        // Add event delegation for edit and delete buttons
        tbody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = () => this.editEntryCode(btn.getAttribute('data-id'));
        });
        
        tbody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = () => this.deleteEntryCode(btn.getAttribute('data-id'));
        });
    }

    async handleEntryCodeSubmit() {
        try {
            const id = document.getElementById('entryCodeId').value;
            const entryCodeData = {
                entry_code: document.getElementById('entryCodeInput').value.trim(),
                city: document.getElementById('cityInput').value.trim(),
                street: document.getElementById('streetInput').value.trim(),
                location_details: document.getElementById('locationDetailsInput').value.trim() || null,
                notes: document.getElementById('notesInput').value.trim() || null
            };

            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const url = id ? `/api/admin/entry-codes/${id}` : '/api/admin/entry-codes';
            const method = id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(entryCodeData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'שגיאה בשמירת קוד כניסה');
            }

            this.showToast(result.message || 'קוד הכניסה נשמר בהצלחה', 'success');
            this.hideEntryCodeForm();
            await this.loadEntryCodesForAdmin();
        } catch (error) {
            console.error('Error saving entry code:', error);
            this.showToast(error.message || 'שגיאה בשמירת קוד כניסה', 'error');
        }
    }

    async editEntryCode(id) {
        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch('/api/entry-codes', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch entry codes');

            const result = await response.json();
            const entryCode = result.data.find(code => code.id === id);

            if (entryCode) {
                this.showEntryCodeForm(entryCode);
            } else {
                this.showToast('קוד כניסה לא נמצא', 'error');
            }
        } catch (error) {
            console.error('Error loading entry code:', error);
            this.showToast('שגיאה בטעינת קוד כניסה', 'error');
        }
    }

    async deleteEntryCode(id) {
        if (!confirm('האם אתה בטוח שברצונך למחוק קוד כניסה זה?')) {
            return;
        }

        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch(`/api/admin/entry-codes/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'שגיאה במחיקת קוד כניסה');
            }

            this.showToast(result.message || 'קוד הכניסה נמחק בהצלחה', 'success');
            await this.loadEntryCodesForAdmin();
        } catch (error) {
            console.error('Error deleting entry code:', error);
            this.showToast(error.message || 'שגיאה במחיקת קוד כניסה', 'error');
        }
    }

    // ============================================
    // API KEYS MANAGEMENT
    // ============================================

    async showApiKeysSection() {
        // Close all other sections first
        this.closeAllSections();
        
        const section = document.getElementById('apiKeysSection');
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
        
        await this.loadApiKeys();
        this.bindApiKeysEvents();
    }

    bindApiKeysEvents() {
        // Generate API Key button
        const generateBtn = document.getElementById('generateApiKeyBtn');
        if (generateBtn && !generateBtn.hasListener) {
            generateBtn.hasListener = true;
            generateBtn.addEventListener('click', () => {
                this.showPasswordModal();
            });
        }

        // Password Modal
        const passwordModal = document.getElementById('passwordModal');
        const passwordForm = document.getElementById('passwordForm');
        const passwordModalClose = document.getElementById('passwordModalClose');
        const passwordModalCancel = document.getElementById('passwordModalCancel');

        if (passwordForm && !passwordForm.hasListener) {
            passwordForm.hasListener = true;
            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.verifyPasswordAndShowKeyForm();
            });
        }

        if (passwordModalClose) {
            passwordModalClose.onclick = () => this.hidePasswordModal();
        }
        if (passwordModalCancel) {
            passwordModalCancel.onclick = () => this.hidePasswordModal();
        }

        // API Key Form Modal
        const apiKeyModal = document.getElementById('apiKeyModal');
        const apiKeyForm = document.getElementById('apiKeyForm');
        const apiKeyModalClose = document.getElementById('apiKeyModalClose');
        const apiKeyModalCancel = document.getElementById('apiKeyModalCancel');

        if (apiKeyForm && !apiKeyForm.hasListener) {
            apiKeyForm.hasListener = true;
            apiKeyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.generateApiKey();
            });
        }

        if (apiKeyModalClose) {
            apiKeyModalClose.onclick = () => this.hideApiKeyModal();
        }
        if (apiKeyModalCancel) {
            apiKeyModalCancel.onclick = () => this.hideApiKeyModal();
        }

        // Generated Key Modal
        const generatedKeyModal = document.getElementById('generatedKeyModal');
        const generatedKeyModalClose = document.getElementById('generatedKeyModalClose');
        const copyApiKeyBtn = document.getElementById('copyApiKeyBtn');

        if (generatedKeyModalClose) {
            generatedKeyModalClose.onclick = () => this.hideGeneratedKeyModal();
        }

        if (copyApiKeyBtn && !copyApiKeyBtn.hasListener) {
            copyApiKeyBtn.hasListener = true;
            copyApiKeyBtn.addEventListener('click', () => {
                const input = document.getElementById('generatedApiKey');
                input.select();
                document.execCommand('copy');
                this.showToast('מפתח הועתק ללוח', 'success');
            });
        }
    }

    showPasswordModal() {
        const modal = document.getElementById('passwordModal');
        modal.classList.remove('hidden');
        document.getElementById('confirmPassword').value = '';
        document.getElementById('confirmPassword').focus();
    }

    hidePasswordModal() {
        const modal = document.getElementById('passwordModal');
        modal.classList.add('hidden');
        document.getElementById('confirmPassword').value = '';
    }

    hideApiKeyModal() {
        const modal = document.getElementById('apiKeyModal');
        modal.classList.add('hidden');
        document.getElementById('keyName').value = '';
    }

    hideGeneratedKeyModal() {
        const modal = document.getElementById('generatedKeyModal');
        modal.classList.add('hidden');
        document.getElementById('generatedApiKey').value = '';
    }

    async verifyPasswordAndShowKeyForm() {
        try {
            const password = document.getElementById('confirmPassword').value;
            
            if (!password) {
                this.showToast('נא להזין סיסמה', 'error');
                return;
            }

            // Get user email from localStorage
            const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
            if (!userData) {
                this.showToast('שגיאה בטעינת נתוני משתמש', 'error');
                return;
            }

            const user = JSON.parse(userData);
            const username = user.username;

            if (!username) {
                this.showToast('לא נמצא שם משתמש', 'error');
                return;
            }

            // Verify password by attempting to login with username
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                this.showToast('סיסמה שגויה', 'error');
                return;
            }

            // Password is correct, show API key form
            this.hidePasswordModal();
            this.showApiKeyModal();

        } catch (error) {
            console.error('Error verifying password:', error);
            this.showToast('שגיאה באימות סיסמה', 'error');
        }
    }

    showApiKeyModal() {
        const modal = document.getElementById('apiKeyModal');
        modal.classList.remove('hidden');
        document.getElementById('keyName').focus();
    }

    async loadApiKeys() {
        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch('/api/admin/api-keys', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load API keys');
            }

            this.renderApiKeys(data.api_keys || []);

        } catch (error) {
            console.error('Error loading API keys:', error);
            this.showToast('שגיאה בטעינת מפתחות API', 'error');
        }
    }

    renderApiKeys(apiKeys) {
        const container = document.getElementById('apiKeysContainer');
        
        if (!apiKeys || apiKeys.length === 0) {
            container.innerHTML = '<div class="empty-state">אין מפתחות API עדיין. צור מפתח חדש כדי להתחיל.</div>';
            return;
        }

        container.innerHTML = apiKeys.map(key => `
            <div class="api-key-card" data-key-id="${key.id}">
                <div class="api-key-header">
                    <h4 class="api-key-name">${key.key_name}</h4>
                    <span class="api-key-status ${key.is_active ? 'active' : 'inactive'}">
                        ${key.is_active ? '🟢 פעיל' : '🔴 לא פעיל'}
                    </span>
                </div>
                
                <div class="api-key-info">
                    <div class="info-row">
                        <span class="info-label">הרשאות:</span>
                        <span class="info-value">${key.permissions.join(', ')}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">נוצר:</span>
                        <span class="info-value">${new Date(key.created_at).toLocaleDateString('he-IL')}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">שימוש אחרון:</span>
                        <span class="info-value">${key.last_used_at ? new Date(key.last_used_at).toLocaleString('he-IL') : 'מעולם לא'}</span>
                    </div>
                </div>
                
                <div class="api-key-actions">
                    <button class="btn-delete-key" data-key-id="${key.id}" title="מחק מפתח">
                        🗑️ מחק
                    </button>
                </div>
            </div>
        `).join('');

        // Bind delete buttons
        container.querySelectorAll('.btn-delete-key').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const keyId = e.target.dataset.keyId;
                if (confirm('האם אתה בטוח שברצונך למחוק מפתח זה? הפעולה בלתי הפיכה.')) {
                    await this.deleteApiKey(keyId);
                }
            });
        });
    }

    async generateApiKey() {
        try {
            const keyName = document.getElementById('keyName').value.trim();
            
            if (!keyName) {
                this.showToast('נא להזין שם למפתח', 'error');
                return;
            }

            // Get selected permissions
            const permissionCheckboxes = document.querySelectorAll('input[name="permission"]:checked');
            const permissions = Array.from(permissionCheckboxes).map(cb => cb.value);

            if (permissions.length === 0) {
                this.showToast('נא לבחור לפחות הרשאה אחת', 'error');
                return;
            }

            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch('/api/admin/api-keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    key_name: keyName,
                    permissions: permissions
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to generate API key');
            }

            // Hide form modal
            this.hideApiKeyModal();

            // Show the generated key (one time only!)
            document.getElementById('generatedApiKey').value = data.api_key;
            const generatedModal = document.getElementById('generatedKeyModal');
            generatedModal.classList.remove('hidden');

            // Reload the keys list
            await this.loadApiKeys();

            this.showToast('מפתח API נוצר בהצלחה', 'success');

        } catch (error) {
            console.error('Error generating API key:', error);
            this.showToast('שגיאה ביצירת מפתח API', 'error');
        }
    }

    async deleteApiKey(keyId) {
        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch(`/api/admin/api-keys/${keyId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete API key');
            }

            this.showToast('מפתח נמחק בהצלחה', 'success');
            await this.loadApiKeys();

        } catch (error) {
            console.error('Error deleting API key:', error);
            this.showToast('שגיאה במחיקת מפתח', 'error');
        }
    }

    logout() {
        // Clear authentication data
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        
        // Redirect to login page
        window.location.href = '/login.html';
    }
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
});

// Handle visibility change to refresh data when tab becomes active
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.adminPanel) {
        window.adminPanel.loadDashboard();
    }
});
