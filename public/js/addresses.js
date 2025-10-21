// Israeli Cities and Streets Database for Autocomplete
class AddressAutocomplete {
    constructor() {
        this.cities = [
            // Major Cities
            'תל אביב-יפו', 'ירושלים', 'חיפה', 'ראשון לציון', 'פתח תקווה',
            'אשדוד', 'נתניה', 'באר שבע', 'בני ברק', 'חולון',
            'רמת גן', 'אשקלון', 'רחובות', 'בת ים', 'כפר סבא',
            'חדרה', 'הרצליה', 'מודיעין-מכבים-רעות', 'נצרת', 'לוד',
            'רעננה', 'רמלה', 'קריית אתא', 'קריית גת', 'קריית ביאליק',
            'נס ציונה', 'הוד השרון', 'גבעתיים', 'קריית אונו', 'נהריה',
            'קריית מוצקין', 'יבנה', 'באקה אל-גרביה', 'אור יהודה', 'קריית ים',
            'מעלה אדומים', 'טבריה', 'אופקים', 'רהט', 'רמת השרון',
            'גדרה', 'כרמיאל', 'אור עקיבא', 'ביתר עילית', 'יקנעם עילית',
            'זכרון יעקב', 'אילת', 'אלעד', 'מגדל העמק', 'דימונה',
            'טמרה', 'סכנין', 'שפרעם', 'אריאל', 'טירת כרמל',
            'קלנסווה', 'מעלות-תרשיחא', 'תל שבע', 'מבשרת ציון', 'קריית שמונה',
            'נשר', 'צפת', 'עפולה', 'שדרות', 'ערד', 'בית שאן',
            
            // Additional Cities
            'אבן יהודה', 'אזור', 'איילת השחר', 'אכסאל', 'אלפי מנשה',
            'אעבלין', 'אפרת', 'בוקעאתא', 'בועיינה-נוג׳ידאת', 'ביר אל-מכסור',
            'בית דגון', 'בית שמש', 'בנימינה-גבעת עדה', 'ג׳דיידה-מכר', 'ג׳לג׳וליה',
            'ג׳סר א-זרקא', 'ג׳ת', 'גבעת שמואל', 'גן יבנה', 'דאלית אל-כרמל',
            'דבוריה', 'דייר אל-אסד', 'דייר חנא', 'זמר', 'חורה',
            'חורפיש', 'חצור הגלילית', 'טורעאן', 'טייבה', 'טירה',
            'יהוד-מונוסון', 'יפיע', 'ירכא', 'כאבול', 'כוכב אבו אל-היג׳א',
            'כסיפה', 'כעביה-טבאש-חג׳אג׳רה', 'כפר יונה', 'כפר כנא', 'כפר מנדא',
            'כפר קאסם', 'כפר קרע', 'לקיה', 'מג׳ד אל-כרום', 'מג׳דל שמס',
            'מזכרת בתיה', 'מי עמי', 'מסעדה', 'מעיליא', 'מצפה רמון',
            'נוף הגליל', 'נחף', 'נעורה', 'נתיבות', 'ע׳ג׳ר',
            'עילוט', 'עין מאהל', 'עראבה', 'ערערה', 'ערערה-בנגב',
            'פוריידיס', 'פרדס חנה-כרכור', 'פרדסיה', 'ציפורי', 'קדימה-צורן',
            'קלנסווה', 'קצרין', 'ראמה', 'ראש העין', 'ראש פינה',
            'רינה', 'רכסים', 'רמת ישי', 'שאר מ׳', 'שבלי - אום אל-גנם',
            'שגב-שלום', 'שלומי', 'שעב', 'שרת', 'תל מונד'
        ];

        this.commonStreets = [
            // Common street names in Israel
            'הרצל', 'ויצמן', 'בן גוריון', 'ז׳בוטינסקי', 'רוטשילד', 'דיזנגוף',
            'אלנבי', 'שדרות ירושלים', 'הנשיא', 'המלך גורג׳', 'הרב קוק', 'סוקולוב',
            'בן יהודה', 'הירקון', 'הנביאים', 'יפו', 'הרב ניסנבאום', 'קרן היסוד',
            'אחד העם', 'שפירא', 'ביאליק', 'חנה סנש', 'האצ״ל', 'בגין', 'רבין',
            'שד׳ בן גוריון', 'ח׳ בן איש חי', 'ירמיהו', 'שלמה המלך', 'דוד המלך',
            'משה דיין', 'גולדה מאיר', 'עזרא', 'הבנים', 'הגליל', 'הנגב', 'הכרמל',
            'העצמאות', 'התקווה', 'השלום', 'האחווה', 'הגבורה', 'החירות', 'הציונות',
            'יהודה הלוי', 'רמב״ם', 'רש״י', 'רד״ק', 'אברבנאל', 'אבן גבירול',
            'נחום סוקולוב', 'מקס נורדאו', 'מרדכי', 'אסתר המלכה', 'בר כוכבא',
            'יוסף', 'צה״ל', 'ההגנה', 'הפלמ״ח', 'לח״י', 'האצ״ל', 'השומר',
            'הנוטרים', 'המגינים', 'המייסדים', 'החלוצים', 'העליה', 'הבילויים',
            'שד׳ התקווה', 'שד׳ שאול המלך', 'שד׳ הציונות', 'שד׳ העצמאות',
            'דרך חברון', 'דרך יפו', 'דרך בית לחם', 'דרך שכם', 'דרך רמאללה',
            'רח׳ 1', 'רח׳ 2', 'רח׳ 3', 'רח׳ 4', 'רח׳ 5', 'רח׳ 6', 'רח׳ 7', 'רח׳ 8', 'רח׳ 9',
            'הראשונים', 'השניים', 'השלישי', 'הרביעי', 'החמישי', 'הששי', 'השביעי',
            'דקר', 'טרומפלדור', 'בורוכוב', 'גורדון', 'ברנר', 'שמאי', 'הלל',
            'אריאל שרון', 'יצחק שמיר', 'שמעון פרס', 'אהרן ברק', 'דוד בן גוריון'
        ];

        this.currentInput = null;
        this.suggestionsList = null;
        this.selectedIndex = -1;
    }

    init(inputElement, type = 'both') {
        this.currentInput = inputElement;
        this.filterType = type; // 'city', 'street', or 'both'
        
        // Create suggestions dropdown
        this.createSuggestionsList();
        
        // Add event listeners
        this.currentInput.addEventListener('input', (e) => this.handleInput(e));
        this.currentInput.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.currentInput.addEventListener('blur', () => {
            // Delay to allow click on suggestion
            setTimeout(() => this.hideSuggestions(), 200);
        });
        this.currentInput.addEventListener('focus', (e) => {
            if (e.target.value.trim().length > 0) {
                this.handleInput(e);
            }
        });
    }

    createSuggestionsList() {
        // Create dropdown container
        this.suggestionsList = document.createElement('div');
        this.suggestionsList.className = 'address-suggestions';
        this.suggestionsList.style.display = 'none';
        
        // Insert after input field
        this.currentInput.parentNode.insertBefore(
            this.suggestionsList, 
            this.currentInput.nextSibling
        );
    }

    handleInput(event) {
        const value = event.target.value.trim();
        
        if (value.length < 2) {
            this.hideSuggestions();
            return;
        }

        const suggestions = this.getSuggestions(value);
        this.showSuggestions(suggestions);
    }

    getSuggestions(query) {
        const lowerQuery = query.toLowerCase();
        const suggestions = [];
        
        // Search in cities (only if filterType is 'city' or 'both')
        if (this.filterType === 'city' || this.filterType === 'both') {
            this.cities.forEach(city => {
                if (city.toLowerCase().includes(lowerQuery)) {
                    suggestions.push({
                        text: city,
                        type: 'city',
                        display: this.filterType === 'both' ? `${city} (עיר)` : city
                    });
                }
            });
        }
        
        // Search in streets (only if filterType is 'street' or 'both')
        if (this.filterType === 'street' || this.filterType === 'both') {
            this.commonStreets.forEach(street => {
                if (street.toLowerCase().includes(lowerQuery)) {
                    suggestions.push({
                        text: street,
                        type: 'street',
                        display: this.filterType === 'both' ? `${street} (רחוב)` : street
                    });
                }
            });
        }
        
        // Limit to 10 suggestions
        return suggestions.slice(0, 10);
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
            item.textContent = suggestion.display;
            item.dataset.text = suggestion.text;
            item.dataset.index = index;
            
            item.addEventListener('click', () => {
                this.selectSuggestion(suggestion.text);
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
window.AddressAutocomplete = AddressAutocomplete;
