// MDA CallCounter - Client-side JavaScript

// Check authentication before initializing the app
function checkAuthentication() {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }

    // Validate token with server
    fetch('/api/auth/validate', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            // Only redirect if it's actually an auth error
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed');
            }
            // For network errors, try to continue with cached data
            console.warn('Network error during auth check, continuing...');
            return null;
        }
        return response.json();
    })
    .then(data => {
        if (data && !data.success) {
            throw new Error('Token invalid');
        }
        if (data && data.user) {
            // Store updated user data
            const remember = localStorage.getItem('rememberMe') === 'true';
            if (remember) {
                localStorage.setItem('userData', JSON.stringify(data.user));
            } else {
                sessionStorage.setItem('userData', JSON.stringify(data.user));
            }
            console.log('🔐 Authentication validated for user:', data.user.fullName);
            
            // Update vehicle badge if the function exists
            if (typeof updateVehicleBadge === 'function') {
                updateVehicleBadge();
            }
        }
    })
    .catch(error => {
        console.error('Authentication failed:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        window.location.href = '/login.html';
    });

    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication first
    if (!checkAuthentication()) {
        return;
    }

    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) {
        contextMenu.addEventListener('click', (event) => {
            const action = event.target.closest('.context-menu-item')?.dataset.action;
            const callId = contextMenu.dataset.callId;
            if (action && callId && window.callCounter) {
                window.callCounter.handleContextMenuAction(action, callId);
                window.callCounter.hideContextMenu();
            }
        });
    }
});

// MDA CallCounter - Client-side JavaScript
class CallCounter {
    constructor() {
        this.isLoading = false;
        this.calls = [];
        this.filteredCalls = [];
        this.currentFilters = {
            callType: '',
            vehicleType: '',
            date: '',
            search: ''
        };
        this.stats = {
            totalCalls: 0,
            totalHours: 0,
            currentStatus: 'זמין'
        };
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

    // Initialize user info display
    initUserInfo() {
        const userData = localStorage.getItem('userData');
        if (userData) {
            const user = JSON.parse(userData);
            const userNameEl = document.getElementById('userName');
            const userCodeEl = document.getElementById('userCode');
            
            if (userNameEl) userNameEl.textContent = user.fullName;
            if (userCodeEl) userCodeEl.textContent = user.mdaCode;
        }
    }

    async init() {
        try {
            // Ensure loading overlay is hidden at start
            this.setLoading(false);
            
            await this.loadVehicleSettings();
            this.initUserInfo();
            
            // Update vehicle badge if the function exists
            if (typeof updateVehicleBadge === 'function') {
                updateVehicleBadge();
            }
            
            this.bindEvents();
            this.setCurrentTime();
            await this.loadStats();
            await this.loadCalls();
            
            // Refresh data every 30 seconds
            setInterval(() => {
                this.loadStats();
                this.loadCalls();
            }, 30000);
        } catch (error) {
            console.error('Error during initialization:', error);
            this.setLoading(false);
        }
    }

    bindEvents() {
        // Form submission
        const form = document.getElementById('callForm');
        if (form) {
            form.addEventListener('submit', this.handleFormSubmit.bind(this));
        }

        // Edit form submission
        const editForm = document.getElementById('editForm');
        if (editForm) {
            editForm.addEventListener('submit', this.handleEditSubmit.bind(this));
        }

        // Vehicle settings form
        const vehicleForm = document.getElementById('vehicleSettingsForm');
        if (vehicleForm) {
            vehicleForm.addEventListener('submit', this.handleVehicleSettingsSubmit.bind(this));
        }

        // Filter events
        ['filterCallType', 'filterVehicleType', 'filterDate'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', this.applyFilters.bind(this));
            }
        });

        // Live search filter
        const searchFilter = document.getElementById('filterSearch');
        if (searchFilter) {
            searchFilter.addEventListener('input', this.handleLiveSearch.bind(this));
        }

        // Clear filters button
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', this.clearFilters.bind(this));
        }

        // Vehicle settings button
        const vehicleSettingsBtn = document.getElementById('vehicleSettingsBtn');
        if (vehicleSettingsBtn) {
            vehicleSettingsBtn.addEventListener('click', () => {
                this.loadVehicleSettings();
                document.getElementById('vehicleSettingsModal').classList.remove('hidden');
            });
        }

        // Historical view button
        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                window.location.href = '/history.html';
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('האם אתה בטוח שברצונך להתנתק?')) {
                    this.logout();
                }
            });
        }

        // Mobile menu handlers
        this.initMobileMenu();

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

        // Edit modal close buttons
        const editModalClose = document.getElementById('editModalClose');
        const editModalCancel = document.getElementById('editModalCancel');
        if (editModalClose) {
            editModalClose.addEventListener('click', () => {
                document.getElementById('editModal').classList.add('hidden');
            });
        }
        if (editModalCancel) {
            editModalCancel.addEventListener('click', () => {
                document.getElementById('editModal').classList.add('hidden');
            });
        }

        // Auto-set current time and date when form loads
        this.setCurrentDateTime();
        
        // Update current time every minute
        setInterval(() => {
            if (!document.getElementById('startTime').value) {
                this.setCurrentTime();
            }
        }, 60000);

        // Close context menu when clicking elsewhere
        document.addEventListener('click', (e) => {
            // Don't hide if clicking on context menu itself or menu button
            if (!e.target.closest('#contextMenu') && !e.target.closest('.call-menu-btn')) {
                this.hideContextMenu();
            }
        });
        
        // Add context menu event delegation for call items
        document.addEventListener('contextmenu', (e) => {
            const callItem = e.target.closest('.call-item');
            if (callItem) {
                e.preventDefault();
                const callId = callItem.dataset.callId;
                if (callId) {
                    this.showContextMenu(e, callId);
                }
            }
        });

        // Add click event for mobile 3-dot menu
        document.addEventListener('click', (e) => {
            console.log('Global click detected on:', e.target);
            
            // Check if clicked element or its parent is the menu button
            if (e.target.classList.contains('call-menu-btn') || 
                e.target.classList.contains('menu-dots') ||
                e.target.closest('.call-menu-btn')) {
                
                console.log('Menu button clicked!');
                e.preventDefault();
                e.stopPropagation();
                
                // Get the button element
                const button = e.target.closest('.call-menu-btn') || e.target;
                const callId = button.dataset.callId;
                console.log('Call ID:', callId);
                
                if (callId) {
                    // Create and show menu immediately
                    this.createAndShowMenu(e, callId);
                } else {
                    console.error('No call ID found');
                }
            }
        });
    }

    setCurrentTime() {
        const now = new Date();
        const timeString = now.toTimeString().slice(0, 5);
        const startTimeInput = document.getElementById('startTime');
        
        if (startTimeInput && !startTimeInput.value) {
            startTimeInput.value = timeString;
        }
    }

    setCurrentDateTime() {
        const now = new Date();
        const timeString = now.toTimeString().slice(0, 5);
        const dateString = now.toISOString().split('T')[0];
        
        const startTimeInput = document.getElementById('startTime');
        const dateInput = document.getElementById('callDate');
        
        if (startTimeInput && !startTimeInput.value) {
            startTimeInput.value = timeString;
        }
        
        if (dateInput && !dateInput.value) {
            dateInput.value = dateString;
        }
    }

    createAndShowMenu(event, callId) {
        console.log('Creating menu for call ID:', callId);
        
        // Remove any existing menu
        const existingMenu = document.getElementById('quickContextMenu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create new menu
        const menu = document.createElement('div');
        menu.id = 'quickContextMenu';
        
        // Create edit option
        const editOption = document.createElement('div');
        editOption.innerHTML = '✏️ עריכה';
        editOption.style.cssText = 'padding: 8px; cursor: pointer; border-bottom: 1px solid #eee;';
        editOption.addEventListener('click', () => {
            console.log('Edit clicked for call:', callId);
            this.editCall(callId);
        });
        
        // Create delete option
        const deleteOption = document.createElement('div');
        deleteOption.innerHTML = '🗑️ מחיקה';
        deleteOption.style.cssText = 'padding: 8px; cursor: pointer; color: red;';
        deleteOption.addEventListener('click', () => {
            console.log('Delete clicked for call:', callId);
            this.deleteCallDirect(callId);
        });
        
        // Add options to menu
        menu.appendChild(editOption);
        menu.appendChild(deleteOption);
        
        // Style the menu
        menu.style.cssText = `
            position: fixed;
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 999999;
            min-width: 100px;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;        
        // Position menu
        const x = (event.clientX || event.pageX) + 10;
        const y = (event.clientY || event.pageY) + 10;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        
        // Add to body
        document.body.appendChild(menu);
        
        console.log('Menu created and added to body:', menu);
        console.log('Menu position:', x, y);
        
        // Hide menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', function hideMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', hideMenu);
                }
            });
        }, 100);
    }

    editCall(callId) {
        console.log('Edit call:', callId);
        const call = this.calls.find(c => c.id == callId);
        if (call) {
            this.openEditModal(call);
        }
        // Remove menu
        const menu = document.getElementById('quickContextMenu');
        if (menu) menu.remove();
    }

    deleteCallDirect(callId) {
        console.log('Delete call:', callId);
        if (confirm('האם אתה בטוח שברצונך למחוק קריאה זו?')) {
            this.deleteCall(callId);
        }
        // Remove menu
        const menu = document.getElementById('quickContextMenu');
        if (menu) menu.remove();
    }

    showContextMenu(event, callId) {
        console.log('showContextMenu called with callId:', callId);
        event.preventDefault();
        
        let contextMenu = document.getElementById('contextMenu');
        
        // Create context menu if it doesn't exist
        if (!contextMenu) {
            console.log('Creating context menu element');
            contextMenu = document.createElement('div');
            contextMenu.id = 'contextMenu';
            contextMenu.className = 'context-menu hidden';
            contextMenu.innerHTML = `
                <div class="context-menu-item" data-action="edit">
                    <span class="context-icon">✏️</span>
                    עריכה
                </div>
                <div class="context-menu-item" data-action="delete">
                    <span class="context-icon">🗑️</span>
                    מחיקה
                </div>
            `;
            document.body.appendChild(contextMenu);
            
            // Add click handler to the menu
            contextMenu.addEventListener('click', (e) => {
                const action = e.target.closest('.context-menu-item')?.dataset.action;
                const callId = contextMenu.dataset.callId;
                if (action && callId && window.callCounter) {
                    window.callCounter.handleContextMenuAction(action, callId);
                    window.callCounter.hideContextMenu();
                }
            });
        }
        
        console.log('Context menu element:', contextMenu);
        
        // Position and show the menu
        const x = event.clientX || event.pageX;
        const y = (event.clientY || event.pageY) + window.scrollY;
        
        console.log('Positioning at:', x, y);
        
        // Reset all styles
        contextMenu.style.cssText = '';
        contextMenu.className = 'context-menu';
        
        // Position the menu
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.style.zIndex = '99999';
        contextMenu.style.display = 'block';
        contextMenu.style.visibility = 'visible';
        contextMenu.style.opacity = '1';
        contextMenu.style.background = 'white';
        contextMenu.style.border = '1px solid #ccc';
        contextMenu.style.borderRadius = '4px';
        contextMenu.style.padding = '8px';
        contextMenu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        contextMenu.style.minWidth = '120px';
        
        contextMenu.dataset.callId = callId;
        
        console.log('Context menu should be visible now');
        console.log('Final context menu style:', contextMenu.style.cssText);
    }

    hideContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
            contextMenu.className = 'context-menu hidden';
        }
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        
        if (this.isLoading) return; // Prevent multiple submissions
        
        const formData = this.getFormData();
        
        if (!this.validateFormData(formData)) {
            return;
        }

        await this.submitCall(formData);
    }

    getFormData() {
        return {
            call_type: document.getElementById('callType').value,
            call_date: document.getElementById('callDate').value,
            start_time: document.getElementById('startTime').value,
            end_time: document.getElementById('endTime').value || null,
            location: document.getElementById('location').value,
            description: document.getElementById('description').value || null
        };
    }

    validateFormData(data) {
        if (!data.call_type) {
            this.showError('אנא בחר סוג קריאה');
            return false;
        }
        
        if (!data.call_date) {
            this.showError('אנא הזן תאריך');
            return false;
        }
        
        if (!data.start_time) {
            this.showError('אנא הזן שעת התחלה');
            return false;
        }
        
        if (!data.location.trim()) {
            this.showError('אנא הזן מיקום');
            return false;
        }

        // Validate time format
        if (data.end_time && data.start_time >= data.end_time) {
            this.showError('שעת הסיום חייבת להיות אחרי שעת ההתחלה');
            return false;
        }
        
        return true;
    }

    async submitCall(callData) {
        try {
            this.setLoading(true);
            
            const response = await fetch('/api/calls', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(callData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'שגיאה ברישום הקריאה');
            }

            this.showSuccess('נסיעה נרשמה בהצלחה!');
            this.resetForm();
            await this.loadStats();
            await this.loadCalls();
            
        } catch (error) {
            console.error('Error submitting call:', error);
            this.showError(error.message || 'שגיאה ברישום הנסיעה');
        } finally {
            this.setLoading(false);
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats', {
                headers: this.getAuthHeaders()
            });
            const result = await response.json();

            if (result.success) {
                this.stats = result.data;
                this.updateStatsDisplay();
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadCalls() {
        try {
            // Load only today's calls for the "Latest Calls" section
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`/api/calls?date=${today}`, {
                headers: this.getAuthHeaders()
            });
            const result = await response.json();

            if (result.success) {
                this.calls = result.data;
                this.filteredCalls = [...this.calls];
                this.updateCallsDisplay();
            }
        } catch (error) {
            console.error('Error loading calls:', error);
        }
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

    updateStatsDisplay() {
        const totalCallsEl = document.getElementById('totalCalls');
        const weeklyCallsEl = document.getElementById('weeklyCalls');
        const monthlyCallsEl = document.getElementById('monthlyCalls');
        const weeklyHoursEl = document.getElementById('weeklyHours');
        const monthlyHoursEl = document.getElementById('monthlyHours');

        if (totalCallsEl) totalCallsEl.textContent = this.stats.totalCalls || 0;
        if (weeklyCallsEl) weeklyCallsEl.textContent = this.stats.weeklyCalls || 0;
        if (monthlyCallsEl) monthlyCallsEl.textContent = this.stats.monthlyCalls || 0;
        if (weeklyHoursEl) weeklyHoursEl.textContent = this.formatHoursAndMinutes(this.stats.weeklyHours);
        if (monthlyHoursEl) monthlyHoursEl.textContent = this.formatHoursAndMinutes(this.stats.monthlyHours);
    }

    updateCallsDisplay() {
        const callsList = document.getElementById('callsList');
        if (!callsList) return;

        const callsToShow = this.filteredCalls.length > 0 || Object.values(this.currentFilters).some(f => f) 
            ? this.filteredCalls 
            : this.calls;

        if (callsToShow.length === 0) {
            const emptyMessage = Object.values(this.currentFilters).some(f => f) 
                ? 'לא נמצאו נסיעות התואמות לסינון'
                : 'אין נסיעות שנרשמו היום';
                
            callsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p class="empty-text">${emptyMessage}</p>
                </div>
            `;
            return;
        }

        const callsHTML = callsToShow.map(call => this.createCallHTML(call)).join('');
        callsList.innerHTML = callsHTML;
    }

    createCallHTML(call) {
        const callTypeNames = {
            'דחוף': 'דחוף',
            'אט״ן': 'אט״ן', 
            'אט"ן': 'אט״ן',
            'ארן': 'ארן',
            'נתבג': 'נתבג',
            // Backward compatibility with English values
            urgent: 'דחוף',
            atan: 'אט״ן',
            aran: 'ארן',
            natbag: 'נתבג'
        };

        const vehicleTypeNames = {
            motorcycle: 'אופנוע',
            picanto: 'פיקנטו',
            ambulance: 'אמבולנס'
        };

        const duration = call.duration_minutes 
            ? `${call.duration_minutes} דקות`
            : 'בביצוע';

        const timeRange = call.end_time 
            ? `${call.start_time} - ${call.end_time}`
            : `${call.start_time} - בביצוע`;

        const callDate = new Date(call.call_date).toLocaleDateString('he-IL');
        const vehicleType = vehicleTypeNames[call.vehicle_type] || call.vehicle_type;

        return `
            <div class="call-item" data-call-id="${call.id}">
                <div class="call-header">
                    <span class="call-type">${callTypeNames[call.call_type] || call.call_type}</span>
                    <div class="call-actions">
                        <span class="call-time">${timeRange}</span>
                        <button class="call-menu-btn" data-call-id="${call.id}">
                            <span class="menu-dots">⋮</span>
                        </button>
                    </div>
                </div>
                <div class="call-date">📅 ${callDate}</div>
                <div class="call-location">📍 ${call.location}</div>
                <div class="call-vehicle">🚗 ${vehicleType} ${call.vehicle_number}</div>
                ${call.description ? `<div class="call-description">${call.description}</div>` : ''}
                <div class="call-footer">
                    <span class="call-duration">${duration}</span>
                </div>
            </div>
        `;
    }

    // Vehicle Management Methods
    async loadVehicleSettings() {
        try {
            const response = await fetch('/api/vehicle/current');
            const result = await response.json();

            if (result.success && result.data) {
                this.currentVehicle = {
                    number: result.data.vehicle_number,
                    type: result.data.vehicle_type
                };
            }
        } catch (error) {
            console.error('Error loading vehicle settings:', error);
            // Fallback to defaults if API fails
            this.currentVehicle = {
                number: '5248',
                type: 'motorcycle'
            };
        }
        
        this.updateVehicleDisplay();
        
        // Set vehicle settings in form
        const vehicleNumber = document.getElementById('vehicleNumber');
        const vehicleType = document.getElementById('vehicleType');
        
        if (vehicleNumber) vehicleNumber.value = this.currentVehicle.number;
        if (vehicleType) vehicleType.value = this.currentVehicle.type;
    }

    updateVehicleDisplay() {
        const vehicleTypeNames = {
            motorcycle: 'אופנוע',
            picanto: 'פיקנטו',
            ambulance: 'אמבולנס'
        };

        const currentVehicleEl = document.getElementById('currentVehicle');
        const currentVehicleTypeEl = document.getElementById('currentVehicleType');
        
        if (currentVehicleEl) currentVehicleEl.textContent = this.currentVehicle.number;
        if (currentVehicleTypeEl) currentVehicleTypeEl.textContent = vehicleTypeNames[this.currentVehicle.type] || this.currentVehicle.type;
    }

    async handleVehicleSettingsSubmit(event) {
        event.preventDefault();
        
        if (this.isLoading) return; // Prevent multiple submissions
        
        const vehicleNumber = document.getElementById('vehicleNumber').value;
        const vehicleType = document.getElementById('vehicleType').value;
        
        if (!vehicleNumber || !vehicleType) {
            this.showError('אנא מלא את כל השדות');
            return;
        }

        try {
            this.setLoading(true);
            
            const response = await fetch('/api/vehicle/current', {
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

            if (!response.ok) {
                throw new Error(result.message || 'שגיאה בשמירת הגדרות הרכב');
            }
            
            // Update current vehicle
            this.currentVehicle = { number: vehicleNumber, type: vehicleType };
            
            // Update display
            this.updateVehicleDisplay();
            
            // Close modal
            document.getElementById('vehicleSettingsModal').classList.add('hidden');
            
            this.showSuccess('הגדרות הרכב נשמרו בהצלחה!');
            
        } catch (error) {
            console.error('Error saving vehicle settings:', error);
            this.showError(error.message || 'שגיאה בשמירת הגדרות הרכב');
        } finally {
            this.setLoading(false);
        }
    }

    // Live search handler
    handleLiveSearch(event) {
        const searchTerm = event.target.value.toLowerCase();
        this.currentFilters.search = searchTerm;
        
        // Debounce the search to avoid too many updates
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.applyFilters();
        }, 150); // 150ms delay
    }

    // Filter Methods
    applyFilters() {
        const callTypeFilter = document.getElementById('filterCallType').value;
        const vehicleTypeFilter = document.getElementById('filterVehicleType').value;
        const dateFilter = document.getElementById('filterDate').value;
        const searchFilter = document.getElementById('filterSearch').value.toLowerCase();

        this.currentFilters = {
            callType: callTypeFilter,
            vehicleType: vehicleTypeFilter,
            date: dateFilter,
            search: searchFilter
        };

        this.filteredCalls = this.calls.filter(call => {
            // Filter by call type
            if (callTypeFilter && call.call_type !== callTypeFilter) return false;
            
            // Filter by vehicle type
            if (vehicleTypeFilter && call.vehicle_type !== vehicleTypeFilter) return false;
            
            // Filter by date
            if (dateFilter && call.call_date !== dateFilter) return false;
            
            // Filter by search term (location, description, call number)
            if (searchFilter) {
                const searchableText = [
                    call.location || '',
                    call.description || '',
                    call.destination || '',
                    call.call_number || '',
                    call.special_notes || '',
                    call.patient_condition || ''
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(searchFilter)) return false;
            }
            
            return true;
        });

        this.updateCallsDisplay();
    }

    clearFilters() {
        document.getElementById('filterCallType').value = '';
        document.getElementById('filterVehicleType').value = '';
        document.getElementById('filterDate').value = '';
        document.getElementById('filterSearch').value = '';
        
        this.currentFilters = { callType: '', vehicleType: '', date: '', search: '' };
        this.filteredCalls = [...this.calls];
        this.updateCallsDisplay();
    }

    resetForm() {
        const form = document.getElementById('callForm');
        if (form) {
            form.reset();
            
            // Set current date and time
            this.setCurrentDateTime();
        }
    }

    // Context menu and editing methods
    async handleContextMenuAction(action, callId) {
        const call = this.calls.find(c => c.id == callId);
        if (!call) {
            console.error('Call not found with ID:', callId);
            return;
        }

        console.log('Context menu action:', action, 'for call:', call);
        
        switch (action) {
            case 'edit':
                this.openEditModal(call);
                break;
            case 'delete':
                if (confirm('האם אתה בטוח שברצונך למחוק קריאה זו?')) {
                    await this.deleteCall(callId);
                }
                break;
        }
        this.hideContextMenu();
    }

    openEditModal(call) {
        document.getElementById('editCallId').value = call.id;
        document.getElementById('editCallType').value = call.call_type;
        document.getElementById('editCallDate').value = call.call_date;
        document.getElementById('editStartTime').value = call.start_time;
        document.getElementById('editEndTime').value = call.end_time || '';
        document.getElementById('editLocation').value = call.location;
        document.getElementById('editDescription').value = call.description || '';
        
        document.getElementById('editModal').classList.remove('hidden');
    }

    async handleEditSubmit(event) {
        event.preventDefault();
        
        const callId = document.getElementById('editCallId').value;
        const formData = {
            call_type: document.getElementById('editCallType').value,
            call_date: document.getElementById('editCallDate').value,
            start_time: document.getElementById('editStartTime').value,
            end_time: document.getElementById('editEndTime').value || null,
            location: document.getElementById('editLocation').value,
            description: document.getElementById('editDescription').value || null
        };

        try {
            this.setLoading(true);
            
            const response = await fetch(`/api/calls/${callId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'שגיאה בעדכון הקריאה');
            }

            this.showSuccess('קריאה עודכנה בהצלחה!');
            document.getElementById('editModal').classList.add('hidden');
            await this.loadStats();
            await this.loadCalls();
            
        } catch (error) {
            console.error('Error updating call:', error);
            this.showError(error.message || 'שגיאה בעדכון הקריאה');
        } finally {
            this.setLoading(false);
        }
    }

    async deleteCall(callId) {
        try {
            this.setLoading(true);
            
            const response = await fetch(`/api/calls/${callId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'שגיאה במחיקת הקריאה');
            }

            this.showSuccess('קריאה נמחקה בהצלחה!');
            await this.loadStats();
            await this.loadCalls();
            
        } catch (error) {
            console.error('Error deleting call:', error);
            this.showError(error.message || 'שגיאה במחיקת הקריאה');
        } finally {
            this.setLoading(false);
        }
    }

    async completeCall(callId) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        
        try {
            this.setLoading(true);
            
            const response = await fetch(`/api/calls/${callId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ end_time: currentTime })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'שגיאה בסיום הקריאה');
            }

            this.showSuccess('קריאה הושלמה בהצלחה!');
            await this.loadStats();
            await this.loadCalls();
            
        } catch (error) {
            console.error('Error completing call:', error);
            this.showError(error.message || 'שגיאה בסיום הקריאה');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        const overlay = document.getElementById('loadingOverlay');
        const submitBtn = document.querySelector('.submit-btn');
        
        if (loading) {
            overlay?.classList.remove('hidden');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `
                    <span class="btn-icon">⏳</span>
                    שומר...
                `;
            }
        } else {
            overlay?.classList.add('hidden');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <span class="btn-icon">✅</span>
                    רשום נסיעה
                `;
            }
        }
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'success') {
        const toastId = type === 'success' ? 'successToast' : 'errorToast';
        const toast = document.getElementById(toastId);
        
        if (toast) {
            const messageEl = toast.querySelector('.toast-message');
            if (messageEl) {
                messageEl.textContent = message;
            }
            
            // Show toast
            toast.classList.remove('hidden');
            toast.classList.add('show');
            
            // Hide after 3 seconds
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    toast.classList.add('hidden');
                }, 300);
            }, 3000);
        }
    }

    // Logout method
    async logout() {
        try {
            // Call logout API
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
        } catch (error) {
            console.error('Logout API error:', error);
        } finally {
            // Clear local storage and redirect
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            localStorage.removeItem('rememberMe');
            sessionStorage.removeItem('authToken');
            sessionStorage.removeItem('userData');
            localStorage.removeItem('userData');
            window.location.href = '/login.html';
        }
    }

    // Mobile menu initialization
    initMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
        const mobileMenuClose = document.getElementById('mobileMenuClose');
        
        // Mobile menu button
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                this.openMobileMenu();
            });
        }
        
        // Close button
        if (mobileMenuClose) {
            mobileMenuClose.addEventListener('click', () => {
                this.closeMobileMenu();
            });
        }
        
        // Overlay click to close
        if (mobileMenuOverlay) {
            mobileMenuOverlay.addEventListener('click', (e) => {
                if (e.target === mobileMenuOverlay) {
                    this.closeMobileMenu();
                }
            });
        }
        
        // Mobile menu items
        const mobileHistoryBtn = document.getElementById('mobileHistoryBtn');
        const mobileVehicleSettingsBtn = document.getElementById('mobileVehicleSettingsBtn');
        const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
        
        if (mobileHistoryBtn) {
            mobileHistoryBtn.addEventListener('click', () => {
                window.location.href = '/history.html';
            });
        }
        
        if (mobileVehicleSettingsBtn) {
            mobileVehicleSettingsBtn.addEventListener('click', () => {
                this.closeMobileMenu();
                this.loadVehicleSettings();
                document.getElementById('vehicleSettingsModal').classList.remove('hidden');
            });
        }
        
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', () => {
                if (confirm('האם אתה בטוח שברצונך להתנתק?')) {
                    this.logout();
                }
            });
        }
        
        // Update mobile badge when vehicle changes
        this.updateMobileBadge();
    }
    
    openMobileMenu() {
        const overlay = document.getElementById('mobileMenuOverlay');
        const btn = document.getElementById('mobileMenuBtn');
        
        if (overlay) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scroll
        }
        
        if (btn) {
            btn.classList.add('active');
        }
        
        // Update mobile badge
        this.updateMobileBadge();
    }
    
    closeMobileMenu() {
        const overlay = document.getElementById('mobileMenuOverlay');
        const btn = document.getElementById('mobileMenuBtn');
        
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = ''; // Restore scroll
        }
        
        if (btn) {
            btn.classList.remove('active');
        }
    }
    
    updateMobileBadge() {
        // Sync mobile badge with main badge
        const currentVehicle = document.getElementById('currentVehicle');
        const currentVehicleType = document.getElementById('currentVehicleType');
        const mobileCurrentVehicle = document.getElementById('mobileCurrentVehicle');
        const mobileCurrentVehicleType = document.getElementById('mobileCurrentVehicleType');
        
        if (currentVehicle && mobileCurrentVehicle) {
            mobileCurrentVehicle.textContent = currentVehicle.textContent;
        }
        
        if (currentVehicleType && mobileCurrentVehicleType) {
            mobileCurrentVehicleType.innerHTML = currentVehicleType.innerHTML;
        }
    }

    // Utility method to format Hebrew time
    formatHebrewTime(timeString) {
        if (!timeString) return '';
        const [hours, minutes] = timeString.split(':');
        return `${hours}:${minutes}`;
    }

    // Utility method to get Hebrew day name
    getHebrewDay() {
        const days = [
            'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'
        ];
        return days[new Date().getDay()];
    }

    // Method to export data (for future cronjob functionality)
    async exportTodayData() {
        try {
            const response = await fetch('/api/calls');
            const result = await response.json();
            
            if (result.success) {
                const dataStr = JSON.stringify(result.data, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(dataBlob);
                link.download = `mda-calls-${new Date().toISOString().split('T')[0]}.json`;
                link.click();
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showError('שגיאה בייצוא הנתונים');
        }
    }

}

// Service Worker registration for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Handle online/offline status
window.addEventListener('online', () => {
    console.log('Back online');
    // Refresh data when back online
    if (window.callCounter) {
        window.callCounter.loadStats();
        window.callCounter.loadCalls();
    }
});

window.addEventListener('offline', () => {
    console.log('Gone offline');
});

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏍️ MDA CallCounter - Starting initialization...');
    window.callCounter = new CallCounter();
    
    // Add some helpful dev tools in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🏍️ MDA CallCounter Development Mode');
        console.log('Available methods:', {
            exportData: 'callCounter.exportTodayData()',
            stats: 'callCounter.stats',
            calls: 'callCounter.calls'
        });
    }
});

// Handle visibility change to refresh data when tab becomes active
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.callCounter) {
        // Refresh data when tab becomes visible
        window.callCounter.loadStats();
        window.callCounter.loadCalls();
    }
});

// Add keyboard shortcuts
document.addEventListener('keydown', (event) => {
    // Ctrl/Cmd + Enter to submit form
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        const form = document.getElementById('callForm');
        if (form) {
            form.dispatchEvent(new Event('submit'));
        }
    }
    
    // Ctrl/Cmd + E to export data
    if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
        event.preventDefault();
        if (window.callCounter) {
            window.callCounter.exportTodayData();
        }
    }
});

// Add global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});