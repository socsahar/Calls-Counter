// Israeli Addresses using Google Places Autocomplete API
class GoogleAddressAutocomplete {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.autocompleteService = null;
        this.sessionToken = null;
        this.currentInput = null;
        this.suggestionsList = null;
        this.selectedIndex = -1;
        this.initialized = false;
    }

    // Initialize Google Places API
    async init(inputElement, type = 'address') {
        this.currentInput = inputElement;
        this.filterType = type; // 'address', 'city', or 'street'
        
        // Wait for Google Maps API to load
        await this.waitForGoogleMaps();
        
        // Initialize services
        if (window.google && window.google.maps && window.google.maps.places) {
            this.autocompleteService = new google.maps.places.AutocompleteService();
            this.sessionToken = new google.maps.places.AutocompleteSessionToken();
            this.initialized = true;
            
            // Create suggestions dropdown
            this.createSuggestionsList();
            
            // Add event listeners
            this.currentInput.addEventListener('input', (e) => this.handleInput(e));
            this.currentInput.addEventListener('keydown', (e) => this.handleKeydown(e));
            this.currentInput.addEventListener('blur', () => {
                setTimeout(() => this.hideSuggestions(), 200);
            });
            this.currentInput.addEventListener('focus', (e) => {
                if (e.target.value.trim().length >= 2) {
                    this.handleInput(e);
                }
            });
            
            console.log('✅ Google Places Autocomplete initialized for:', inputElement.id);
        } else {
            console.error('❌ Google Maps API not loaded');
        }
    }

    // Wait for Google Maps to be ready
    waitForGoogleMaps() {
        return new Promise((resolve) => {
            if (window.google && window.google.maps && window.google.maps.places) {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (window.google && window.google.maps && window.google.maps.places) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    console.warn('⚠️ Google Maps API loading timeout');
                    resolve();
                }, 10000);
            }
        });
    }

    createSuggestionsList() {
        this.suggestionsList = document.createElement('div');
        this.suggestionsList.className = 'address-suggestions google-suggestions';
        this.suggestionsList.style.display = 'none';
        
        this.currentInput.parentNode.insertBefore(
            this.suggestionsList,
            this.currentInput.nextSibling
        );
    }

    async handleInput(event) {
        const value = event.target.value.trim();
        
        if (value.length < 2) {
            this.hideSuggestions();
            return;
        }

        if (!this.initialized) {
            console.warn('⚠️ Google Places not initialized yet');
            return;
        }

        try {
            const suggestions = await this.getSuggestions(value);
            this.showSuggestions(suggestions);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }

    getSuggestions(query) {
        return new Promise((resolve, reject) => {
            if (!this.autocompleteService) {
                reject(new Error('Autocomplete service not initialized'));
                return;
            }

            const request = {
                input: query,
                sessionToken: this.sessionToken,
                componentRestrictions: { country: 'il' }, // Restrict to Israel
                types: this.getPlaceTypes(),
                language: 'iw' // Hebrew
            };

            this.autocompleteService.getPlacePredictions(request, (predictions, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                    const suggestions = predictions.map(prediction => ({
                        text: prediction.description,
                        placeId: prediction.place_id,
                        mainText: prediction.structured_formatting.main_text,
                        secondaryText: prediction.structured_formatting.secondary_text
                    }));
                    resolve(suggestions);
                } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    resolve([]);
                } else {
                    console.warn('Places API status:', status);
                    resolve([]);
                }
            });
        });
    }

    getPlaceTypes() {
        switch (this.filterType) {
            case 'city':
                return ['(cities)'];
            case 'street':
            case 'address':
                return ['address'];
            default:
                return ['geocode'];
        }
    }

    showSuggestions(suggestions) {
        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        this.suggestionsList.innerHTML = '';
        this.selectedIndex = -1;
        
        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            
            // Create main and secondary text
            const mainText = document.createElement('div');
            mainText.className = 'suggestion-main';
            mainText.textContent = suggestion.mainText;
            
            const secondaryText = document.createElement('div');
            secondaryText.className = 'suggestion-secondary';
            secondaryText.textContent = suggestion.secondaryText || '';
            
            item.appendChild(mainText);
            if (suggestion.secondaryText) {
                item.appendChild(secondaryText);
            }
            
            item.dataset.text = suggestion.mainText; // Use main text only
            item.dataset.fullText = suggestion.text;
            item.dataset.placeId = suggestion.placeId;
            item.dataset.index = index;
            
            item.addEventListener('click', () => {
                this.selectSuggestion(suggestion.mainText);
            });
            
            this.suggestionsList.appendChild(item);
        });
        
        this.suggestionsList.style.display = 'block';
    }

    hideSuggestions() {
        if (this.suggestionsList) {
            this.suggestionsList.style.display = 'none';
        }
        this.selectedIndex = -1;
    }

    handleKeydown(event) {
        const suggestions = this.suggestionsList.querySelectorAll('.suggestion-item');
        
        if (suggestions.length === 0) return;
        
        switch(event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, suggestions.length - 1);
                this.highlightSuggestion(suggestions);
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.highlightSuggestion(suggestions);
                break;
                
            case 'Enter':
                event.preventDefault();
                if (this.selectedIndex >= 0) {
                    const selectedItem = suggestions[this.selectedIndex];
                    this.selectSuggestion(selectedItem.dataset.text);
                }
                break;
                
            case 'Escape':
                this.hideSuggestions();
                break;
        }
    }

    highlightSuggestion(suggestions) {
        suggestions.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    selectSuggestion(text) {
        this.currentInput.value = text;
        this.hideSuggestions();
        this.currentInput.focus();
        
        // Regenerate session token for next search
        this.sessionToken = new google.maps.places.AutocompleteSessionToken();
    }
}

// Export for use in other scripts
window.GoogleAddressAutocomplete = GoogleAddressAutocomplete;
