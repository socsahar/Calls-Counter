// MDA CallCounter - Entry Codes Page JavaScript
class EntryCodesManager {
    constructor() {
        this.isLoading = false;
        this.entryCodes = [];
        this.filteredCodes = [];
        this.currentSort = {
            column: 'city',
            direction: 'asc'
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

    async init() {
        try {
            // Check authentication first
            if (!this.checkAuthentication()) {
                return;
            }

            this.setLoading(false);
            this.bindEvents();
            await this.loadEntryCodes();
            
            console.log('🔑 Entry Codes Manager - Initialized successfully');
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

        // Filter inputs
        const filterCity = document.getElementById('filterCity');
        const filterStreet = document.getElementById('filterStreet');
        const filterEntryCode = document.getElementById('filterEntryCode');

        if (filterCity) {
            filterCity.addEventListener('input', () => this.applyFilters());
        }
        if (filterStreet) {
            filterStreet.addEventListener('input', () => this.applyFilters());
        }
        if (filterEntryCode) {
            filterEntryCode.addEventListener('input', () => this.applyFilters());
        }

        // Clear filters button
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }

        // Sortable headers
        const sortableHeaders = document.querySelectorAll('.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const sortColumn = header.dataset.sort;
                this.handleSort(sortColumn);
            });
        });
    }

    async loadEntryCodes() {
        try {
            this.setLoading(true);
            console.log('🔑 Loading entry codes...');

            const response = await fetch('/api/entry-codes', {
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
            
            if (result.success) {
                this.entryCodes = result.data || [];
                this.filteredCodes = [...this.entryCodes];
                console.log(`🔑 Loaded ${this.entryCodes.length} entry codes`);
                this.renderEntryCodes();
            } else {
                throw new Error(result.message || 'שגיאה בטעינת קודי הכניסה');
            }
        } catch (error) {
            console.error('Error loading entry codes:', error);
            this.showToast('שגיאה בטעינת קודי הכניסה', 'error');
            this.renderEmptyState();
        } finally {
            this.setLoading(false);
        }
    }

    applyFilters() {
        const cityFilter = document.getElementById('filterCity').value.trim().toLowerCase();
        const streetFilter = document.getElementById('filterStreet').value.trim().toLowerCase();
        const codeFilter = document.getElementById('filterEntryCode').value.trim().toLowerCase();

        this.filteredCodes = this.entryCodes.filter(entry => {
            const matchCity = !cityFilter || (entry.city || '').toLowerCase().includes(cityFilter);
            const matchStreet = !streetFilter || (entry.street || '').toLowerCase().includes(streetFilter);
            const matchCode = !codeFilter || (entry.entry_code || '').toLowerCase().includes(codeFilter);
            
            return matchCity && matchStreet && matchCode;
        });

        console.log(`🔍 Filtered: ${this.filteredCodes.length} of ${this.entryCodes.length} entries`);
        this.renderEntryCodes();
    }

    clearFilters() {
        document.getElementById('filterCity').value = '';
        document.getElementById('filterStreet').value = '';
        document.getElementById('filterEntryCode').value = '';
        
        this.filteredCodes = [...this.entryCodes];
        this.renderEntryCodes();
    }

    handleSort(column) {
        if (this.currentSort.column === column) {
            // Toggle direction
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // New column, default to ascending
            this.currentSort.column = column;
            this.currentSort.direction = 'asc';
        }

        this.sortEntryCodes();
        this.updateSortIndicators();
        this.renderEntryCodes();
    }

    sortEntryCodes() {
        const { column, direction } = this.currentSort;
        
        this.filteredCodes.sort((a, b) => {
            let aVal = a[column] || '';
            let bVal = b[column] || '';
            
            // Convert to lowercase for case-insensitive sorting
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();
            
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    updateSortIndicators() {
        // Clear all indicators
        document.querySelectorAll('.sort-indicator').forEach(indicator => {
            indicator.textContent = '';
            indicator.className = 'sort-indicator';
        });

        // Set active indicator
        const activeHeader = document.querySelector(`[data-sort="${this.currentSort.column}"]`);
        if (activeHeader) {
            const indicator = activeHeader.querySelector('.sort-indicator');
            indicator.textContent = this.currentSort.direction === 'asc' ? '▲' : '▼';
            indicator.classList.add('active');
        }
    }

    renderEntryCodes() {
        const tbody = document.getElementById('entryCodesBody');
        const countSpan = document.getElementById('entriesCount');
        
        if (!tbody) return;

        countSpan.textContent = this.filteredCodes.length;

        if (this.filteredCodes.length === 0) {
            this.renderEmptyState();
            return;
        }

        tbody.innerHTML = this.filteredCodes.map(entry => `
            <tr>
                <td class="entry-code-cell" data-label="קוד כניסה">
                    <strong>${this.escapeHtml(entry.entry_code)}</strong>
                </td>
                <td data-label="עיר">${this.escapeHtml(entry.city)}</td>
                <td data-label="רחוב">${this.escapeHtml(entry.street)}</td>
                <td class="location-details-cell" data-label="פרטים נוספים">${this.escapeHtml(entry.location_details || '-')}</td>
                <td data-label="פעולות">
                    <button class="copy-btn" onclick="entryCodesManager.copyToClipboard('${this.escapeHtml(entry.entry_code)}')">
                        📋 העתק
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderEmptyState() {
        const tbody = document.getElementById('entryCodesBody');
        tbody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="5" class="text-center">
                    <div class="empty-icon">🔍</div>
                    <p class="empty-text">לא נמצאו קודי כניסה</p>
                </td>
            </tr>
        `;
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('הקוד הועתק ללוח!', 'success');
        } catch (error) {
            console.error('Failed to copy:', error);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.showToast('הקוד הועתק ללוח!', 'success');
            } catch (err) {
                this.showToast('שגיאה בהעתקה', 'error');
            }
            document.body.removeChild(textArea);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

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
            const messageSpan = toast.querySelector('.toast-message');
            if (messageSpan) {
                messageSpan.textContent = message;
            }
            
            toast.classList.remove('hidden');
            
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 3000);
        }
    }
}

// Initialize when DOM is ready
let entryCodesManager;
document.addEventListener('DOMContentLoaded', () => {
    entryCodesManager = new EntryCodesManager();
});
