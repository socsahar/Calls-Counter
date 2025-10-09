// MDA CallCounter - Historical View Page JavaScript
class HistoryViewer {
    constructor() {
        this.isLoading = false;
        this.currentVehicle = {
            number: '5248',
            type: 'motorcycle'
        };
        
        this.init();
    }

    // Helper method to get authentication headers
    getAuthHeaders() {
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        return token ? {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        } : {
            'Content-Type': 'application/json'
        };
    }

    // Check authentication before loading data
    checkAuthentication() {
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        
        if (!token) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    // Helper function to format decimal hours to "Xh Ym" format
    formatHoursAndMinutes(decimalHours) {
        if (!decimalHours || decimalHours === 0) return '0h 0m';
        
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);
        
        if (hours === 0) {
            return `${minutes}m`;
        } else if (minutes === 0) {
            return `${hours}h`;
        } else {
            return `${hours}h ${minutes}m`;
        }
    }

    async init() {
        try {
            // Check authentication first
            if (!this.checkAuthentication()) {
                return;
            }

            // Ensure loading overlay is hidden at start
            this.setLoading(false);
            
            // Load and display vehicle information
            await this.loadVehicleDisplay();
            
            this.bindEvents();
            this.populateYearOptions();
            
            // Auto-load current month's data
            this.autoLoadCurrentMonth();
            
            console.log('🏍️ MDA CallCounter History - Initialized successfully');
        } catch (error) {
            console.error('❌ Initialization error:', error);
            this.showToast('שגיאה באתחול המערכת', 'error');
        }
    }

    autoLoadCurrentMonth() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
        
        // Set the dropdowns to current year and month
        const yearSelect = document.getElementById('historyYear');
        const monthSelect = document.getElementById('historyMonth');
        
        if (yearSelect && monthSelect) {
            yearSelect.value = currentYear;
            monthSelect.value = currentMonth;
            
            // Auto-load the data
            setTimeout(() => {
                this.loadHistoricalCalls();
            }, 500); // Increased delay to ensure DOM is ready
        }
    }

    bindEvents() {
        // Back button
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = '/';
            });
        }

        // Mobile menu functionality
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
        const mobileMenuClose = document.getElementById('mobileMenuClose');
        const mobileBackBtn = document.getElementById('mobileBackBtn');

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

        if (mobileBackBtn) {
            mobileBackBtn.addEventListener('click', () => {
                window.location.href = '/';
            });
        }

        // Vehicle settings form
        const vehicleForm = document.getElementById('vehicleSettingsForm');
        if (vehicleForm) {
            vehicleForm.addEventListener('submit', this.handleVehicleSettingsSubmit.bind(this));
        }

        // Load historical calls button
        const loadHistoricalBtn = document.getElementById('loadHistoricalCalls');
        if (loadHistoricalBtn) {
            loadHistoricalBtn.addEventListener('click', () => {
                this.loadHistoricalCalls();
            });
        }

        // Auto-load current year data on page load
        setTimeout(() => {
            this.loadHistoricalCalls();
        }, 500);
    }

    populateYearOptions() {
        const yearSelect = document.getElementById('historyYear');
        if (!yearSelect) return;

        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '';
        
        // Add years from current year back to 2020
        for (let year = currentYear; year >= 2020; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) {
                option.selected = true;
            }
            yearSelect.appendChild(option);
        }
    }

    async loadHistoricalCalls() {
        const year = document.getElementById('historyYear').value;
        const month = document.getElementById('historyMonth').value;
        
        if (!year) {
            this.showToast('יש לבחור שנה', 'error');
            return;
        }

        try {
            this.setLoading(true);
            
            // Build query parameters
            const params = new URLSearchParams();
            params.append('year', year);
            if (month) {
                params.append('month', month);
            }

            const response = await fetch(`/api/calls/historical?${params}`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Redirect to login if unauthorized
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            this.displayHistoricalStats(data.stats, year, month);
            this.displayHistoricalCalls(data.calls, year, month);
            
        } catch (error) {
            console.error('Error loading historical calls:', error);
            this.showToast('שגיאה בטעינת הנתונים ההיסטוריים', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    displayHistoricalStats(stats, year, month) {
        const statsContainer = document.getElementById('historicalStats');
        const statsSection = document.getElementById('historicalStatsSection');
        if (!statsContainer || !statsSection) return;

        const monthNames = {
            1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל',
            5: 'מאי', 6: 'יוני', 7: 'יולי', 8: 'אוגוסט',
            9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר'
        };

        const periodText = month ? `${monthNames[parseInt(month)]} ${year}` : `שנת ${year}`;

        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-content">
                    <div class="stat-number">${stats.totalCalls || 0}</div>
                    <div class="stat-label">סה״כ קריאות</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🚨</div>
                <div class="stat-content">
                    <div class="stat-number">${stats.urgentCalls || 0}</div>
                    <div class="stat-label">קריאות דחופות</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🏥</div>
                <div class="stat-content">
                    <div class="stat-number">${stats.atanCalls || 0}</div>
                    <div class="stat-label">קריאות אט״ן</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🚑</div>
                <div class="stat-content">
                    <div class="stat-number">${stats.aranCalls || 0}</div>
                    <div class="stat-label">קריאות ארן</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⏱️</div>
                <div class="stat-content">
                    <div class="stat-number">${this.formatHoursAndMinutes(stats.totalHours || 0)}</div>
                    <div class="stat-label">סה״כ שעות</div>
                </div>
            </div>
        `;

        // Update title and show stats section
        const titleElement = document.getElementById('historicalTitle');
        if (titleElement) {
            titleElement.textContent = `קריאות ${periodText}`;
        }
        
        statsSection.style.display = 'block';
    }

    displayHistoricalCalls(calls, year, month) {
        const callsList = document.getElementById('historicalCallsList');
        if (!callsList) return;

        if (!calls || calls.length === 0) {
            const monthNames = {
                1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל',
                5: 'מאי', 6: 'יוני', 7: 'יולי', 8: 'אוגוסט',
                9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר'
            };
            const periodText = month ? `${monthNames[parseInt(month)]} ${year}` : `שנת ${year}`;
            
            callsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p class="empty-text">לא נמצאו קריאות עבור ${periodText}</p>
                </div>
            `;
            return;
        }

        const callsHtml = calls.map(call => {
            const callDate = new Date(call.call_date || call.created_at);
            const formattedDate = callDate.toLocaleDateString('he-IL');
            const formattedTime = `${call.start_time}${call.end_time ? ` - ${call.end_time}` : ' (פעיל)'}`;
            
            // Calculate duration display
            const duration = call.duration_minutes 
                ? `${call.duration_minutes} דקות`
                : (call.end_time ? 'לא חושב' : 'בתהליך');

            // Fix call type display - convert English to Hebrew and add emojis
            let displayCallType = call.call_type || 'לא צוין';
            if (displayCallType === 'urgent') displayCallType = '🚨 דחוף';
            else if (displayCallType === 'דחוף') displayCallType = '🚨 דחוף';
            else if (displayCallType === 'atan') displayCallType = '🔴 אט"ן';
            else if (displayCallType === 'אט"ן') displayCallType = '🔴 אט"ן';
            else if (displayCallType === 'אט״ן') displayCallType = '🔴 אט"ן';
            else if (displayCallType === 'aran') displayCallType = 'ארן';
            else if (displayCallType === 'natbag') displayCallType = 'נתבג';

            // Fix vehicle detection - get proper Hebrew vehicle type and emoji
            let vehicleTypeHebrew = call.vehicle_type;
            let vehicleEmoji = '🚑'; // Default ambulance emoji
            const vehicleNumber = call.vehicle_number || '';
            
            if (vehicleNumber) {
                if (vehicleNumber.toString().startsWith('5')) {
                    vehicleTypeHebrew = 'אופנוע';
                    vehicleEmoji = '🏍️';
                } else if (vehicleNumber.toString().startsWith('6')) {
                    vehicleTypeHebrew = 'פיקנטו';
                    vehicleEmoji = '🚗';
                } else if (vehicleNumber.toString().length === 5 && (vehicleNumber.toString().startsWith('1') || vehicleNumber.toString().startsWith('2'))) {
                    vehicleTypeHebrew = 'כונן אישי';
                    vehicleEmoji = '👨‍⚕️';
                } else {
                    vehicleTypeHebrew = 'אמבולנס';
                    vehicleEmoji = '🚑';
                }
            }

            // Simple display structure - back to basics
            return `
                <div class="call-item" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; background: white; color: #333;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="color: #d32f2f; font-size: 1.1em;">${displayCallType}</strong>
                        <span style="color: #555; font-size: 0.9em; background: #f5f5f5; padding: 4px 8px; border-radius: 4px;">${formattedDate}</span>
                    </div>
                    <div style="margin-bottom: 8px; color: #333;">
                        <strong style="color: #1976d2;">זמן:</strong> <span style="color: #333;">${formattedTime}</span>
                    </div>
                    <div style="margin-bottom: 8px; color: #333;">
                        <strong style="color: #1976d2;">משך:</strong> <span style="color: #333;">${duration}</span>
                    </div>
                    <div style="margin-bottom: 8px; color: #333;">
                        <strong style="color: #1976d2;">מיקום:</strong> <span style="color: #333;">${call.location || 'לא צוין'}</span>
                    </div>
                    ${call.description ? `
                        <div style="margin-bottom: 8px; color: #333;">
                            <strong style="color: #1976d2;">תיאור:</strong> <span style="color: #333;">${call.description}</span>
                        </div>
                    ` : ''}
                    <div style="color: #666; font-size: 0.9em; background: #f8f9fa; padding: 8px; border-radius: 4px; border-left: 3px solid #2196f3;">
                        <strong style="color: #333;">רכב:</strong> <span style="color: #333;">${vehicleEmoji} ${vehicleTypeHebrew} ${vehicleNumber}</span>
                    </div>
                </div>
            `;
        }).join('');

        callsList.innerHTML = callsHtml;
    }

    // Vehicle display methods
    async loadVehicleDisplay() {
        try {
            const response = await fetch('/api/vehicle/current', {
                headers: this.getAuthHeaders()
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.currentVehicle = {
                        number: result.data.vehicle_number,
                        type: result.data.vehicle_type
                    };
                    this.updateVehicleDisplay();
                }
            }
        } catch (error) {
            console.error('Error loading vehicle display:', error);
        }
    }

    updateVehicleDisplay() {
        // Update desktop badge
        const numberElement = document.getElementById('currentVehicle');
        const typeElement = document.getElementById('currentVehicleType');
        
        // Update mobile badge
        const mobileNumberElement = document.getElementById('mobileCurrentVehicle');
        const mobileTypeElement = document.getElementById('mobileCurrentVehicleType');
        
        if (numberElement) {
            numberElement.textContent = this.currentVehicle.number;
        }
        if (mobileNumberElement) {
            mobileNumberElement.textContent = this.currentVehicle.number;
        }
        
        if (typeElement) {
            const typeMap = {
                'אופנוע': 'אופנוע',
                'פיקנטו': 'פיקנטו', 
                'אמבולנס': 'אמבולנס',
                'כונן אישי': 'כונן אישי',
                'motorcycle': 'אופנוע',
                'picanto': 'פיקנטו',
                'ambulance': 'אמבולנס',
                'personal_standby': 'כונן אישי'
            };
            typeElement.textContent = typeMap[this.currentVehicle.type] || this.currentVehicle.type;
        }
        if (mobileTypeElement) {
            const typeMap = {
                'אופנוע': 'אופנוע',
                'פיקנטו': 'פיקנטו', 
                'אמבולנס': 'אמבולנס',
                'כונן אישי': 'כונן אישי',
                'motorcycle': 'אופנוע',
                'picanto': 'פיקנטו',
                'ambulance': 'אמבולנס',
                'personal_standby': 'כונן אישי'
            };
            mobileTypeElement.textContent = typeMap[this.currentVehicle.type] || this.currentVehicle.type;
        }
    }

    // Utility methods
    setLoading(loading) {
        this.isLoading = loading;
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            if (loading) {
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
        }
    }

    showToast(message, type = 'success') {
        const toastId = type === 'success' ? 'successToast' : 'errorToast';
        const toast = document.getElementById(toastId);
        
        if (toast) {
            const messageElement = toast.querySelector('.toast-message');
            if (messageElement) {
                messageElement.textContent = message;
            }
            
            toast.classList.remove('hidden');
            
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 3000);
        }
    }
}

// Initialize the history viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏍️ MDA CallCounter History - Starting initialization...');
    window.historyViewer = new HistoryViewer();
});

// Handle visibility change to refresh data when tab becomes active
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.historyViewer) {
        // Refresh vehicle settings when tab becomes visible
        window.historyViewer.loadVehicleSettings();
    }
});