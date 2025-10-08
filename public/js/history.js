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
            
            this.bindEvents();
            this.populateYearOptions();
            
            console.log('🏍️ MDA CallCounter History - Initialized successfully');
        } catch (error) {
            console.error('❌ Initialization error:', error);
            this.showToast('שגיאה באתחול המערכת', 'error');
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
            const callDate = new Date(call.created_at);
            const formattedDate = callDate.toLocaleDateString('he-IL');
            const formattedTime = callDate.toLocaleTimeString('he-IL', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            const callTypeMap = {
                'דחוף': { text: 'דחוף', class: 'urgent' },
                'אט"ן': { text: 'אט״ן', class: 'atan' },
                'אט״ן': { text: 'אט״ן', class: 'atan' },
                'ארן': { text: 'ארן', class: 'aran' },
                'נתבג': { text: 'נתבג', class: 'natbag' },
                // Backward compatibility with English values
                'urgent': { text: 'דחוף', class: 'urgent' },
                'atan': { text: 'אט״ן', class: 'atan' },
                'aran': { text: 'ארן', class: 'aran' },
                'natbag': { text: 'נתבג', class: 'natbag' }
            };

            const callTypeInfo = callTypeMap[call.call_type] || { text: call.call_type, class: 'default' };

            return `
                <div class="call-item">
                    <div class="call-header">
                        <div class="call-type call-type-${callTypeInfo.class}">
                            ${callTypeInfo.text}
                        </div>
                        <div class="call-time">
                            ${formattedDate} • ${formattedTime}
                        </div>
                    </div>
                    <div class="call-details">
                        <div class="call-location">
                            <strong>מיקום:</strong> ${call.location}
                        </div>
                        ${call.description ? `
                            <div class="call-description">
                                <strong>תיאור:</strong> ${call.description}
                            </div>
                        ` : ''}
                        ${call.destination ? `
                            <div class="call-destination">
                                <strong>יעד:</strong> ${call.destination}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        callsList.innerHTML = callsHtml;
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