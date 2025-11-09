// Israeli Addresses using Google Places Autocomplete API (New API)
class GoogleAddressAutocomplete {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.currentInput = null;
        this.suggestionsList = null;
        this.selectedIndex = -1;
        this.initialized = false;
        this.abortController = null;
    }

    // Initialize Google Places API
    async init(inputElement, type = 'address') {
        this.currentInput = inputElement;
        this.filterType = type; // 'address', 'city', or 'street'
        
        // No need to wait for Google Maps SDK - we use REST API directly
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

        // Cancel previous request
        if (this.abortController) {
            this.abortController.abort();
        }

        try {
            const suggestions = await this.getSuggestions(value);
            this.showSuggestions(suggestions);
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error fetching suggestions:', error);
            }
        }
    }

    async getSuggestions(query) {
        // Use Fetch API to call Google Places API (New) directly
        // This avoids the deprecated AutocompleteService
        this.abortController = new AbortController();
        
        try {
            const endpoint = 'https://places.googleapis.com/v1/places:autocomplete';
            
            const requestBody = {
                input: query,
                languageCode: 'iw',
                includedRegionCodes: ['IL'], // Israel only
                locationRestriction: {
                    rectangle: {
                        low: { latitude: 29.5, longitude: 34.2 },
                        high: { latitude: 33.3, longitude: 35.9 }
                    }
                }
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey
                },
                body: JSON.stringify(requestBody),
                signal: this.abortController.signal
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.suggestions || data.suggestions.length === 0) {
                return [];
            }

            return data.suggestions.map(suggestion => ({
                text: suggestion.placePrediction?.text?.text || '',
                mainText: suggestion.placePrediction?.structuredFormat?.mainText?.text || '',
                secondaryText: suggestion.placePrediction?.structuredFormat?.secondaryText?.text || '',
                placeId: suggestion.placePrediction?.placeId || ''
            }));
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw error;
            }
            console.error('Places API error:', error);
            return [];
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
    }
}

// Export for use in other scripts
window.GoogleAddressAutocomplete = GoogleAddressAutocomplete;
