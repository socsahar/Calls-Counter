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
            // Ensure loading overlay is hidden at start
            this.setLoading(false);
            
            await this.loadVehicleSettings();
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

        // Vehicle settings button
        const vehicleSettingsBtn = document.getElementById('vehicleSettingsBtn');
        if (vehicleSettingsBtn) {
            vehicleSettingsBtn.addEventListener('click', () => {
                this.loadVehicleSettings();
                document.getElementById('vehicleSettingsModal').classList.remove('hidden');
            });
        }

        // Vehicle settings modal close buttons
        const vehicleSettingsClose = document.getElementById('vehicleSettingsClose');
        const vehicleSettingsCancel = document.getElementById('vehicleSettingsCancel');
        if (vehicleSettingsClose) {
            vehicleSettingsClose.addEventListener('click', () => {
                document.getElementById('vehicleSettingsModal').classList.add('hidden');
            });
        }
        if (vehicleSettingsCancel) {
            vehicleSettingsCancel.addEventListener('click', () => {
                document.getElementById('vehicleSettingsModal').classList.add('hidden');
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

            const response = await fetch(`/api/calls/historical?${params}`);
            if (!response.ok) {
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

    // Vehicle settings methods
    async loadVehicleSettings() {
        try {
            const response = await fetch('/api/vehicle/current');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.currentVehicle = {
                        number: result.data.vehicle_number,
                        type: result.data.vehicle_type
                    };
                    this.updateVehicleDisplay();
                    this.populateVehicleForm();
                }
            }
        } catch (error) {
            console.error('Error loading vehicle settings:', error);
        }
    }

    updateVehicleDisplay() {
        const numberElement = document.getElementById('currentVehicle');
        const typeElement = document.getElementById('currentVehicleType');
        
        if (numberElement) {
            numberElement.textContent = this.currentVehicle.number;
        }
        
        if (typeElement) {
            const typeMap = {
                'אופנוע': 'אופנוע',
                'פיקנטו': 'פיקנטו', 
                'אמבולנס': 'אמבולנס',
                'motorcycle': 'אופנוע',
                'picanto': 'פיקנטו',
                'ambulance': 'אמבולנס'
            };
            typeElement.textContent = typeMap[this.currentVehicle.type] || this.currentVehicle.type;
        }
    }

    populateVehicleForm() {
        const numberInput = document.getElementById('vehicleNumber');
        const typeSelect = document.getElementById('vehicleType');
        
        if (numberInput) {
            numberInput.value = this.currentVehicle.number;
        }
        
        if (typeSelect) {
            const typeMap = {
                'אופנוע': 'motorcycle',
                'פיקנטו': 'picanto',
                'אמבולנס': 'ambulance'
            };
            typeSelect.value = typeMap[this.currentVehicle.type] || this.currentVehicle.type;
        }
    }

    async handleVehicleSettingsSubmit(event) {
        event.preventDefault();
        
        const vehicleNumber = document.getElementById('vehicleNumber').value;
        const vehicleType = document.getElementById('vehicleType').value;
        
        if (!vehicleNumber || !vehicleType) {
            this.showToast('יש למלא את כל השדות', 'error');
            return;
        }

        try {
            this.setLoading(true);

            const response = await fetch('/api/vehicle/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    vehicle_number: vehicleNumber,
                    vehicle_type: vehicleType
                })
            });

            const result = await response.json();

            if (result.success) {
                this.currentVehicle = {
                    number: vehicleNumber,
                    type: vehicleType
                };
                this.updateVehicleDisplay();
                this.showToast('הגדרות הרכב נשמרו בהצלחה', 'success');
                document.getElementById('vehicleSettingsModal').classList.add('hidden');
            } else {
                throw new Error(result.message || 'שגיאה בשמירת ההגדרות');
            }
        } catch (error) {
            console.error('Error saving vehicle settings:', error);
            this.showToast('שגיאה בשמירת הגדרות הרכב', 'error');
        } finally {
            this.setLoading(false);
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