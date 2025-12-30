// MDA CallCounter - Historical View Page JavaScript
class HistoryViewer {
    constructor() {
        this.isLoading = false;
        this.alertCodes = [];
        this.medicalCodes = [];
        this.allCalls = []; // Store all loaded calls for filtering
        this.currentVehicle = {
            number: this.getUserVehicleNumber(),
            type: this.getUserVehicleType()
        };
        
        this.init();
    }

    // Get current user ID
    getUserId() {
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
            const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
            if (userData) {
                const user = JSON.parse(userData);
                const mdaCode = user.mdaCode || user.mda_code;
                return mdaCode || '5248';
            }
            return '5248';
        } catch (error) {
            console.error('Error getting user vehicle number:', error);
            return '5248';
        }
    }

    getUserVehicleType() {
        try {
            const mdaCode = this.getUserVehicleNumber();
            return this.detectVehicleType(mdaCode);
        } catch (error) {
            console.error('Error detecting vehicle type:', error);
            return 'motorcycle';
        }
    }

    detectVehicleType(code) {
        if (!code) return 'ambulance';
        
        const codeStr = String(code).trim();
        const len = codeStr.length;
        const firstDigit = codeStr[0];
        
        // Personal standby detection - 5-digit codes starting with 1 or 2
        if (len === 5 && (firstDigit === '1' || firstDigit === '2')) {
            return 'personal_standby';
        }
        
        // 4-digit codes
        if (len === 4) {
            if (firstDigit === '5') {
                return 'motorcycle';
            }
            if (firstDigit === '6') {
                return 'picanto';
            }
            if (['1', '2', '3', '4', '7', '8', '9'].includes(firstDigit)) {
                return 'ambulance';
            }
        }
        
        // 2 or 3 digit codes starting with 1,2,3,4,7,8,9 are ambulances
        if ((len === 2 || len === 3) && ['1', '2', '3', '4', '7', '8', '9'].includes(firstDigit)) {
            return 'ambulance';
        }
        
        // Default to ambulance
        return 'ambulance';
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

    // Load vehicle settings from API
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

            if (result.success && result.data) {
                this.currentVehicle = {
                    number: result.data.vehicle_number,
                    type: result.data.vehicle_type
                };
                
                // Update the UI as well
                await this.updateVehicleFilterInfo();
            }
        } catch (error) {
            console.error('🚗 Error loading vehicle settings, using fallback:', error);
            // Fallback to user's MDA code if API fails
            this.currentVehicle = {
                number: this.getUserVehicleNumber(),
                type: this.getUserVehicleType()
            };
        }
    }

    // Update vehicle filter info display
    async updateVehicleFilterInfo() {
        try {
            const response = await fetch('/api/vehicle/current', {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const result = await response.json();
                
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
                    
                    const vehicleNumber = result.data.vehicle_number;
                    const vehicleType = result.data.vehicle_type;
                    const emoji = vehicleEmojis[vehicleType] || '🚗';
                    const typeName = vehicleTypeNames[vehicleType] || vehicleType;
                    
                    // Update the info banner
                    const vehicleFilterInfo = document.getElementById('vehicleFilterInfo');
                    const filteredVehicleNumber = document.getElementById('filteredVehicleNumber');
                    const filteredVehicleType = document.getElementById('filteredVehicleType');
                    
                    if (vehicleFilterInfo && filteredVehicleNumber && filteredVehicleType) {
                        filteredVehicleNumber.textContent = vehicleNumber;
                        filteredVehicleType.textContent = `${emoji} ${typeName}`;
                        vehicleFilterInfo.style.display = 'flex';
                    }
                } else {
                    // No vehicle selected, hide the banner
                    const vehicleFilterInfo = document.getElementById('vehicleFilterInfo');
                    if (vehicleFilterInfo) {
                        vehicleFilterInfo.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            console.error('Error updating vehicle filter info:', error);
            // Don't show error to user, just hide the banner
            const vehicleFilterInfo = document.getElementById('vehicleFilterInfo');
            if (vehicleFilterInfo) {
                vehicleFilterInfo.style.display = 'none';
            }
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
                this.showVehicleSuccess(result.message || 'הרכב נבחר בהצלחה!');
                
                this.currentVehicle = {
                    number: result.data.vehicle_number,
                    type: result.data.vehicle_type
                };
                
                // Save to recent
                this.saveRecentVehicle(vehicleNumber, vehicleType);
                
                this.updateVehicleDisplay();
                this.updateVehicleFilterInfo();
                await this.loadHistory();
                
                setTimeout(() => {
                    const modal = document.getElementById('vehicleSelectionModal');
                    if (modal) modal.classList.add('hidden');
                }, 1500);
            } else if (response.status === 409) {
                this.showVehicleError(result.message || 'רכב זה כבר בשימוש על ידי משתמש אחר');
            } else {
                this.showVehicleError(result.message || 'שגיאה בבחירת רכב');
            }
        } catch (error) {
            console.error('🚗 Error selecting vehicle:', error);
            this.showVehicleError('שגיאה בתקשורת עם השרת');
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
                
                // Update vehicle badges
                this.updateVehicleBadges();
                
                // Reload historical data if already loaded
                if (this.allCalls.length > 0) {
                    await this.loadHistoricalCalls();
                }
                
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
                
                // Update vehicle badges
                this.updateVehicleBadges();
                
                // Reload historical data if already loaded
                if (this.allCalls.length > 0) {
                    await this.loadHistoricalCalls();
                }
                
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

    // Update vehicle badges display
    updateVehicleBadges() {
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
        const mobileVehicleEl = document.getElementById('mobileCurrentVehicle');
        const mobileVehicleTypeEl = document.getElementById('mobileCurrentVehicleType');
        
        const emoji = vehicleEmojis[this.currentVehicle.type] || '🚑';
        const name = vehicleTypeNames[this.currentVehicle.type] || this.currentVehicle.type;
        
        if (currentVehicleEl) {
            currentVehicleEl.textContent = this.currentVehicle.number;
        }
        if (currentVehicleTypeEl) {
            currentVehicleTypeEl.innerHTML = `${emoji} ${name}`;
        }
        if (mobileVehicleEl) {
            mobileVehicleEl.textContent = this.currentVehicle.number;
        }
        if (mobileVehicleTypeEl) {
            mobileVehicleTypeEl.innerHTML = `${emoji} ${name}`;
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
            
            // Load alert and medical codes
            await this.loadCodes();
            
            this.bindEvents();
            this.populateYearOptions();
            
            // Auto-load current month's data
            this.autoLoadCurrentMonth();
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

        // Entry codes button
        const entryCodesBtn = document.getElementById('entryCodesBtn');
        if (entryCodesBtn) {
            entryCodesBtn.addEventListener('click', () => {
                window.location.href = '/entry-codes.html';
            });
        }

        // Admin button - show only for admin users
        const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                const adminBtn = document.getElementById('adminBtn');
                const isAdmin = user.isAdmin || user.is_admin;
                if (adminBtn && isAdmin) {
                    adminBtn.style.display = 'flex';
                    adminBtn.addEventListener('click', () => {
                        window.location.href = '/admin.html';
                    });
                }
            } catch (e) {
                console.error('Failed to parse user data:', e);
            }
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

        // Mobile menu buttons
        const mobileEntryCodesBtn = document.getElementById('mobileEntryCodesBtn');
        if (mobileEntryCodesBtn) {
            mobileEntryCodesBtn.addEventListener('click', () => {
                window.location.href = '/entry-codes.html';
            });
        }

        const mobileAdminBtn = document.getElementById('mobileAdminBtn');
        if (mobileAdminBtn && userData) {
            try {
                const user = JSON.parse(userData);
                const isAdmin = user.isAdmin || user.is_admin;
                if (isAdmin) {
                    mobileAdminBtn.style.display = 'flex';
                    mobileAdminBtn.addEventListener('click', () => {
                        window.location.href = '/admin.html';
                    });
                }
            } catch (e) {
                console.error('Failed to parse user data for mobile admin button:', e);
            }
        }

        const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', async () => {
                if (await customConfirm('האם אתה בטוח שברצונך להתנתק?', 'התנתקות')) {
                    this.logout();
                }
            });
        }

        // Vehicle settings form
        const vehicleForm = document.getElementById('vehicleSettingsForm');
        if (vehicleForm) {
            vehicleForm.addEventListener('submit', this.handleVehicleSettingsSubmit.bind(this));
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

        // Load historical calls button
        const loadHistoricalBtn = document.getElementById('loadHistoricalCalls');
        if (loadHistoricalBtn) {
            loadHistoricalBtn.addEventListener('click', () => {
                this.loadHistoricalCalls();
            });
        }

        // Export to PDF button
        const exportPDFBtn = document.getElementById('exportToPDF');
        if (exportPDFBtn) {
            exportPDFBtn.addEventListener('click', () => {
                this.exportToPDF();
            });
        }

        // Live search functionality
        const liveSearchInput = document.getElementById('liveSearchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        
        if (liveSearchInput) {
            liveSearchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.trim();
                
                // Show/hide clear button
                if (clearSearchBtn) {
                    clearSearchBtn.style.display = searchTerm ? 'flex' : 'none';
                }
                
                this.filterCalls(searchTerm);
            });
        }
        
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                if (liveSearchInput) {
                    liveSearchInput.value = '';
                    clearSearchBtn.style.display = 'none';
                    this.filterCalls('');
                }
            });
        }

        // Auto-load current year data on page load
        setTimeout(() => {
            this.loadHistoricalCalls();
        }, 500);
        
        // Edit modal event listeners
        this.bindEditModalEvents();
    }

    bindEditModalEvents() {
        const editModal = document.getElementById('editCallModal');
        const editModalClose = document.getElementById('editModalClose');
        const editModalCancel = document.getElementById('editModalCancel');
        const editCallForm = document.getElementById('editCallForm');
        const modalOverlay = editModal?.querySelector('.modal-overlay');

        // Close modal events
        [editModalClose, editModalCancel, modalOverlay].forEach(element => {
            if (element) {
                element.addEventListener('click', () => {
                    this.closeEditModal();
                });
            }
        });

        // Form submission
        if (editCallForm) {
            editCallForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEditSubmit();
            });
        }

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !editModal?.classList.contains('hidden')) {
                this.closeEditModal();
            }
        });
    }

    populateYearOptions() {
        const yearSelect = document.getElementById('historyYear');
        if (!yearSelect) return;

        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '';
        
        // Add years from current year back to 2025 (data started in October 2025)
        for (let year = currentYear; year >= 2025; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) {
                option.selected = true;
            }
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
        const yearSelect = document.getElementById('historyYear');
        const monthSelect = document.getElementById('historyMonth');
        if (!yearSelect || !monthSelect) return;
        
        const selectedYear = parseInt(yearSelect.value);
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // 1-12
        
        // Get all month options (skip the first "all year" option)
        const monthOptions = monthSelect.querySelectorAll('option:not([value=""])');
        
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
        
        // If currently selected month is now hidden/disabled, reset to "all year"
        const selectedMonth = parseInt(monthSelect.value);
        if (selectedMonth) {
            const selectedOption = monthSelect.querySelector(`option[value="${selectedMonth}"]`);
            if (selectedOption && (selectedOption.style.display === 'none' || selectedOption.disabled)) {
                monthSelect.value = ''; // Reset to "all year"
            }
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
            
            // Store all calls for filtering
            this.allCalls = data.calls || [];
            
            // Update vehicle info display
            await this.updateVehicleFilterInfo();
            
            this.displayHistoricalStats(data.stats, year, month);
            this.displayHistoricalCalls(this.allCalls, year, month);
            
            // Show search container if there are calls
            const searchContainer = document.getElementById('searchContainer');
            if (searchContainer) {
                searchContainer.style.display = this.allCalls.length > 0 ? 'block' : 'none';
            }
            
            // Show/hide export PDF button
            const exportPDFBtn = document.getElementById('exportToPDF');
            if (exportPDFBtn) {
                exportPDFBtn.style.display = this.allCalls.length > 0 ? 'block' : 'none';
            }
            
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
                } else if (
                    vehicleNumber.toString().length === 5 &&
                    (
                        ['1','2','3'].some(prefix => vehicleNumber.toString().startsWith(prefix)) ||
                        vehicleNumber.toString() === '99999'
                    )
                ) {
                    vehicleTypeHebrew = 'כונן אישי';
                    vehicleEmoji = '👨‍⚕️';
                } else {
                    vehicleTypeHebrew = 'אמבולנס';
                    vehicleEmoji = '🚑';
                }
            }

            // Modern card layout for historical calls
            return `
                <div class="call-item">
                    <div class="call-header">
                        <div class="call-type-badge ${displayCallType.includes('דחוף') ? 'urgent' : displayCallType.includes('אט') ? 'atan' : ''}">
                            ${displayCallType}
                        </div>
                        <div class="call-date">${formattedDate}</div>
                    </div>
                    
                    <div class="call-body">
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
                            <span class="call-value">${call.city || ''} ${call.street || ''} ${call.location || ''}</span>
                        </div>
                        ${call.alert_code ? `
                            <div class="call-row">
                                <span class="call-label">🔴 קוד הזנקה:</span>
                                <span class="call-value">${call.alert_code}</span>
                            </div>
                        ` : ''}
                        ${call.medical_code ? `
                            <div class="call-row">
                                <span class="call-label">🏥 קוד רפואי:</span>
                                <span class="call-value">${call.medical_code}</span>
                            </div>
                        ` : ''}
                        ${call.meter_visa_number ? `
                            <div class="call-row">
                                <span class="call-label">💳 מונה/ויזה:</span>
                                <span class="call-value">${call.meter_visa_number}</span>
                            </div>
                        ` : ''}
                        ${call.entry_code ? `
                            <div class="call-row">
                                <span class="call-label">🔑 קוד כניסה:</span>
                                <span class="call-value">${call.entry_code}</span>
                            </div>
                        ` : ''}
                        ${call.description ? `
                            <div class="call-row">
                                <span class="call-label">📝 תיאור:</span>
                                <span class="call-value">${call.description}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="call-footer">
                        <div class="call-vehicle">
                            <span class="vehicle-emoji">${vehicleEmoji}</span>
                            <span class="vehicle-info">${vehicleTypeHebrew} ${vehicleNumber}</span>
                        </div>
                        <button class="edit-call-btn" data-call-id="${call.id}" data-call-data='${JSON.stringify(call).replace(/'/g, "&apos;")}'>
                            ✏️ עריכה
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        callsList.innerHTML = callsHtml;
        
        // Bind edit buttons after rendering
        this.bindEditButtons();
    }

    bindEditButtons() {
        const editButtons = document.querySelectorAll('.edit-call-btn');
        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const callId = button.getAttribute('data-call-id');
                const callData = JSON.parse(button.getAttribute('data-call-data'));
                this.openEditModal(callId, callData);
            });
        });
    }

    filterCalls(searchTerm) {
        if (!this.allCalls || this.allCalls.length === 0) return;
        
        const searchLower = searchTerm.toLowerCase().trim();
        
        if (!searchLower) {
            // Show all calls if search is empty
            this.displayFilteredCalls(this.allCalls);
            this.updateFilteredCount(this.allCalls.length, false);
            return;
        }
        
        const filteredCalls = this.allCalls.filter(call => {
            // Search in medical code
            if (call.medical_code && call.medical_code.toLowerCase().includes(searchLower)) {
                return true;
            }
            
            // Search in alert code (קוד הזנקה)
            if (call.alert_code && call.alert_code.toLowerCase().includes(searchLower)) {
                return true;
            }
            
            // Search in date
            if (call.call_date) {
                const callDate = new Date(call.call_date);
                const formattedDate = callDate.toLocaleDateString('he-IL');
                if (formattedDate.includes(searchTerm)) {
                    return true;
                }
                // Also check ISO format
                if (call.call_date.includes(searchTerm)) {
                    return true;
                }
            }
            
            // Search in vehicle number
            if (call.vehicle_number && call.vehicle_number.toString().includes(searchTerm)) {
                return true;
            }
            
            // Search in location
            if (call.city && call.city.toLowerCase().includes(searchLower)) {
                return true;
            }
            if (call.street && call.street.toLowerCase().includes(searchLower)) {
                return true;
            }
            if (call.location && call.location.toLowerCase().includes(searchLower)) {
                return true;
            }
            
            // Search in call type
            if (call.call_type && call.call_type.toLowerCase().includes(searchLower)) {
                return true;
            }
            
            return false;
        });
        
        this.displayFilteredCalls(filteredCalls);
        this.updateFilteredCount(filteredCalls.length, true);
    }

    updateFilteredCount(count, isFiltered) {
        const filteredCountEl = document.getElementById('filteredCount');
        const countTextEl = document.getElementById('filteredCallsCount');
        
        if (!filteredCountEl || !countTextEl) return;
        
        countTextEl.textContent = count;
        filteredCountEl.style.display = isFiltered ? 'flex' : 'none';
    }

    displayFilteredCalls(calls) {
        const callsList = document.getElementById('historicalCallsList');
        if (!callsList) return;

        if (!calls || calls.length === 0) {
            callsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <p class="empty-text">לא נמצאו תוצאות</p>
                </div>
            `;
            return;
        }

        // Use the same rendering logic as displayHistoricalCalls
        const callsHtml = calls.map(call => {
            const callDate = new Date(call.call_date || call.created_at);
            const formattedDate = callDate.toLocaleDateString('he-IL');
            const formattedTime = `${call.start_time}${call.end_time ? ` - ${call.end_time}` : ' (פעיל)'}`;
            
            const duration = call.duration_minutes 
                ? `${call.duration_minutes} דקות`
                : (call.end_time ? 'לא חושב' : 'בתהליך');

            let displayCallType = call.call_type || 'לא צוין';
            if (displayCallType === 'urgent') displayCallType = '🚨 דחוף';
            else if (displayCallType === 'דחוף') displayCallType = '🚨 דחוף';
            else if (displayCallType === 'atan') displayCallType = '🔴 אט"ן';
            else if (displayCallType === 'אט"ן') displayCallType = '🔴 אט"ן';
            else if (displayCallType === 'אט״ן') displayCallType = '🔴 אט"ן';
            else if (displayCallType === 'aran') displayCallType = 'ארן';
            else if (displayCallType === 'natbag') displayCallType = 'נתבג';

            let vehicleTypeHebrew = call.vehicle_type;
            let vehicleEmoji = '🚑';
            const vehicleNumber = call.vehicle_number || '';
            
            if (vehicleNumber) {
                if (vehicleNumber.toString().startsWith('5')) {
                    vehicleTypeHebrew = 'אופנוע';
                    vehicleEmoji = '🏍️';
                } else if (vehicleNumber.toString().startsWith('6')) {
                    vehicleTypeHebrew = 'פיקנטו';
                    vehicleEmoji = '🚗';
                } else if (
                    vehicleNumber.toString().length === 5 &&
                    (
                        ['1','2','3'].some(prefix => vehicleNumber.toString().startsWith(prefix)) ||
                        vehicleNumber.toString() === '99999'
                    )
                ) {
                    vehicleTypeHebrew = 'כונן אישי';
                    vehicleEmoji = '👨‍⚕️';
                } else {
                    vehicleTypeHebrew = 'אמבולנס';
                    vehicleEmoji = '🚑';
                }
            }

            return `
                <div class="call-item">
                    <div class="call-header">
                        <div class="call-type-badge ${displayCallType.includes('דחוף') ? 'urgent' : displayCallType.includes('אט') ? 'atan' : ''}">
                            ${displayCallType}
                        </div>
                        <div class="call-date">${formattedDate}</div>
                    </div>
                    
                    <div class="call-body">
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
                            <span class="call-value">${call.city || ''} ${call.street || ''} ${call.location || ''}</span>
                        </div>
                        ${call.alert_code ? `
                            <div class="call-row">
                                <span class="call-label">🔴 קוד הזנקה:</span>
                                <span class="call-value">${call.alert_code}</span>
                            </div>
                        ` : ''}
                        ${call.medical_code ? `
                            <div class="call-row">
                                <span class="call-label">🏥 קוד רפואי:</span>
                                <span class="call-value">${call.medical_code}</span>
                            </div>
                        ` : ''}
                        ${call.meter_visa_number ? `
                            <div class="call-row">
                                <span class="call-label">💳 מונה/ויזה:</span>
                                <span class="call-value">${call.meter_visa_number}</span>
                            </div>
                        ` : ''}
                        ${call.entry_code ? `
                            <div class="call-row">
                                <span class="call-label">🔑 קוד כניסה:</span>
                                <span class="call-value">${call.entry_code}</span>
                            </div>
                        ` : ''}
                        ${call.description ? `
                            <div class="call-row">
                                <span class="call-label">📝 תיאור:</span>
                                <span class="call-value">${call.description}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="call-footer">
                        <div class="call-vehicle">
                            <span class="vehicle-emoji">${vehicleEmoji}</span>
                            <span class="vehicle-info">${vehicleTypeHebrew} ${vehicleNumber}</span>
                        </div>
                        <button class="edit-call-btn" data-call-id="${call.id}" data-call-data='${JSON.stringify(call).replace(/'/g, "&apos;")}'>
                            ✏️ עריכה
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        callsList.innerHTML = callsHtml;
        this.bindEditButtons();
    }

    // Vehicle display methods
    async loadVehicleDisplay() {
        try {
            // First set from user data
            this.currentVehicle = {
                number: this.getUserVehicleNumber(),
                type: this.getUserVehicleType()
            };
            this.updateVehicleDisplay();
            
            // Then try to get from API (in case user customized it)
            const response = await fetch('/api/vehicle/current', {
                headers: this.getAuthHeaders()
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data && result.data.vehicle_number) {
                    this.currentVehicle = {
                        number: result.data.vehicle_number,
                        type: result.data.vehicle_type || this.currentVehicle.type
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

    // Edit call methods
    openEditModal(callId, callData) {
        const modal = document.getElementById('editCallModal');
        if (!modal) return;

        // Populate form fields
        document.getElementById('editCallId').value = callId;
        document.getElementById('editCallType').value = callData.call_type || 'דחוף';
        
        // Format date properly
        const callDate = new Date(callData.call_date || callData.created_at);
        document.getElementById('editCallDate').value = callDate.toISOString().split('T')[0];
        
        document.getElementById('editStartTime').value = callData.start_time || '';
        document.getElementById('editEndTime').value = callData.end_time || '';
        
        // Split location into city, street, and details
        // Expected format: "City, Street, Details" or "City, Street"
        const locationParts = (callData.location || '').split(',').map(s => s.trim());
        document.getElementById('editCity').value = locationParts[0] || '';
        document.getElementById('editStreet').value = locationParts[1] || '';
        document.getElementById('editLocation').value = locationParts.slice(2).join(', ') || '';
        
        document.getElementById('editMeterVisaNumber').value = callData.meter_visa_number || '';
        
        // Set entry code
        document.getElementById('editEntryCode').value = callData.entry_code || '';
        
        // Set code dropdowns
        document.getElementById('editAlertCode').value = callData.alert_code_id || '';
        document.getElementById('editMedicalCode').value = callData.medical_code_id || '';
        
        document.getElementById('editDescription').value = callData.description || '';

        // Show modal
        modal.classList.remove('hidden');
    }

    closeEditModal() {
        const modal = document.getElementById('editCallModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    normalizeCallTypeForEdit(callType) {
        if (!callType) return 'urgent';
        
        // Convert Hebrew display back to English values
        if (callType.includes('דחוף') || callType === 'urgent') return 'urgent';
        if (callType.includes('אט"ן') || callType.includes('אט״ן') || callType === 'atan') return 'atan';
        if (callType.includes('ארן') || callType === 'aran') return 'aran';
        if (callType.includes('נתבג') || callType === 'natbag') return 'natbag';
        
        return callType;
    }

    async handleEditSubmit() {
        try {
            this.setLoading(true);
            
            const callId = document.getElementById('editCallId').value;
            const city = document.getElementById('editCity').value.trim();
            const street = document.getElementById('editStreet').value.trim();
            const locationDetails = document.getElementById('editLocation').value.trim();
            const meterVisaNumber = document.getElementById('editMeterVisaNumber').value.trim();
            const entryCode = document.getElementById('editEntryCode').value.trim();
            
            // Validate meter/visa number is numeric only if provided
            if (meterVisaNumber && !/^\d+$/.test(meterVisaNumber)) {
                this.showToast('מספר מונה/ויזה חייב להכיל רק מספרים', 'error');
                this.setLoading(false);
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

            const response = await fetch(`/api/calls/${callId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.showToast('הקריאה עודכנה בהצלחה!', 'success');
                this.closeEditModal();
                // Reload the calls to show updated data
                await this.loadHistoricalCalls();
            } else {
                throw new Error(result.message || 'שגיאה בעדכון הקריאה');
            }
            
        } catch (error) {
            console.error('Error updating call:', error);
            this.showToast('שגיאה בעדכון הקריאה', 'error');
        } finally {
            this.setLoading(false);
        }
    }

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
        }
    }

    populateAlertCodeDropdowns() {
        const editAlertCodeSelect = document.getElementById('editAlertCode');
        
        const options = this.alertCodes
            .filter(code => code && code.code)
            .map(code => `<option value="${code.id}">${code.code}</option>`)
            .join('');
        
        if (editAlertCodeSelect) {
            editAlertCodeSelect.innerHTML = '<option value="">בחר קוד הזנקה</option>' + options;
        }
    }

    populateMedicalCodeDropdowns() {
        const editMedicalCodeSelect = document.getElementById('editMedicalCode');
        
        const options = this.medicalCodes
            .filter(code => code && code.code)
            .map(code => `<option value="${code.id}">${code.code}</option>`)
            .join('');
        
        if (editMedicalCodeSelect) {
            editMedicalCodeSelect.innerHTML = '<option value="">בחר קוד רפואי</option>' + options;
        }
    }

    // Export to PDF functionality using browser print
    async exportToPDF() {
        const year = document.getElementById('historyYear').value;
        const month = document.getElementById('historyMonth').value;
        
        if (!this.allCalls || this.allCalls.length === 0) {
            this.showToast('אין נתונים לייצוא', 'error');
            return;
        }

        try {

            // Month names in Hebrew
            const monthNames = {
                1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל',
                5: 'מאי', 6: 'יוני', 7: 'יולי', 8: 'אוגוסט',
                9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר'
            };

            const periodText = month ? `${monthNames[parseInt(month)]} ${year}` : `שנת ${year}`;
            const vehicleText = `רכב ${this.currentVehicle.number}`;
            
            // Sort calls from oldest to newest by date and start time
            const sortedCalls = [...this.allCalls].sort((a, b) => {
                // Compare dates first
                const dateA = new Date(a.call_date || a.created_at);
                const dateB = new Date(b.call_date || b.created_at);
                const dateDiff = dateA - dateB;
                
                if (dateDiff !== 0) return dateDiff;
                
                // If same date, compare start times
                const timeA = a.start_time || '00:00:00';
                const timeB = b.start_time || '00:00:00';
                return timeA.localeCompare(timeB);
            });
            
            // Calculate statistics
            const stats = this.calculateStats(sortedCalls);
            
            // Create calls rows HTML
            const callsRows = sortedCalls.map((call, index) => {
                const callDate = new Date(call.call_date || call.created_at);
                const formattedDate = callDate.toLocaleDateString('he-IL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit'
                });
                
                const startTime = call.start_time ? call.start_time.substring(0, 5) : '-';
                const arrivalTime = call.arrival_time ? call.arrival_time.substring(0, 5) : '-';
                const endTime = call.end_time ? call.end_time.substring(0, 5) : '-';
                const duration = call.duration_minutes ? `${call.duration_minutes} דק'` : '-';
                
                const location = this.formatLocation(call);
                const alertCode = call.alert_code || '-';
                const medicalCode = call.medical_code || '-';

                return `
                    <tr style="${index % 2 === 0 ? 'background: #f9fafb;' : ''}">
                        <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${index + 1}</td>
                        <td style="padding: 6px; border: 1px solid #ddd;">${call.call_type || '-'}</td>
                        <td style="padding: 6px; border: 1px solid #ddd;">${formattedDate}</td>
                        <td style="padding: 6px; border: 1px solid #ddd;">${startTime}</td>
                        <td style="padding: 6px; border: 1px solid #ddd;">${arrivalTime}</td>
                        <td style="padding: 6px; border: 1px solid #ddd;">${endTime}</td>
                        <td style="padding: 6px; border: 1px solid #ddd;">${duration}</td>
                        <td style="padding: 6px; border: 1px solid #ddd; font-size: 10px;">${location}</td>
                        <td style="padding: 6px; border: 1px solid #ddd;">${alertCode}</td>
                        <td style="padding: 6px; border: 1px solid #ddd;">${medicalCode}</td>
                    </tr>
                `;
            }).join('');

            // Create print window
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>דוח קריאות - ${periodText}</title>
    <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Rubik', Arial, sans-serif; direction: rtl; padding: 20px; background: white; color: #000; }
        .header { text-align: center; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
        .header h1 { font-size: 32px; margin-bottom: 10px; }
        .header h2 { font-size: 24px; font-weight: 500; }
        .header h3 { font-size: 18px; font-weight: 400; margin-top: 10px; }
        .section { margin-bottom: 30px; page-break-inside: avoid; }
        .section-title { color: #dc2626; border-bottom: 3px solid #dc2626; padding-bottom: 10px; margin-bottom: 20px; font-size: 24px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 10px; border: 1px solid #ddd; text-align: right; }
        th { background: #dc2626; color: white; font-weight: 700; }
        .stats-table td { font-size: 16px; }
        .stats-table td:first-child { font-weight: 700; width: 60%; }
        .stats-table td:last-child { text-align: center; font-weight: 600; }
        .stats-table tr:nth-child(odd) { background: #f3f4f6; }
        .stats-table tr:first-child td:last-child { font-size: 20px; color: #dc2626; font-weight: 700; }
        .calls-table { font-size: 11px; }
        .calls-table th { text-align: center; padding: 8px; }
        .calls-table td { padding: 6px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; }
        @media print { body { padding: 10px; } .section { page-break-inside: avoid; } }
        @page { size: A3 landscape; margin: 15mm; }
    </style>
</head>
<body>
    <div class="header">
        <div style="font-size: 40px; margin-bottom: 10px;">🏍️</div>
        <h1>דוח קריאות - מד״א</h1>
        <h2>${periodText}</h2>
        <h3>${vehicleText}</h3>
    </div>
    <div class="section">
        <h2 class="section-title">סיכום סטטיסטי</h2>
        <table class="stats-table">
            <tr><td>סה״כ קריאות:</td><td>${stats.totalCalls}</td></tr>
            <tr><td>קריאות דחופות:</td><td>${stats.urgentCalls}</td></tr>
            <tr><td>קריאות אט״ן:</td><td>${stats.atanCalls}</td></tr>
            <tr><td>קריאות ארן:</td><td>${stats.aranCalls}</td></tr>
            <tr><td>קריאות נתב״ג:</td><td>${stats.netbagCalls || 0}</td></tr>
            <tr><td>סה״כ שעות:</td><td>${this.formatHoursAndMinutes(stats.totalHours)}</td></tr>
            ${stats.averageArrivalTime ? `<tr><td>זמן הגעה ממוצע:</td><td>${stats.averageArrivalTime}</td></tr>` : ''}
        </table>
    </div>
    <div class="section">
        <h2 class="section-title">פירוט קריאות</h2>
        <table class="calls-table">
            <thead><tr><th>#</th><th>סוג</th><th>תאריך</th><th>יציאה</th><th>הגעה</th><th>סיום</th><th>משך</th><th>מיקום</th><th>קוד הזנקה</th><th>קוד רפואי</th></tr></thead>
            <tbody>${callsRows}</tbody>
        </table>
    </div>
    <div class="footer">
        <p>נוצר ב: ${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
    </div>
    <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
</body>
</html>
            `);
            printWindow.document.close();
            
            this.showToast('חלון ההדפסה נפתח - שמור כ-PDF', 'success');

        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showToast('שגיאה ביצירת קובץ PDF', 'error');
        }
    }

    // Helper function to format location
    formatLocation(call) {
        const parts = [];
        if (call.city) parts.push(call.city);
        if (call.street) parts.push(call.street);
        if (call.location) parts.push(call.location);
        return parts.length > 0 ? parts.join(', ') : '-';
    }

    // Helper function to calculate statistics
    calculateStats(calls) {
        const stats = {
            totalCalls: calls.length,
            urgentCalls: 0,
            atanCalls: 0,
            aranCalls: 0,
            netbagCalls: 0,
            totalHours: 0,
            averageArrivalTime: null
        };

        const arrivalTimes = [];

        calls.forEach(call => {
            // Count by type
            const callType = call.call_type || '';
            if (callType === 'דחוף') stats.urgentCalls++;
            else if (callType === 'אט"ן' || callType === 'אט״ן' || callType === 'אטן') stats.atanCalls++;
            else if (callType === 'ארן') stats.aranCalls++;
            else if (callType === 'נתבג' || callType === 'נתב״ג') stats.netbagCalls++;

            // Sum total hours
            if (call.duration_minutes) {
                stats.totalHours += call.duration_minutes / 60;
            }

            // Calculate arrival times for average
            if (call.start_time && call.arrival_time) {
                const [startHour, startMin] = call.start_time.split(':').map(Number);
                const [arrivalHour, arrivalMin] = call.arrival_time.split(':').map(Number);
                
                const startMinutes = startHour * 60 + startMin;
                const arrivalMinutes = arrivalHour * 60 + arrivalMin;
                
                let diff = arrivalMinutes - startMinutes;
                if (diff < 0) diff += 24 * 60; // Handle midnight crossing
                
                arrivalTimes.push(diff);
            }
        });

        // Calculate average arrival time
        if (arrivalTimes.length > 0) {
            const avgMinutes = Math.round(arrivalTimes.reduce((a, b) => a + b, 0) / arrivalTimes.length);
            const hours = Math.floor(avgMinutes / 60);
            const minutes = avgMinutes % 60;
            
            if (hours > 0) {
                stats.averageArrivalTime = `${hours}h ${minutes}m`;
            } else {
                stats.averageArrivalTime = `${minutes}m`;
            }
        }

        return stats;
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

// Initialize the history viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.historyViewer = new HistoryViewer();
});

// Handle visibility change to refresh data when tab becomes active
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.historyViewer) {
        // Refresh vehicle settings when tab becomes visible
        window.historyViewer.loadVehicleSettings();
    }
});
