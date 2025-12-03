// MDA CallCounter - Client-side JavaScript

// Check authentication before initializing the app
function checkAuthentication() {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    
    if (!token) {
        console.log('🔐 No auth token found, redirecting to login');
        window.location.href = '/login.html';
        return false;
    }

    console.log('🔐 Auth token found, proceeding with initialization');
    
    // Do async validation in background without blocking initialization
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
            
            // Refresh data if CallCounter is initialized
            if (window.callCounter) {
                // Update vehicle info with fresh user data
                window.callCounter.currentVehicle = {
                    number: window.callCounter.getUserVehicleNumber(),
                    type: window.callCounter.getUserVehicleType()
                };
                window.callCounter.updateVehicleDisplay();
                
                // Retry loading vehicle settings now that auth is confirmed
                setTimeout(async () => {
                    await window.callCounter.loadVehicleSettings();
                    window.callCounter.updateVehicleDisplay();
                    await window.callCounter.loadStats();
                    await window.callCounter.loadCalls();
                }, 100);
            } else {
                // Update vehicle badge if CallCounter not initialized yet
                if (typeof updateVehicleBadge === 'function') {
                    updateVehicleBadge();
                }
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

// Context menu initialization will be handled in CallCounter init

// MDA CallCounter - Client-side JavaScript
class CallCounter {
    constructor() {
        this.isLoading = false;
        this.calls = [];
        this.filteredCalls = [];
        this.alertCodes = [];
        this.medicalCodes = [];
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
            number: this.getUserVehicleNumber(),
            type: this.getUserVehicleType()
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

    // Helper method to get user's vehicle number from their MDA code
    getUserVehicleNumber() {
        try {
            // Try both localStorage and sessionStorage
            const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
            console.log('📱 Getting user vehicle number, userData:', userData);
            
            if (userData) {
                const user = JSON.parse(userData);
                console.log('📱 Parsed user data:', user);
                const mdaCode = user.mdaCode || user.mda_code;
                console.log('📱 User MDA code:', mdaCode);
                return mdaCode || '5248'; // Fallback to 5248 if no MDA code
            }
            
            console.log('📱 No user data found, using fallback 5248');
            return '5248'; // Default fallback
        } catch (error) {
            console.error('📱 Error getting user vehicle number:', error);
            return '5248';
        }
    }

    // Helper method to auto-detect vehicle type based on MDA code
    getUserVehicleType() {
        try {
            const mdaCode = this.getUserVehicleNumber();
            console.log('📱 Detecting vehicle type for MDA code:', mdaCode);
            const vehicleType = this.detectVehicleType(mdaCode);
            console.log('📱 Detected vehicle type:', vehicleType);
            return vehicleType;
        } catch (error) {
            console.error('📱 Error detecting vehicle type:', error);
            return 'motorcycle'; // Safe fallback
        }
    }

    // Vehicle type detection function (same logic as server)
    detectVehicleType(mdaCode) {
        console.log('🚗 Detecting vehicle type for code:', mdaCode);
        
        if (!mdaCode || typeof mdaCode !== 'string') {
            console.log('🚗 Invalid MDA code, defaulting to ambulance');
            return 'ambulance';
        }
        
        const codeStr = mdaCode.toString().trim();
        const codeNum = parseInt(codeStr, 10);
        const firstDigit = codeStr.charAt(0);
        const firstTwoDigits = codeStr.substring(0, 2);
        
        console.log(`🔍 DETAILED: code="${codeStr}", len=${codeStr.length}, firstDigit="${firstDigit}", firstTwo="${firstTwoDigits}", num=${codeNum}`);
        if (codeStr.length < 2) {
            console.log('🚗 Code too short, defaulting to ambulance');
            return 'ambulance';
        }
        
        console.log('🚗 Code analysis - length:', codeStr.length, 'first digit:', firstDigit, 'first two:', firstTwoDigits);
        
        // Personal standby detection - 5-digit codes starting with 1 or 2
        if (codeStr.length === 5 && (firstDigit === '1' || firstDigit === '2')) {
            console.log('🚗 Detected: personal_standby (5-digit 1xxxx or 2xxxx)');
            return 'personal_standby';
        }
        
        // 4-digit codes
        if (codeStr.length === 4) {
            if (firstDigit === '5') {
                console.log('🚗 Detected: motorcycle');
                return 'motorcycle';
            }
            if (firstDigit === '6') {
                console.log('🚗 Detected: picanto');
                return 'picanto';
            }
            if (['1', '2', '3', '4', '7', '8', '9'].includes(firstDigit)) {
                console.log('🚗 Detected: ambulance (4-digit)');
                return 'ambulance';
            }
        }
        
        // 2 or 3 digit codes starting with 1,2,3,4,7,8,9 are ambulances
        if ((codeStr.length === 2 || codeStr.length === 3) && 
            ['1', '2', '3', '4', '7', '8', '9'].includes(firstDigit)) {
            console.log('🚗 Detected: ambulance (2-3 digit)');
            return 'ambulance';
        }
        
        console.log('🚗 No specific detection, defaulting to ambulance');
        return 'ambulance'; // default
    }

    // Get vehicle emoji based on vehicle type text
    getVehicleEmojiFromType(vehicleTypeText) {
        if (!vehicleTypeText) return '🚑';
        
        const text = vehicleTypeText.toLowerCase();
        
        // Check for Hebrew names
        if (text.includes('אופנוע')) return '🏍️';
        if (text.includes('פיקנטו')) return '🚗';
        if (text.includes('אמבולנס')) return '🚑';
        if (text.includes('כונן אישי')) return '👨‍⚕️';
        
        // Check for English names
        if (text.includes('motorcycle')) return '🏍️';
        if (text.includes('picanto')) return '🚗';
        if (text.includes('ambulance')) return '🚑';
        if (text.includes('personal_standby')) return '👨‍⚕️';
        
        // Default to ambulance
        return '🚑';
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
            
            // Initialize user info first
            this.initUserInfo();
            
            // Update vehicle info based on user's MDA code - do this after user info is loaded
            console.log('🏍️ Initializing vehicle settings...');
            this.currentVehicle = {
                number: this.getUserVehicleNumber(),
                type: this.getUserVehicleType()
            };
            console.log('🏍️ Initial vehicle settings:', this.currentVehicle);
            
            // Update vehicle display immediately with detected info
            this.updateVehicleDisplay();
            
            // Bind events first
            this.bindEvents();
            this.setCurrentTime();
            
            // Wait a moment for authentication to complete, then load data
            setTimeout(async () => {
                console.log('🏍️ Loading vehicle settings and data...');
                await this.loadVehicleSettings();
                this.updateVehicleDisplay();
                await this.loadCodes(); // Load alert and medical codes
                await this.loadStats();
                await this.loadCalls();
            }, 500);
            
            // Refresh data every 30 seconds
            setInterval(() => {
                this.loadStats();
                this.loadCalls();
            }, 30000);
            
            // Check and update date every minute (to catch midnight transition)
            setInterval(() => {
                this.updateDateIfNeeded();
            }, 60000); // Check every minute
            
            // Also set up a specific check at midnight
            this.setupMidnightDateUpdate();
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

        // Historical view button
        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                window.location.href = '/history.html';
            });
        }

        // Entry codes button
        const entryCodesBtn = document.getElementById('entryCodesBtn');
        if (entryCodesBtn) {
            entryCodesBtn.addEventListener('click', () => {
                window.location.href = '/entry-codes.html';
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
        
        // Store the current date for comparison
        this.lastSetDate = dateString;
    }
    
    updateDateIfNeeded() {
        const now = new Date();
        const currentDateString = now.toISOString().split('T')[0];
        const dateInput = document.getElementById('callDate');
        
        // Only update if the date has changed and the field hasn't been manually modified
        if (dateInput && this.lastSetDate && currentDateString !== this.lastSetDate) {
            console.log('📅 Date changed from', this.lastSetDate, 'to', currentDateString);
            
            // Only auto-update if the field still has yesterday's date (user hasn't changed it)
            if (dateInput.value === this.lastSetDate) {
                dateInput.value = currentDateString;
                console.log('📅 Auto-updated date field to:', currentDateString);
            }
            
            this.lastSetDate = currentDateString;
        }
    }
    
    setupMidnightDateUpdate() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const msUntilMidnight = tomorrow - now;
        
        // Set timeout to update at midnight
        setTimeout(() => {
            console.log('🌙 Midnight reached - updating date');
            this.updateDateIfNeeded();
            
            // Set up next midnight update (24 hours from now)
            setInterval(() => {
                this.updateDateIfNeeded();
            }, 24 * 60 * 60 * 1000); // Every 24 hours
        }, msUntilMidnight);
        
        console.log('📅 Midnight date update scheduled in', Math.round(msUntilMidnight / 1000 / 60), 'minutes');
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
        
        // Check if getFormData returned null (validation failed)
        if (!formData) {
            return;
        }
        
        if (!this.validateFormData(formData)) {
            return;
        }

        await this.submitCall(formData);
    }

    getFormData() {
        const city = document.getElementById('city').value.trim();
        const street = document.getElementById('street').value.trim();
        const locationDetails = document.getElementById('location').value.trim();
        const meterVisaNumber = document.getElementById('meterVisaNumber').value.trim();
        const entryCode = document.getElementById('entryCode').value.trim();
        
        // Validate meter/visa number is numeric only if provided
        if (meterVisaNumber && !/^\d+$/.test(meterVisaNumber)) {
            this.showError('מספר מונה/ויזה חייב להכיל רק מספרים');
            return null;
        }
        
        // Combine city, street, and details into full location
        let fullLocation = `${city}, ${street}`;
        if (locationDetails) {
            fullLocation += `, ${locationDetails}`;
        }
        
        return {
            call_type: document.getElementById('callType').value,
            call_date: document.getElementById('callDate').value,
            start_time: document.getElementById('startTime').value,
            end_time: document.getElementById('endTime').value || null,
            location: fullLocation,
            city: city,
            street: street,
            alert_code_id: document.getElementById('alertCode').value || null,
            medical_code_id: document.getElementById('medicalCode').value || null,
            meter_visa_number: meterVisaNumber || null,
            entry_code: entryCode || null,
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
        
        if (!data.city || !data.city.trim()) {
            this.showError('אנא הזן עיר');
            return false;
        }
        
        if (!data.street || !data.street.trim()) {
            this.showError('אנא הזן רחוב');
            return false;
        }

        // Validate time format - allow midnight crossover
        if (data.end_time && data.start_time) {
            // Parse times
            const [startHour, startMin] = data.start_time.split(':').map(Number);
            const [endHour, endMin] = data.end_time.split(':').map(Number);
            
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            
            // Allow midnight crossover - if end is earlier than start, assume next day
            // Only validate if both times are the same (which would be invalid)
            if (startMinutes === endMinutes) {
                this.showError('שעת ההתחלה ושעת הסיום לא יכולות להיות זהות');
                return false;
            }
            
            // Calculate duration considering midnight crossover
            let durationMinutes;
            if (endMinutes < startMinutes) {
                // Midnight crossover: add 24 hours to end time
                durationMinutes = (endMinutes + 24 * 60) - startMinutes;
            } else {
                durationMinutes = endMinutes - startMinutes;
            }
            
            // Validate reasonable duration (max 12 hours)
            if (durationMinutes > 12 * 60) {
                this.showError('משך הנסיעה לא יכול להיות יותר מ-12 שעות');
                return false;
            }
            
            console.log(`⏰ Call duration: ${durationMinutes} minutes (${data.start_time} to ${data.end_time})`);
        }
        
        return true;
    }

    async submitCall(callData) {
        try {
            this.setLoading(true);
            
            console.log('📞 Submitting call with data:', callData);
            console.log('📞 Auth headers:', this.getAuthHeaders());
            
            const response = await fetch('/api/calls', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(callData)
            });

            console.log('📞 Response status:', response.status);
            const result = await response.json();
            console.log('📞 Response result:', result);

            if (!response.ok) {
                console.error('📞 Call submission failed:', result);
                console.error('📞 Server error message:', result.message);
                console.error('📞 Server error details:', result.error);
                
                // Show detailed error to user for debugging
                alert(`Error ${response.status}: ${result.message || 'Unknown error'}\n\nDetails: ${JSON.stringify(result, null, 2)}`);
                
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
            console.log('📊 Loading stats...');
            const response = await fetch('/api/stats', {
                headers: this.getAuthHeaders()
            });
            
            console.log('📊 Stats response status:', response.status);
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('📊 Authentication failed, redirecting to login');
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📊 Stats result:', result);

            if (result.success) {
                this.stats = result.data;
                this.updateStatsDisplay();
            } else {
                console.error('📊 Error in stats result:', result.message);
            }
        } catch (error) {
            console.error('📊 Error loading stats:', error);
        }
    }

    async loadCalls() {
        try {
            console.log('📞 Loading calls...');
            // Load only today's calls for the "Latest Calls" section
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`/api/calls?date=${today}`, {
                headers: this.getAuthHeaders()
            });
            
            console.log('📞 Calls response status:', response.status);
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('📞 Authentication failed, redirecting to login');
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📞 Calls result:', result);

            if (result.success) {
                this.calls = result.data;
                this.filteredCalls = [...this.calls];
                console.log('📞 Loaded', this.calls.length, 'calls');
                this.updateCallsDisplay();
            } else {
                console.error('📞 Error in calls result:', result.message);
            }
        } catch (error) {
            console.error('📞 Error loading calls:', error);
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
            ambulance: 'אמבולנס',
            personal_standby: 'כונן אישי'
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
                <div class="call-vehicle">${this.getVehicleEmojiFromType(vehicleType)} ${vehicleType} ${call.vehicle_number}</div>
                ${this.getCodeDisplayHTML(call)}
                ${call.description ? `<div class="call-description">💬 ${call.description}</div>` : ''}
                <div class="call-footer">
                    <span class="call-duration">${duration}</span>
                </div>
            </div>
        `;
    }

    // Get code display HTML for a call
    getCodeDisplayHTML(call) {
        let html = '';
        
        // Find alert code
        if (call.alert_code_id && this.alertCodes && this.alertCodes.length > 0) {
            const alertCode = this.alertCodes.find(c => c.id == call.alert_code_id);
            if (alertCode && alertCode.code) {
                html += `<div class="call-code">🚨 קוד הזנקה: ${alertCode.code}</div>`;
            }
        }
        
        // Find medical code
        if (call.medical_code_id && this.medicalCodes && this.medicalCodes.length > 0) {
            const medicalCode = this.medicalCodes.find(c => c.id == call.medical_code_id);
            if (medicalCode && medicalCode.code) {
                html += `<div class="call-code">🏥 קוד רפואי: ${medicalCode.code}</div>`;
            }
        }
        
        return html;
    }

    // Vehicle Management Methods
    async loadVehicleSettings() {
        try {
            console.log('🚗 Loading vehicle settings with headers:', this.getAuthHeaders());
            const response = await fetch('/api/vehicle/current', {
                headers: this.getAuthHeaders()
            });
            
            console.log('🚗 Vehicle settings response status:', response.status);
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('🚗 Vehicle settings: Authentication failed');
                    // Don't redirect here, just use fallback
                } else {
                    console.error('🚗 Vehicle settings API error:', response.status);
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log('🚗 Vehicle settings result:', result);

            if (result.success && result.data) {
                this.currentVehicle = {
                    number: result.data.vehicle_number,
                    type: result.data.vehicle_type
                };
                console.log('🚗 Updated vehicle from API:', this.currentVehicle);
            }
        } catch (error) {
            console.error('🚗 Error loading vehicle settings, using fallback:', error);
            // Fallback to user's MDA code if API fails
            this.currentVehicle = {
                number: this.getUserVehicleNumber(),
                type: this.getUserVehicleType()
            };
            console.log('🚗 Using fallback vehicle:', this.currentVehicle);
        }
        
        this.updateVehicleDisplay();
        
        // Set vehicle settings in form
        const vehicleNumber = document.getElementById('vehicleNumber');
        const vehicleType = document.getElementById('vehicleType');
        
        if (vehicleNumber) vehicleNumber.value = this.currentVehicle.number;
        if (vehicleType) vehicleType.value = this.currentVehicle.type;
    }

    // Load alert and medical codes for dropdowns
    async loadCodes() {
        try {
            console.log('📋 Loading codes...');
            
            // Load alert codes
            const alertResponse = await fetch('/api/codes/alert', {
                headers: this.getAuthHeaders()
            });
            
            if (alertResponse.ok) {
                const alertResult = await alertResponse.json();
                this.alertCodes = alertResult.data || [];
                console.log('📋 Loaded', this.alertCodes.length, 'alert codes');
                this.populateAlertCodeDropdowns();
            }
            
            // Load medical codes
            const medicalResponse = await fetch('/api/codes/medical', {
                headers: this.getAuthHeaders()
            });
            
            if (medicalResponse.ok) {
                const medicalResult = await medicalResponse.json();
                this.medicalCodes = medicalResult.data || [];
                console.log('📋 Loaded', this.medicalCodes.length, 'medical codes');
                this.populateMedicalCodeDropdowns();
            }
        } catch (error) {
            console.error('Error loading codes:', error);
            this.showError('שגיאה בטעינת קודי הזנקה וקודים רפואיים');
        }
    }

    // Populate alert code dropdowns
    populateAlertCodeDropdowns() {
        const alertCodeSelect = document.getElementById('alertCode');
        const editAlertCodeSelect = document.getElementById('editAlertCode');
        
        const options = this.alertCodes
            .filter(code => code && code.code) // Only include codes with a valid code property
            .map(code => `<option value="${code.id}">${code.code}</option>`)
            .join('');
        
        if (alertCodeSelect) {
            alertCodeSelect.innerHTML = '<option value="">בחר קוד הזנקה</option>' + options;
            // Destroy existing Select2 if it exists
            if ($(alertCodeSelect).hasClass('select2-hidden-accessible')) {
                $(alertCodeSelect).select2('destroy');
            }
            // Initialize Select2 with search
            $(alertCodeSelect).select2({
                placeholder: 'חפש או בחר קוד הזנקה',
                allowClear: true,
                dir: 'rtl',
                minimumResultsForSearch: 0, // Always show search box
                language: {
                    noResults: function() {
                        return 'לא נמצאו תוצאות';
                    },
                    searching: function() {
                        return 'מחפש...';
                    }
                }
            });
        }
        
        if (editAlertCodeSelect) {
            editAlertCodeSelect.innerHTML = '<option value="">בחר קוד הזנקה</option>' + options;
            // Destroy existing Select2 if it exists
            if ($(editAlertCodeSelect).hasClass('select2-hidden-accessible')) {
                $(editAlertCodeSelect).select2('destroy');
            }
            // Initialize Select2 with search
            $(editAlertCodeSelect).select2({
                placeholder: 'חפש או בחר קוד הזנקה',
                allowClear: true,
                dir: 'rtl',
                minimumResultsForSearch: 0, // Always show search box
                language: {
                    noResults: function() {
                        return 'לא נמצאו תוצאות';
                    },
                    searching: function() {
                        return 'מחפש...';
                    }
                }
            });
        }
    }

    // Populate medical code dropdowns
    populateMedicalCodeDropdowns() {
        const medicalCodeSelect = document.getElementById('medicalCode');
        const editMedicalCodeSelect = document.getElementById('editMedicalCode');
        
        const options = this.medicalCodes
            .filter(code => code && code.code) // Only include codes with a valid code property
            .map(code => `<option value="${code.id}">${code.code}</option>`)
            .join('');
        
        if (medicalCodeSelect) {
            medicalCodeSelect.innerHTML = '<option value="">בחר קוד רפואי</option>' + options;
            // Destroy existing Select2 if it exists
            if ($(medicalCodeSelect).hasClass('select2-hidden-accessible')) {
                $(medicalCodeSelect).select2('destroy');
            }
            // Initialize Select2 with search
            $(medicalCodeSelect).select2({
                placeholder: 'חפש או בחר קוד רפואי',
                allowClear: true,
                dir: 'rtl',
                minimumResultsForSearch: 0, // Always show search box
                language: {
                    noResults: function() {
                        return 'לא נמצאו תוצאות';
                    },
                    searching: function() {
                        return 'מחפש...';
                    }
                }
            });
        }
        
        if (editMedicalCodeSelect) {
            editMedicalCodeSelect.innerHTML = '<option value="">בחר קוד רפואי</option>' + options;
            // Destroy existing Select2 if it exists
            if ($(editMedicalCodeSelect).hasClass('select2-hidden-accessible')) {
                $(editMedicalCodeSelect).select2('destroy');
            }
            // Initialize Select2 with search
            $(editMedicalCodeSelect).select2({
                placeholder: 'חפש או בחר קוד רפואי',
                allowClear: true,
                dir: 'rtl',
                minimumResultsForSearch: 0, // Always show search box
                language: {
                    noResults: function() {
                        return 'לא נמצאו תוצאות';
                    },
                    searching: function() {
                        return 'מחפש...';
                    }
                }
            });
        }
    }

    updateVehicleDisplay() {
        console.log('🚗 Updating vehicle display with:', this.currentVehicle);
        
        // Use the HTML updateVehicleBadge function if available for consistency
        if (typeof updateVehicleBadge === 'function') {
            console.log('🚗 Calling HTML updateVehicleBadge function');
            updateVehicleBadge();
        }
        
        // Fallback to direct update if HTML function not available
        const vehicleTypeNames = {
            motorcycle: 'אופנוע',
            picanto: 'פיקנטו',
            ambulance: 'אמבולנס',
            personal_standby: 'כונן אישי'
        };

        const vehicleEmojis = {
            motorcycle: '🏍️',
            picanto: '🚗',
            ambulance: '🚑',
            personal_standby: '👨‍⚕️'
        };

        const currentVehicleEl = document.getElementById('currentVehicle');
        const currentVehicleTypeEl = document.getElementById('currentVehicleType');
        
        if (currentVehicleEl) {
            currentVehicleEl.textContent = this.currentVehicle.number;
        }
        
        if (currentVehicleTypeEl) {
            const emoji = vehicleEmojis[this.currentVehicle.type] || '🚑';
            const name = vehicleTypeNames[this.currentVehicle.type] || this.currentVehicle.type;
            currentVehicleTypeEl.innerHTML = `${emoji} ${name}`;
        }
        
        // Also update mobile badge if present
        const mobileVehicleEl = document.getElementById('mobileCurrentVehicle');
        const mobileVehicleTypeEl = document.getElementById('mobileCurrentVehicleType');
        
        if (mobileVehicleEl) {
            mobileVehicleEl.textContent = this.currentVehicle.number;
        }
        
        if (mobileVehicleTypeEl) {
            const emoji = vehicleEmojis[this.currentVehicle.type] || '🚑';
            const name = vehicleTypeNames[this.currentVehicle.type] || this.currentVehicle.type;
            mobileVehicleTypeEl.innerHTML = `${emoji} ${name}`;
        }

        // Add admin panel access if user is admin
        this.updateAdminAccess();
    }

    updateAdminAccess() {
        // Check if user is admin and add admin panel button
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!token) {
            console.log('🔐 No token found for admin check');
            return;
        }

        // Decode token to check admin status (simple check)
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log('🔐 Token payload:', payload);
            console.log('🔐 isAdmin status:', payload.isAdmin);
            
            if (payload.isAdmin) {
                console.log('🔐 User is admin, adding admin button');
                this.addAdminButton();
                this.showMobileAdminButton();
            } else {
                console.log('🔐 User is not admin');
            }
        } catch (error) {
            console.log('🔐 Could not decode token for admin check:', error);
        }
    }

    addAdminButton() {
        // Check if admin button already exists
        if (document.getElementById('adminBtn')) {
            console.log('🔐 Admin button already exists');
            return;
        }

        console.log('🔐 Creating admin button');

        // Add admin button to header actions
        const headerActions = document.querySelector('.header-actions');
        console.log('🔐 Header actions element:', headerActions);
        
        if (headerActions) {
            const adminBtn = document.createElement('button');
            adminBtn.id = 'adminBtn';
            adminBtn.className = 'action-btn admin-btn';
            adminBtn.title = 'ממשק מנהל מערכת';
            adminBtn.innerHTML = '<span class="icon">⚙️</span>';
            adminBtn.addEventListener('click', () => {
                console.log('🔐 Admin button clicked, navigating to admin panel');
                window.location.href = '/admin.html';
            });
            
            // Insert before refresh button
            const refreshBtn = document.getElementById('refreshBtn');
            if (refreshBtn) {
                console.log('🔐 Inserting admin button before refresh button');
                headerActions.insertBefore(adminBtn, refreshBtn);
            } else {
                console.log('🔐 Appending admin button to header actions');
                headerActions.appendChild(adminBtn);
            }
            
            console.log('🔐 Admin button created successfully');
        } else {
            console.log('🔐 Header actions element not found');
        }
    }

    showMobileAdminButton() {
        // Show the mobile admin button for admin users
        const mobileAdminBtn = document.getElementById('mobileAdminBtn');
        if (mobileAdminBtn) {
            console.log('🔐 Showing mobile admin button');
            mobileAdminBtn.style.display = 'flex';
        } else {
            console.log('🔐 Mobile admin button not found');
        }
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
        
        // Split location into city, street, and details
        // Expected format: "City, Street, Details" or "City, Street"
        const locationParts = (call.location || '').split(',').map(s => s.trim());
        document.getElementById('editCity').value = locationParts[0] || '';
        document.getElementById('editStreet').value = locationParts[1] || '';
        document.getElementById('editLocation').value = locationParts.slice(2).join(', ') || '';
        
        // Set meter/visa number
        document.getElementById('editMeterVisaNumber').value = call.meter_visa_number || '';
        
        // Set entry code
        document.getElementById('editEntryCode').value = call.entry_code || '';
        
        // Set code dropdowns
        document.getElementById('editAlertCode').value = call.alert_code_id || '';
        document.getElementById('editMedicalCode').value = call.medical_code_id || '';
        
        document.getElementById('editDescription').value = call.description || '';
        
        document.getElementById('editModal').classList.remove('hidden');
    }

    async handleEditSubmit(event) {
        event.preventDefault();
        
        const callId = document.getElementById('editCallId').value;
        const city = document.getElementById('editCity').value.trim();
        const street = document.getElementById('editStreet').value.trim();
        const locationDetails = document.getElementById('editLocation').value.trim();
        const meterVisaNumber = document.getElementById('editMeterVisaNumber').value.trim();
        const entryCode = document.getElementById('editEntryCode').value.trim();
        
        // Validate meter/visa number is numeric only if provided
        if (meterVisaNumber && !/^\d+$/.test(meterVisaNumber)) {
            this.showToast('מספר מונה/ויזה חייב להכיל רק מספרים', 'error');
            return;
        }
        
        // Combine city, street, and details into full location
        let fullLocation = `${city}, ${street}`;
        if (locationDetails) {
            fullLocation += `, ${locationDetails}`;
        }
        
        const formData = {
            call_type: document.getElementById('editCallType').value,
            call_date: document.getElementById('editCallDate').value,
            start_time: document.getElementById('editStartTime').value,
            end_time: document.getElementById('editEndTime').value || null,
            location: fullLocation,
            city: city,
            street: street,
            meter_visa_number: meterVisaNumber || null,
            entry_code: entryCode || null,
            alert_code_id: document.getElementById('editAlertCode').value || null,
            medical_code_id: document.getElementById('editMedicalCode').value || null,
            description: document.getElementById('editDescription').value || null
        };

        try {
            this.setLoading(true);
            
            const response = await fetch(`/api/calls/${callId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
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
                method: 'DELETE',
                headers: this.getAuthHeaders()
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
        const mobileEntryCodesBtn = document.getElementById('mobileEntryCodesBtn');
        const mobileAdminBtn = document.getElementById('mobileAdminBtn');
        const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
        
        if (mobileHistoryBtn) {
            mobileHistoryBtn.addEventListener('click', () => {
                window.location.href = '/history.html';
            });
        }
        
        if (mobileEntryCodesBtn) {
            mobileEntryCodesBtn.addEventListener('click', () => {
                window.location.href = '/entry-codes.html';
            });
        }
        
        if (mobileAdminBtn) {
            mobileAdminBtn.addEventListener('click', () => {
                window.location.href = '/admin.html';
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
    
    // Check authentication first
    if (!checkAuthentication()) {
        return;
    }
    
    // Initialize CallCounter
    window.callCounter = new CallCounter();
    
    // Check admin access after initialization
    setTimeout(() => {
        if (window.callCounter && window.callCounter.updateAdminAccess) {
            console.log('🔐 Checking admin access after initialization');
            window.callCounter.updateAdminAccess();
        }
    }, 100);
    
    // Setup context menu
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
    
    // Add some helpful dev tools in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🏍️ MDA CallCounter Development Mode');
        console.log('Available methods:', {
            exportData: 'callCounter.exportTodayData()',
            stats: 'callCounter.stats',
            calls: 'callCounter.calls',
            goToAdmin: 'goToAdmin()', // Add manual admin navigation
            findAdminBtn: 'findAdminBtn()' // Add function to find admin button
        });
        
        // Manual admin navigation function
        window.goToAdmin = function() {
            console.log('🔐 Manual admin navigation...');
            window.location.href = '/admin.html';
        };
        
        // Function to find and highlight admin button
        window.findAdminBtn = function() {
            const adminBtn = document.getElementById('adminBtn');
            if (adminBtn) {
                console.log('🔐 Admin button found:', adminBtn);
                adminBtn.style.border = '3px solid red';
                adminBtn.style.backgroundColor = 'yellow';
                adminBtn.scrollIntoView();
                return adminBtn;
            } else {
                console.log('❌ Admin button not found');
                return null;
            }
        };
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