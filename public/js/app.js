// MDA CallCounter - Client-side JavaScript

// Check authentication before initializing the app
function checkAuthentication() {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    
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

// Input validation functions
function setupInputValidation() {
    // Validation rules for different field types
    const validationRules = {
        'numbers-only': {
            regex: /^[0-9]*$/,
            onInvalidChar: (char) => 'רק ספרות מותרות',
            allowedChars: '0123456789'
        },
        'letters-apostrophe-dash': {
            regex: /^[\u0590-\u05FF\s\-']*$/,  // Hebrew letters, space, dash, apostrophe
            onInvalidChar: (char) => 'יש להשתמש רק באותיות, מינוס (-) וגרש (\')',
            allowedChars: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZאבגדהוזחטיכלמנסעפצקרשתן -\''
        },
        'letters-apostrophe-dash-comma': {
            regex: /^[\u0590-\u05FF\s\-',]*$/,  // Hebrew letters, space, dash, apostrophe, comma
            onInvalidChar: (char) => 'יש להשתמש רק באותיות, מינוס (-), גרש (\') וקומה (,)',
            allowedChars: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZאבגדהוזחטיכלמנסעפצקרשתן -\','
        },
        'letters-numbers-apostrophe-dash': {
            regex: /^[\u0590-\u05FF0-9\s\-']*$/,  // Hebrew letters, numbers, space, dash, apostrophe
            onInvalidChar: (char) => 'יש להשתמש רק באותיות, ספרות, מינוס (-) וגרש (\')',
            allowedChars: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789אבגדהוזחטיכלמנסעפצקרשתן -\''
        },
        'letters-numbers-apostrophe-dash-comma': {
            regex: /^[\u0590-\u05FF0-9\s\-',]*$/,  // Hebrew letters, numbers, space, dash, apostrophe, comma
            onInvalidChar: (char) => 'יש להשתמש רק באותיות, ספרות, מינוס (-), גרש (\') וקומה (,)',
            allowedChars: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789אבגדהוזחטיכלמנסעפצקרשתן -\','
        }
    };

    // Attach input validation to all fields with data-validation attribute
    document.querySelectorAll('[data-validation]').forEach(input => {
        const validationType = input.getAttribute('data-validation');
        const rule = validationRules[validationType];

        if (!rule) return;

        // Handle paste events - clean invalid characters
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const cleanedText = pastedText.split('').filter(char => {
                if (validationType === 'numbers-only') {
                    return /\d/.test(char);
                } else if (validationType === 'letters-apostrophe-dash') {
                    return /^[\u0590-\u05FF\s\-']$/.test(char) || /[a-zA-Z]/.test(char);
                } else if (validationType === 'letters-apostrophe-dash-comma') {
                    return /^[\u0590-\u05FF\s\-',]$/.test(char) || /[a-zA-Z]/.test(char);
                } else if (validationType === 'letters-numbers-apostrophe-dash') {
                    return /^[\u0590-\u05FF0-9\s\-']$/.test(char) || /[a-zA-Z0-9]/.test(char);
                } else if (validationType === 'letters-numbers-apostrophe-dash-comma') {
                    return /^[\u0590-\u05FF0-9\s\-',]$/.test(char) || /[a-zA-Z0-9]/.test(char);
                }
                return false;
            }).join('');
            
            input.value = cleanedText;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Handle keyboard input - prevent invalid characters
        input.addEventListener('keypress', (e) => {
            const char = String.fromCharCode(e.which);
            
            if (validationType === 'numbers-only') {
                if (!/\d/.test(char)) {
                    e.preventDefault();
                    showInputError(input, 'רק ספרות מותרות');
                }
            } else if (validationType === 'letters-apostrophe-dash') {
                // Allow Hebrew letters, English letters, space, dash, apostrophe
                if (!/^[\u0590-\u05FF\s\-'a-zA-Z]$/.test(char)) {
                    e.preventDefault();
                    showInputError(input, 'יש להשתמש רק באותיות, מינוס (-) וגרש (\')');
                }
            } else if (validationType === 'letters-apostrophe-dash-comma') {
                // Allow Hebrew letters, English letters, space, dash, apostrophe, comma
                if (!/^[\u0590-\u05FF\s\-',a-zA-Z]$/.test(char)) {
                    e.preventDefault();
                    showInputError(input, 'יש להשתמש רק באותיות, מינוס (-), גרש (\') וקומה (,)');
                }
            } else if (validationType === 'letters-numbers-apostrophe-dash') {
                // Allow Hebrew letters, English letters, numbers, space, dash, apostrophe
                if (!/^[\u0590-\u05FF0-9\s\-'a-zA-Z]$/.test(char)) {
                    e.preventDefault();
                    showInputError(input, 'יש להשתמש רק באותיות, ספרות, מינוס (-) וגרש (\')');
                }
            } else if (validationType === 'letters-numbers-apostrophe-dash-comma') {
                // Allow Hebrew letters, English letters, numbers, space, dash, apostrophe, comma
                if (!/^[\u0590-\u05FF0-9\s\-',a-zA-Z]$/.test(char)) {
                    e.preventDefault();
                    showInputError(input, 'יש להשתמש רק באותיות, ספרות, מינוס (-), גרש (\') וקומה (,)');
                }
            }
        });

        // Handle input changes - clean up any invalid characters that might have slipped through
        input.addEventListener('input', (e) => {
            let cleanedValue = e.target.value;
            let hasInvalid = false;

            if (validationType === 'numbers-only') {
                const newValue = e.target.value.replace(/[^\d]/g, '');
                if (newValue !== e.target.value) {
                    hasInvalid = true;
                }
                e.target.value = newValue;
            } else if (validationType === 'letters-apostrophe-dash') {
                const newValue = e.target.value.replace(/[^\u0590-\u05FF\s\-'a-zA-Z]/g, '');
                if (newValue !== e.target.value) {
                    hasInvalid = true;
                }
                e.target.value = newValue;
            } else if (validationType === 'letters-apostrophe-dash-comma') {
                const newValue = e.target.value.replace(/[^\u0590-\u05FF\s\-',a-zA-Z]/g, '');
                if (newValue !== e.target.value) {
                    hasInvalid = true;
                }
                e.target.value = newValue;
            } else if (validationType === 'letters-numbers-apostrophe-dash') {
                const newValue = e.target.value.replace(/[^\u0590-\u05FF0-9\s\-'a-zA-Z]/g, '');
                if (newValue !== e.target.value) {
                    hasInvalid = true;
                }
                e.target.value = newValue;
            } else if (validationType === 'letters-numbers-apostrophe-dash-comma') {
                const newValue = e.target.value.replace(/[^\u0590-\u05FF0-9\s\-',a-zA-Z]/g, '');
                if (newValue !== e.target.value) {
                    hasInvalid = true;
                }
                e.target.value = newValue;
            }

            // Show error feedback if invalid characters were removed
            if (hasInvalid) {
                showInputError(input, rule.onInvalidChar());
            } else {
                clearInputError(input);
            }
        });
    });

    // Helper functions for error display
    function showInputError(input, message) {
        input.classList.add('input-error');
        
        // Remove existing error message if present
        const existingError = input.parentElement.querySelector('.input-error-msg');
        if (existingError) {
            existingError.remove();
        }
        
        // Add new error message
        const errorMsg = document.createElement('div');
        errorMsg.className = 'input-error-msg';
        errorMsg.textContent = message;
        input.parentElement.appendChild(errorMsg);
    }

    function clearInputError(input) {
        input.classList.remove('input-error');
        const errorMsg = input.parentElement.querySelector('.input-error-msg');
        if (errorMsg) {
            errorMsg.remove();
        }
    }
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
    // Get current user ID
    getUserId() {
        if (this.currentUser && this.currentUser.id) {
            return this.currentUser.id;
        }
        const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                return user.id;
            } catch (error) {
                console.error('Error parsing user data:', error);
            }
        }
        return null;
    }

    getUserVehicleNumber() {
        try {
            // Try both localStorage and sessionStorage
            const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
            
            if (userData) {
                const user = JSON.parse(userData);
                const mdaCode = user.mdaCode || user.mda_code;
                return mdaCode || '5248'; // Fallback to 5248 if no MDA code
            }
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
            const vehicleType = this.detectVehicleType(mdaCode);
            return vehicleType;
        } catch (error) {
            console.error('📱 Error detecting vehicle type:', error);
            return 'motorcycle'; // Safe fallback
        }
    }

    // Vehicle type detection function (same logic as server)
    detectVehicleType(mdaCode) {
        if (!mdaCode || mdaCode.length < 2) return 'ambulance';
        
        const codeStr = mdaCode.toString().trim();
        const firstDigit = codeStr.charAt(0);
        const firstTwoDigits = codeStr.substring(0, 2);
        
        // Personal standby detection - 5-digit codes starting with 1 or 2
        if (codeStr.length === 5 && (firstDigit === '1' || firstDigit === '2')) {
            return 'personal_standby';
        }
        
        // 4-digit codes
        if (codeStr.length === 4) {
            if (firstDigit === '5') return 'motorcycle';
            if (firstDigit === '6') return 'picanto';
            if (['1', '2', '3', '4', '7', '8', '9'].includes(firstDigit)) return 'ambulance';
        }
        
        // 2 or 3 digit codes starting with 1,2,3,4,7,8,9 are ambulances
        if ((codeStr.length === 2 || codeStr.length === 3) && 
            ['1', '2', '3', '4', '7', '8', '9'].includes(firstDigit)) {
            return 'ambulance';
        }
        
        return 'ambulance'; // default
    }

    getVehicleEmoji(vehicleType) {
        switch(vehicleType) {
            case 'motorcycle': return '🏍️';
            case 'picanto': return '🚗';
            case 'ambulance': return '🚑';
            case 'personal_standby': return '👨‍⚕️';
            default: return '🚑';
        }
    }

    getVehicleEmojiFromText(text) {
        if (!text) return '🚑';
        const lowerText = text.toLowerCase();
        
        // Check for Hebrew names
        if (lowerText.includes('אופנוע')) return '🏍️';
        if (lowerText.includes('פיקנטו')) return '🚗';
        if (lowerText.includes('אמבולנס')) return '🚑';
        if (lowerText.includes('כונן אישי')) return '👨‍⚕️';
        
        // Check for English names
        if (lowerText.includes('motorcycle')) return '🏍️';
        if (lowerText.includes('picanto')) return '🚗';
        if (lowerText.includes('ambulance')) return '🚑';
        if (lowerText.includes('personal_standby')) return '👨‍⚕️';
        
        // Default to ambulance
        return '🚑';
    }

    // Initialize user info display
    initUserInfo() {
        const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                // Check both isAdmin and is_admin for compatibility
                const isAdmin = user.isAdmin || user.is_admin;
                this.currentUser = user;
                const userNameEl = document.getElementById('userName');
                const userCodeEl = document.getElementById('userCode');
                
                if (userNameEl) userNameEl.textContent = user.fullName || user.full_name;
                if (userCodeEl) userCodeEl.textContent = user.mdaCode || user.mda_code;
                
                // Show admin buttons if user is admin (both desktop and mobile)
                if (isAdmin) {
                    const adminBtn = document.getElementById('adminBtn');
                    const mobileAdminBtn = document.getElementById('mobileAdminBtn');
                    
                    if (adminBtn) {
                        adminBtn.style.display = 'flex';
                    }
                    if (mobileAdminBtn) {
                        mobileAdminBtn.style.display = 'flex';
                    }
                }
            } catch (e) {
                console.error('Failed to parse user data:', e);
            }
        }
    }

    async init() {
        try {
            // Initialize user info first
            this.initUserInfo();
            
            // Update vehicle info based on user's MDA code - do this after user info is loaded
            this.currentVehicle = {
                number: this.getUserVehicleNumber(),
                type: this.getUserVehicleType()
            };
            
            // Update vehicle display immediately with detected info
            this.updateVehicleDisplay();
            
            // Bind events first
            this.bindEvents();
            
            // Setup input validation for form fields
            setupInputValidation();
            
            this.setCurrentTime();
            
            // Wait a moment for authentication to complete, then load data
            setTimeout(async () => {
                try {
                    await this.loadVehicleSettings();
                    this.updateVehicleDisplay();
                    await this.loadCodes(); // Load alert and medical codes
                    await this.loadStats();
                    await this.loadCalls();
                    
                    // Hide loading indicator once all data is loaded
                    const loadingOverlay = document.getElementById('loadingOverlay');
                    if (loadingOverlay) {
                        loadingOverlay.classList.add('hidden');
                    }
                } catch (error) {
                    console.error('Error loading initial data:', error);
                    // Still hide overlay on error so user can see the app
                    const loadingOverlay = document.getElementById('loadingOverlay');
                    if (loadingOverlay) {
                        loadingOverlay.classList.add('hidden');
                    }
                }
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

        // Admin button - show only for admin users
        const adminBtn = document.getElementById('adminBtn');
        const isAdmin = this.currentUser && (this.currentUser.isAdmin || this.currentUser.is_admin);
        if (adminBtn && isAdmin) {
            adminBtn.style.display = 'flex';
            adminBtn.addEventListener('click', () => {
                window.location.href = '/admin.html';
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (await customConfirm('האם אתה בטוח שברצונך להתנתק?', 'התנתקות')) {
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

        // Vehicle Selection Modal handlers
        const vehicleBadge = document.querySelector('.motorcycle-badge.clickable');
        const mobileVehicleBadge = document.querySelector('.mobile-motorcycle-badge.clickable');
        
        if (vehicleBadge) {
            vehicleBadge.addEventListener('click', () => {
                this.openVehicleSelectionModal();
            });
        }
        
        if (mobileVehicleBadge) {
            mobileVehicleBadge.addEventListener('click', () => {
                this.openVehicleSelectionModal();
            });
        }

        const vehicleModalClose = document.getElementById('vehicleModalClose');
        const vehicleModalCancel = document.getElementById('vehicleModalCancel');
        const vehicleModal = document.getElementById('vehicleSelectionModal');
        
        if (vehicleModalClose) {
            vehicleModalClose.addEventListener('click', () => {
                vehicleModal.classList.add('hidden');
            });
        }
        if (vehicleModalCancel) {
            vehicleModalCancel.addEventListener('click', () => {
                vehicleModal.classList.add('hidden');
            });
        }
        
        // Close modal when clicking overlay
        if (vehicleModal) {
            vehicleModal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    vehicleModal.classList.add('hidden');
                }
            });
        }

        const vehicleSelectionForm = document.getElementById('vehicleSelectionForm');
        if (vehicleSelectionForm) {
            vehicleSelectionForm.addEventListener('submit', this.handleVehicleSelection.bind(this));
        }

        const releaseVehicleBtn = document.getElementById('releaseVehicleBtn');
        if (releaseVehicleBtn) {
            releaseVehicleBtn.addEventListener('click', this.handleReleaseVehicle.bind(this));
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
                e.preventDefault();
                e.stopPropagation();
                
                // Get the button element
                const button = e.target.closest('.call-menu-btn') || e.target;
                const callId = button.dataset.callId;
                
                if (callId) {
                    // Create and show menu immediately
                    this.createContextMenu(e, callId);
                } else {
                    console.error('No call ID found');
                }
            }
        });
    }

    // Helper function to get date string in Israel timezone
    getIsraelDateString() {
        const now = new Date();
        const israelDateParts = now.toLocaleDateString('en-CA', {
            timeZone: 'Asia/Jerusalem',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }); // Returns YYYY-MM-DD format
        return israelDateParts;
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
        const dateString = this.getIsraelDateString();
        
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
        const currentDateString = this.getIsraelDateString();
        const dateInput = document.getElementById('callDate');
        
        // Only update if the date has changed and the field hasn't been manually modified
        if (dateInput && this.lastSetDate && currentDateString !== this.lastSetDate) {
            
            // Only auto-update if the field still has yesterday's date (user hasn't changed it)
            if (dateInput.value === this.lastSetDate) {
                dateInput.value = currentDateString;
            }
            
            this.lastSetDate = currentDateString;
        }
    }
    
    setupMidnightDateUpdate() {
        // Get current time in Israel
        const now = new Date();
        const israelTime = new Date(now.toLocaleString('en-US', {timeZone: 'Asia/Jerusalem'}));
        
        // Calculate next midnight in Israel timezone
        const tomorrow = new Date(israelTime);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        // Calculate time difference correctly
        const msUntilMidnight = tomorrow - israelTime;
        
        // Set timeout to update at midnight
        setTimeout(() => {
            this.updateDateIfNeeded();
            
            // Set up next midnight update (24 hours from now)
            setInterval(() => {
                this.updateDateIfNeeded();
            }, 24 * 60 * 60 * 1000); // Every 24 hours
        }, msUntilMidnight);
    }

    // Create context menu for calls
    createContextMenu(event, callId) {
        // Remove existing menu if any
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
            this.editCall(callId);
            menu.remove();
        });
        
        // Create delete option
        const deleteOption = document.createElement('div');
        deleteOption.innerHTML = '🗑️ מחיקה';
        deleteOption.style.cssText = 'padding: 8px; cursor: pointer; color: red;';
        deleteOption.addEventListener('click', () => {
            this.deleteCallDirect(callId);
            menu.remove();
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
        const call = this.calls.find(c => c.id == callId);
        if (call) {
            this.openEditModal(call);
        }
        // Remove menu
        const menu = document.getElementById('quickContextMenu');
        if (menu) menu.remove();
    }

    async deleteCallDirect(callId) {
        if (await customConfirm('האם אתה בטוח שברצונך למחוק קריאה זו?', 'מחיקת קריאה')) {
            this.deleteCall(callId);
        }
        // Remove menu
        const menu = document.getElementById('quickContextMenu');
        if (menu) menu.remove();
    }

    showContextMenu(event, callId) {
        event.preventDefault();
        
        let contextMenu = document.getElementById('contextMenu');
        
        // Create context menu if it doesn't exist
        if (!contextMenu) {
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
        
        // Position and show the menu
        const x = event.clientX || event.pageX;
        const y = (event.clientY || event.pageY) + window.scrollY;
        
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

        const formData = this.getFormData();
        if (!formData) return;
        if (!this.validateFormData(formData)) return;

        await this.submitCall(formData);
    }

    getFormData() {
        const city = document.getElementById('city').value.trim();
        const street = document.getElementById('street').value.trim();
        const locationDetails = document.getElementById('location').value.trim();
        const meterVisaNumber = document.getElementById('meterVisaNumber').value.trim();
        
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
            arrival_time: document.getElementById('arrivalTime').value || null,
            location: fullLocation,
            city: city,
            street: street,
            alert_code_id: document.getElementById('alertCode').value || null,
            medical_code_id: document.getElementById('medicalCode').value || null,
            meter_visa_number: meterVisaNumber || null,
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
        }

        return true;
    }

    async submitCall(data) {
        if (this.isLoading) return;

        try {
            this.setLoading(true);

            const response = await fetch('/api/calls', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(data)
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
            // Defensive check - ensure button is always re-enabled
            setTimeout(() => {
                const submitBtn = document.querySelector('.submit-btn');
                if (submitBtn && submitBtn.disabled) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `
                        <span class="btn-icon">✅</span>
                        רשום נסיעה
                    `;
                }
            }, 200);
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        const data = this.getFormData();
        if (!data) return;
        if (!this.validateFormData(data)) return;

        await this.submitCall(data);
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats', {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();

            // FIX: Add null checks for API response
            if (result && result.success && result.data) {
                this.stats = result.data;
                this.updateStatsDisplay();
            } else if (result) {
                console.error('📊 Error in stats result:', result.message || 'Invalid response format');
            }
        } catch (error) {
            console.error('📊 Error loading stats:', error);
        }
    }

    async loadCalls() {
        try {
            // Load only today's calls for the "Latest Calls" section
            const today = this.getIsraelDateString();
            const response = await fetch(`/api/calls?date=${today}`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();

            // FIX: Add null checks for API response and data array
            if (result && result.success && Array.isArray(result.data)) {
                this.calls = result.data;
                this.filteredCalls = [...this.calls];
                this.updateCallsDisplay();
            } else if (result) {
                console.error('📞 Error in calls result:', result.message || 'Invalid response format');
                // Set empty calls on error to prevent crashes
                this.calls = [];
                this.filteredCalls = [];
            }
        } catch (error) {
            console.error('📞 Error loading calls:', error);
            // Set empty calls on error
            this.calls = [];
            this.filteredCalls = [];
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
        const averageArrivalTimeEl = document.getElementById('averageArrivalTime');

        if (totalCallsEl) totalCallsEl.textContent = this.stats.totalCalls || 0;
        if (weeklyCallsEl) weeklyCallsEl.textContent = this.stats.weeklyCalls || 0;
        if (monthlyCallsEl) monthlyCallsEl.textContent = this.stats.monthlyCalls || 0;
        if (weeklyHoursEl) weeklyHoursEl.textContent = this.formatHoursAndMinutes(this.stats.weeklyHours);
        if (monthlyHoursEl) monthlyHoursEl.textContent = this.formatHoursAndMinutes(this.stats.monthlyHours);
        if (averageArrivalTimeEl) {
            const displayValue = this.stats.averageArrivalTime || '-';
            averageArrivalTimeEl.textContent = displayValue;
        }
    }

    updateCallsDisplay() {
        const callsList = document.getElementById('callsList');
        if (!callsList) return;

        const callsToShow = this.filteredCalls.length > 0 || Object.values(this.currentFilters).some(f => f) 
            ? this.filteredCalls 
            : this.calls;

        // Clear the list
        callsList.innerHTML = '';

        if (callsToShow.length === 0) {
            const emptyMessage = Object.values(this.currentFilters).some(f => f) 
                ? 'לא נמצאו נסיעות התואמות לסינון'
                : 'אין נסיעות שנרשמו היום';
            
            // Create empty state using DOM methods instead of innerHTML
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            
            const emptyIcon = document.createElement('div');
            emptyIcon.className = 'empty-icon';
            emptyIcon.textContent = '📋';
            
            const emptyText = document.createElement('p');
            emptyText.className = 'empty-text';
            emptyText.textContent = emptyMessage;
            
            emptyState.appendChild(emptyIcon);
            emptyState.appendChild(emptyText);
            callsList.appendChild(emptyState);
            return;
        }

        // Build DOM elements instead of setting innerHTML to prevent XSS and improve performance
        const fragment = document.createDocumentFragment();
        callsToShow.forEach(call => {
            const callElement = this.createCallElement(call);
            fragment.appendChild(callElement);
        });
        callsList.appendChild(fragment);
    }


    createCallElement(call) {
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

        // Create element using DOM methods to prevent XSS
        const callItem = document.createElement('div');
        callItem.className = 'call-item';
        callItem.setAttribute('data-call-id', call.id);

        const callHeader = document.createElement('div');
        callHeader.className = 'call-header';

        const callTypeSpan = document.createElement('span');
        callTypeSpan.className = 'call-type';
        callTypeSpan.textContent = callTypeNames[call.call_type] || call.call_type;

        const callActions = document.createElement('div');
        callActions.className = 'call-actions';

        const callTimeSpan = document.createElement('span');
        callTimeSpan.className = 'call-time';
        callTimeSpan.textContent = timeRange;

        const menuBtn = document.createElement('button');
        menuBtn.className = 'call-menu-btn';
        menuBtn.setAttribute('data-call-id', call.id);
        menuBtn.innerHTML = '<span class="menu-dots">⋮</span>'; // Only emoji is safe

        callActions.appendChild(callTimeSpan);
        callActions.appendChild(menuBtn);
        callHeader.appendChild(callTypeSpan);
        callHeader.appendChild(callActions);

        const callDateDiv = document.createElement('div');
        callDateDiv.className = 'call-date';
        callDateDiv.textContent = `📅 ${callDate}`;

        const callLocationDiv = document.createElement('div');
        callLocationDiv.className = 'call-location';
        callLocationDiv.textContent = `📍 ${call.location}`; // User input - use textContent

        const callVehicleDiv = document.createElement('div');
        callVehicleDiv.className = 'call-vehicle';
        callVehicleDiv.textContent = `${this.getVehicleEmoji(vehicleType)} ${vehicleType} ${call.vehicle_number}`; // User data - use textContent

        callItem.appendChild(callHeader);
        callItem.appendChild(callDateDiv);
        callItem.appendChild(callLocationDiv);
        callItem.appendChild(callVehicleDiv);

        // Add codes display
        const codesHTML = this.getCodeDisplayHTML(call);
        if (codesHTML) {
            const codesDiv = document.createElement('div');
            codesDiv.innerHTML = codesHTML; // Safe: codes are system-generated
            callItem.appendChild(codesDiv);
        }

        // Add description if present
        if (call.description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'call-description';
            descDiv.textContent = `💬 ${call.description}`; // User input - use textContent
            callItem.appendChild(descDiv);
        }

        const callFooter = document.createElement('div');
        callFooter.className = 'call-footer';
        const durationSpan = document.createElement('span');
        durationSpan.className = 'call-duration';
        durationSpan.textContent = duration;
        callFooter.appendChild(durationSpan);
        callItem.appendChild(callFooter);

        return callItem;
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
                <div class="call-vehicle">${this.getVehicleEmoji(vehicleType)} ${vehicleType} ${call.vehicle_number}</div>
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
            const response = await fetch('/api/vehicle/current', {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Don't redirect here, just use fallback
                } else {
                    console.error('🚗 Vehicle settings API error:', response.status);
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();

            // FIX: Null check result and result.data with proper property validation
            if (result && result.success && result.data) {
                if (result.data.vehicle_number && result.data.vehicle_type) {
                    this.currentVehicle = {
                        number: result.data.vehicle_number,
                        type: result.data.vehicle_type
                    };
                } else {
                    throw new Error('Invalid vehicle data from server');
                }
            } else {
                throw new Error('Invalid API response');
            }
        } catch (error) {
            console.error('🚗 Error loading vehicle settings, using fallback:', error);
            // Fallback to user's MDA code if API fails
            this.currentVehicle = {
                number: this.getUserVehicleNumber(),
                type: this.getUserVehicleType()
            };
        }
        
        this.updateVehicleDisplay();
        
        // Set vehicle settings in form
        const vehicleNumber = document.getElementById('vehicleNumber');
        const vehicleType = document.getElementById('vehicleType');
        
        if (vehicleNumber && this.currentVehicle && this.currentVehicle.number) {
            vehicleNumber.value = this.currentVehicle.number;
        }
        if (vehicleType && this.currentVehicle && this.currentVehicle.type) {
            vehicleType.value = this.currentVehicle.type;
        }
    }

    // Open vehicle selection modal
    async openVehicleSelectionModal() {
        
        // Clear previous messages
        const errorDiv = document.getElementById('vehicleSelectionError');
        const successDiv = document.getElementById('vehicleSelectionSuccess');
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
        
        // Load current vehicle info
        try {
            const response = await fetch('/api/vehicle/current', {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const result = await response.json();
                const modalCurrentVehicle = document.getElementById('modalCurrentVehicle');
                const releaseBtn = document.getElementById('releaseVehicleBtn');
                const vehicleInput = document.getElementById('vehicleNumberInput');
                
                if (result.success && result.data) {
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
                    
                    const emoji = vehicleEmojis[result.data.vehicle_type] || '🚑';
                    const name = vehicleTypeNames[result.data.vehicle_type] || result.data.vehicle_type;
                    
                    if (modalCurrentVehicle) {
                        modalCurrentVehicle.innerHTML = `${emoji} ${result.data.vehicle_number} - ${name}`;
                    }
                    if (releaseBtn) {
                        releaseBtn.style.display = 'inline-block';
                    }
                    if (vehicleInput) {
                        vehicleInput.value = result.data.vehicle_number;
                    }
                } else {
                    if (modalCurrentVehicle) {
                        modalCurrentVehicle.textContent = 'לא נבחר רכב';
                    }
                    if (releaseBtn) {
                        releaseBtn.style.display = 'none';
                    }
                    if (vehicleInput) {
                        vehicleInput.value = '';
                    }
                }
            }
        } catch (error) {
            console.error('🚗 Error loading current vehicle:', error);
        }
        
        // Load recent vehicles
        this.loadRecentVehicles();
        
        // Show modal
        const modal = document.getElementById('vehicleSelectionModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    // Save vehicle to recent history
    saveRecentVehicle(vehicleNumber, vehicleType) {
        const userId = this.getUserId();
        if (!userId) return;

        const storageKey = `recentVehicles_${userId}`;
        let recentVehicles = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        // Remove if already exists
        recentVehicles = recentVehicles.filter(v => v.number !== vehicleNumber);
        
        // Add to beginning
        recentVehicles.unshift({
            number: vehicleNumber,
            type: vehicleType,
            lastUsed: new Date().toISOString()
        });
        
        // Keep only last 5 vehicles
        recentVehicles = recentVehicles.slice(0, 5);
        
        localStorage.setItem(storageKey, JSON.stringify(recentVehicles));
    }

    // Load and display recent vehicles
    loadRecentVehicles() {
        const userId = this.getUserId();
        if (!userId) return;

        const storageKey = `recentVehicles_${userId}`;
        const recentVehicles = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        const section = document.getElementById('recentVehiclesSection');
        const list = document.getElementById('recentVehiclesList');
        
        // Filter out the current vehicle
        const currentVehicleNumber = this.currentVehicle?.number;
        const availableVehicles = recentVehicles.filter(v => v.number !== currentVehicleNumber);
        
        if (availableVehicles.length === 0) {
            if (section) section.style.display = 'none';
            return;
        }
        
        if (section) section.style.display = 'block';
        if (!list) return;
        
        list.innerHTML = availableVehicles.map(vehicle => {
            // Re-detect type to ensure accuracy (in case detection logic was updated)
            const correctType = this.detectVehicleType(vehicle.number);
            const icon = this.getVehicleIcon(correctType);
            const typeName = this.getVehicleTypeName(correctType);
            
            return `
                <div class="recent-vehicle-item" data-vehicle-number="${vehicle.number}" data-vehicle-type="${correctType}">
                    <div class="recent-vehicle-info">
                        <div class="recent-vehicle-number">${vehicle.number}</div>
                        <div class="recent-vehicle-type">${typeName}</div>
                    </div>
                    <div class="recent-vehicle-icon">${icon}</div>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        list.querySelectorAll('.recent-vehicle-item').forEach(item => {
            item.addEventListener('click', () => {
                const number = item.dataset.vehicleNumber;
                const type = item.dataset.vehicleType;
                this.selectRecentVehicle(number, type);
            });
        });
    }

    // Select a vehicle from recent history
    async selectRecentVehicle(vehicleNumber, vehicleType) {
        
        // FIX: Prevent race condition - check if already loading
        if (this.isLoading) {
            console.warn('Vehicle selection already in progress');
            return;
        }
        
        // Clear previous messages
        this.hideVehicleMessages();
        this.setLoading(true);
        
        try {
            const response = await fetch('/api/vehicle/current', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ 
                    vehicle_number: vehicleNumber,
                    vehicle_type: vehicleType
                })
            });
            
            const result = await response.json();
            
            // FIX: Add null checks for response data
            if (response.ok && result && result.success && result.data) {
                if (result.data.vehicle_number && result.data.vehicle_type) {
                    this.showVehicleSuccess(result.message || 'הרכב נבחר בהצלחה!');
                    
                    this.currentVehicle = {
                        number: result.data.vehicle_number,
                        type: result.data.vehicle_type
                    };
                    
                    // Save to recent
                    this.saveRecentVehicle(vehicleNumber, vehicleType);
                    
                    // FIX: Parallel load instead of sequential (eliminates race condition)
                    this.updateVehicleDisplay();
                    await Promise.all([
                        this.loadStats(),
                        this.loadCalls()
                    ]);
                    
                    setTimeout(() => {
                        const modal = document.getElementById('vehicleSelectionModal');
                        if (modal) modal.classList.add('hidden');
                    }, 1500);
                } else {
                    this.showVehicleError('תגובה לא תקינה מהשרת');
                }
            } else if (response.status === 409) {
                this.showVehicleError(result?.message || 'רכב זה כבר בשימוש על ידי משתמש אחר');
            } else {
                this.showVehicleError(result?.message || 'שגיאה בבחירת רכב');
            }
        } catch (error) {
            console.error('🚗 Error selecting vehicle:', error);
            this.showVehicleError('שגיאה בתקשורת עם השרת');
        } finally {
            this.setLoading(false);
        }
    }

    // Get vehicle icon emoji
    getVehicleIcon(vehicleType) {
        const icons = {
            'motorcycle': '🏍️',
            'picanto': '🚗',
            'personal_standby': '🚙',
            'amblance': '🚑'
        };
        return icons[vehicleType] || '🚗';
    }

    // Get vehicle type display name
    getVehicleTypeName(vehicleType) {
        const names = {
            'motorcycle': 'אופנוע',
            'picanto': 'פיקנטו',
            'personal_standby': 'כונן אישי',
            'amblance': 'אמבולנס'
        };
        return names[vehicleType] || vehicleType;
    }

    // Handle vehicle selection form submission
    async handleVehicleSelection(e) {
        e.preventDefault();
        
        const vehicleInput = document.getElementById('vehicleNumberInput');
        const vehicleNumber = vehicleInput ? vehicleInput.value.trim() : '';
        
        if (!vehicleNumber) {
            this.showVehicleError('נא להזין מספר רכב');
            return;
        }
        
        // Auto-detect vehicle type
        const vehicleType = this.detectVehicleType(vehicleNumber);
        
        // Clear previous messages
        this.hideVehicleMessages();
        
        try {
            const response = await fetch('/api/vehicle/current', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ 
                    vehicle_number: vehicleNumber,
                    vehicle_type: vehicleType
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Success!
                this.showVehicleSuccess(result.message || 'הרכב נבחר בהצלחה!');
                
                // Update current vehicle
                this.currentVehicle = {
                    number: result.data.vehicle_number,
                    type: result.data.vehicle_type
                };
                
                // Save to recent vehicles
                this.saveRecentVehicle(vehicleNumber, vehicleType);
                
                // Update display
                this.updateVehicleDisplay();
                
                // Reload data with new vehicle filter
                await this.loadStats();
                await this.loadCalls();
                
                // Close modal after 1.5 seconds
                setTimeout(() => {
                    const modal = document.getElementById('vehicleSelectionModal');
                    if (modal) {
                        modal.classList.add('hidden');
                    }
                }, 1500);
            } else if (response.status === 409) {
                // Vehicle is occupied by another user
                this.showVehicleError(result.message || 'רכב זה כבר בשימוש על ידי משתמש אחר');
            } else {
                this.showVehicleError(result.message || 'שגיאה בבחירת רכב');
            }
        } catch (error) {
            console.error('🚗 Error selecting vehicle:', error);
            this.showVehicleError('שגיאה בתקשורת עם השרת');
        }
    }

    // Handle vehicle release
    async handleReleaseVehicle() {
        if (!await customConfirm('האם אתה בטוח שברצונך לשחרר את הרכב?', 'שחרור רכב')) {
            return;
        }
        this.hideVehicleMessages();
        
        try {
            const response = await fetch('/api/vehicle/current', {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showVehicleSuccess(result.message || 'הרכב שוחרר בהצלחה');
                
                // Reset to user's MDA code
                this.currentVehicle = {
                    number: this.getUserVehicleNumber(),
                    type: this.getUserVehicleType()
                };
                
                // Update display
                this.updateVehicleDisplay();
                
                // Reload data
                await this.loadStats();
                await this.loadCalls();
                
                // Update modal display
                const modalCurrentVehicle = document.getElementById('modalCurrentVehicle');
                const releaseBtn = document.getElementById('releaseVehicleBtn');
                const vehicleInput = document.getElementById('vehicleNumberInput');
                
                if (modalCurrentVehicle) {
                    modalCurrentVehicle.textContent = 'לא נבחר רכב';
                }
                if (releaseBtn) {
                    releaseBtn.style.display = 'none';
                }
                if (vehicleInput) {
                    vehicleInput.value = '';
                }
            } else {
                this.showVehicleError(result.message || 'שגיאה בשחרור רכב');
            }
        } catch (error) {
            console.error('🚗 Error releasing vehicle:', error);
            this.showVehicleError('שגיאה בתקשורת עם השרת');
        }
    }

    // Show vehicle selection error
    showVehicleError(message) {
        const errorDiv = document.getElementById('vehicleSelectionError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'flex';
        }
    }

    // Show vehicle selection success
    showVehicleSuccess(message) {
        const successDiv = document.getElementById('vehicleSelectionSuccess');
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'flex';
        }
    }

    // Hide vehicle messages
    hideVehicleMessages() {
        const errorDiv = document.getElementById('vehicleSelectionError');
        const successDiv = document.getElementById('vehicleSelectionSuccess');
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
    }

    // Load alert and medical codes for dropdowns
    async loadCodes() {
        try {
            
            // Load alert codes
            const alertResponse = await fetch('/api/codes/alert', {
                headers: this.getAuthHeaders()
            });
            
            if (alertResponse.ok) {
                const alertResult = await alertResponse.json();
                this.alertCodes = alertResult.data || [];
                this.populateAlertCodeDropdowns();
            }
            
            // Load medical codes
            const medicalResponse = await fetch('/api/codes/medical', {
                headers: this.getAuthHeaders()
            });
            
            if (medicalResponse.ok) {
                const medicalResult = await medicalResponse.json();
                this.medicalCodes = medicalResult.data || [];
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
                dropdownParent: $('#editCallModal'), // Attach dropdown to modal
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
                dropdownParent: $('#editCallModal'), // Attach dropdown to modal
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
        
        // FIX: Null check currentVehicle before accessing properties
        if (!this.currentVehicle || !this.currentVehicle.number || !this.currentVehicle.type) {
            console.warn('Invalid currentVehicle object:', this.currentVehicle);
            return;
        }
        
        // Use the HTML updateVehicleBadge function if available for consistency
        if (typeof updateVehicleBadge === 'function') {
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
        
        // FIX: Add null checks before updating DOM elements
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
        
        // Only update mobile vehicle type if it's a different element to avoid duplicate updates
        if (mobileVehicleTypeEl && mobileVehicleTypeEl !== currentVehicleTypeEl) {
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
            return;
        }

        // Decode token to check admin status (simple check)
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            
            if (payload.isAdmin) {
                this.addAdminButton();
                this.showMobileAdminButton();
            } else {
            }
        } catch (error) {
        }
    }

    addAdminButton() {
        // Check if admin button already exists
        if (document.getElementById('adminBtn')) {
            return;
        }

        // Add admin button to header actions
        const headerActions = document.querySelector('.header-actions');
        
        if (headerActions) {
            const adminBtn = document.createElement('button');
            adminBtn.id = 'adminBtn';
            adminBtn.className = 'action-btn admin-btn';
            adminBtn.title = 'ממשק מנהל מערכת';
            adminBtn.innerHTML = '<span class="icon">⚙️</span>';
            adminBtn.addEventListener('click', () => {
                window.location.href = '/admin.html';
            });
            
            // Insert before refresh button
            const refreshBtn = document.getElementById('refreshBtn');
            if (refreshBtn) {
                headerActions.insertBefore(adminBtn, refreshBtn);
            } else {
                headerActions.appendChild(adminBtn);
            }
        } else {
        }
    }

    showMobileAdminButton() {
        // Show the mobile admin button for admin users
        const mobileAdminBtn = document.getElementById('mobileAdminBtn');
        if (mobileAdminBtn) {
            mobileAdminBtn.style.display = 'flex';
        } else {
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
            
            // Explicitly ensure submit button is enabled and ready
            setTimeout(() => {
                const submitBtn = document.querySelector('.submit-btn');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `
                        <span class="btn-icon">✅</span>
                        רשום נסיעה
                    `;
                }
            }, 150);
        }
    }

    // Context menu and editing methods
    async handleContextMenuAction(action, callId) {
        const call = this.calls.find(c => c.id == callId);
        if (!call) {
            console.error('Call not found with ID:', callId);
            return;
        }
        
        switch (action) {
            case 'edit':
                this.openEditModal(call);
                break;
            case 'delete':
                if (await customConfirm('האם אתה בטוח שברצונך למחוק קריאה זו?', 'מחיקת קריאה')) {
                    await this.deleteCall(callId);
                }
                break;
        }
        this.hideContextMenu();
    }

    openEditModal(call) {
        
        document.getElementById('editCallId').value = call.id;
        
        // Normalize call type to handle different quote marks and old formats
        let normalizedCallType = call.call_type;
        if (normalizedCallType) {
            // Convert old formats with quotes to new format without quotes
            if (normalizedCallType === 'אט"ן' || normalizedCallType === 'אט״ן') {
                normalizedCallType = 'אטן';
            }
        }
        
        document.getElementById('editCallDate').value = call.call_date;
        document.getElementById('editStartTime').value = call.start_time;
        document.getElementById('editEndTime').value = call.end_time || '';
        document.getElementById('editArrivalTime').value = call.arrival_time || '';
        
        // Use separate city and street fields if available, otherwise try to parse from location
        if (call.city && call.street) {
            document.getElementById('editCity').value = call.city;
            document.getElementById('editStreet').value = call.street;
            // Location field contains additional details (building number, entrance, floor, etc.)
            // Parse from full location by removing city and street
            const locationParts = (call.location || '').split(',').map(s => s.trim());
            document.getElementById('editLocation').value = locationParts.slice(2).join(', ') || '';
        } else {
            // Fallback: Parse from location string for older records
            const locationParts = (call.location || '').split(',').map(s => s.trim());
            document.getElementById('editCity').value = locationParts[0] || '';
            document.getElementById('editStreet').value = locationParts[1] || '';
            document.getElementById('editLocation').value = locationParts.slice(2).join(', ') || '';
        }
        
        // Set meter/visa number
        document.getElementById('editMeterVisaNumber').value = call.meter_visa_number || '';
        
        // Set code dropdowns - set values before reinitializing Select2
        const editAlertCode = document.getElementById('editAlertCode');
        const editMedicalCode = document.getElementById('editMedicalCode');
        
        if (editAlertCode) editAlertCode.value = call.alert_code_id || '';
        if (editMedicalCode) editMedicalCode.value = call.medical_code_id || '';
        
        document.getElementById('editDescription').value = call.description || '';
        
        // Show modal first
        document.getElementById('editModal').classList.remove('hidden');
        
        // Set all dynamic values after modal is visible to ensure DOM is ready
        setTimeout(() => {
            // Set call type
            const editCallTypeSelect = document.getElementById('editCallType');
            if (editCallTypeSelect) {
                editCallTypeSelect.value = normalizedCallType;
            }
            if (editAlertCode) {
                $(editAlertCode).select2({
                    placeholder: 'חפש או בחר קוד הזנקה',
                    allowClear: true,
                    dir: 'rtl',
                    minimumResultsForSearch: 0,
                    dropdownParent: $('#editModal'),
                    language: {
                        noResults: function() { return 'לא נמצאו תוצאות'; },
                        searching: function() { return 'מחפש...'; }
                    }
                });
                $(editAlertCode).val(call.alert_code_id || '').trigger('change');
            }
            
            // Destroy and reinitialize medical code Select2
            if (editMedicalCode && $(editMedicalCode).data('select2')) {
                $(editMedicalCode).select2('destroy');
            }
            if (editMedicalCode) {
                $(editMedicalCode).select2({
                    placeholder: 'חפש או בחר קוד רפואי',
                    allowClear: true,
                    dir: 'rtl',
                    minimumResultsForSearch: 0,
                    dropdownParent: $('#editModal'),
                    language: {
                        noResults: function() { return 'לא נמצאו תוצאות'; },
                        searching: function() { return 'מחפש...'; }
                    }
                });
                $(editMedicalCode).val(call.medical_code_id || '').trigger('change');
            }
        }, 100);
    }

    async handleEditSubmit(event) {
        event.preventDefault();
        
        const callId = document.getElementById('editCallId').value;
        const city = document.getElementById('editCity').value.trim();
        const street = document.getElementById('editStreet').value.trim();
        const locationDetails = document.getElementById('editLocation').value.trim();
        const meterVisaNumber = document.getElementById('editMeterVisaNumber').value.trim();
        
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
            arrival_time: document.getElementById('editArrivalTime').value || null,
            location: fullLocation,
            city: city,
            street: street,
            meter_visa_number: meterVisaNumber || null,
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
            // Add small delay for mobile to ensure DOM is ready
            setTimeout(() => {
                const btn = document.querySelector('.submit-btn');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = `
                        <span class="btn-icon">✅</span>
                        רשום נסיעה
                    `;
                }
            }, 100);
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
        const mobileAdminBtn = document.getElementById('mobileAdminBtn');
        const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
        
        if (mobileHistoryBtn) {
            mobileHistoryBtn.addEventListener('click', () => {
                window.location.href = '/history.html';
            });
        }
        
        if (mobileAdminBtn) {
            mobileAdminBtn.addEventListener('click', () => {
                window.location.href = '/admin.html';
            });
        }
        
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', async () => {
                if (await customConfirm('האם אתה בטוח שברצונך להתנתק?', 'התנתקות')) {
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
            })
            .catch(registrationError => {
            });
    });
}

// Handle online/offline status
window.addEventListener('online', () => {
    // Refresh data when back online
    if (window.callCounter) {
        window.callCounter.loadStats();
        window.callCounter.loadCalls();
    }
});

window.addEventListener('offline', () => {
});

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    
    // Check authentication first
    if (!checkAuthentication()) {
        return;
    }
    
    // Initialize CallCounter
    window.callCounter = new CallCounter();
    
    // Check admin access after initialization
    setTimeout(() => {
        if (window.callCounter && window.callCounter.updateAdminAccess) {
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
        
        // Manual admin navigation function
        window.goToAdmin = function() {
            window.location.href = '/admin.html';
        };
        
        // Function to find and highlight admin button
        window.findAdminBtn = function() {
            const adminBtn = document.getElementById('adminBtn');
            if (adminBtn) {
                adminBtn.style.border = '3px solid red';
                adminBtn.style.backgroundColor = 'yellow';
                adminBtn.scrollIntoView();
                return adminBtn;
            } else {
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
