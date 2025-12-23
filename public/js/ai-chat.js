// AI Chat Manager - Grok Integration

class AIChatManager {
    constructor() {
        this.isOpen = false;
        this.chatContext = [];
        this.isLoading = false;
        this.pendingCallData = null;
        
        this.init();
    }
    
    init() {
        this.createChatUI();
        this.bindEvents();
    }
    
    createChatUI() {
        const chatHTML = `
            <!-- AI Chat Toggle Button -->
            <button id="aiChatToggle" class="ai-chat-toggle" title="צ'אט עם AI">
                <span class="ai-icon">🤖</span>
            </button>
            
            <!-- AI Chat Panel -->
            <div id="aiChatPanel" class="ai-chat-panel hidden">
                <div class="ai-chat-header">
                    <div class="ai-chat-title">
                        <span class="ai-icon">🤖</span>
                        <span>Josh (ג'וש) - עוזר מד"א</span>
                    </div>
                    <button id="aiChatClose" class="ai-chat-close">✕</button>
                </div>
                
                <div id="aiChatMessages" class="ai-chat-messages">
                    <div class="ai-message ai-message-assistant">
                        <div class="ai-message-content">
                            <strong>🤖 Josh:</strong>
                            <p>שלום! אני Josh (ג'וש), העוזר החכם של מד"א. אני יכול לעזור לך עם:</p>
                            <ul>
                                <li>📊 סטטיסטיקות על הנסיעות שלך (יום/שבוע/חודש/שנה)</li>
                                <li>➕ רישום קריאה חדשה - אספק את הפרטים:</li>
                                <ul style="margin-top: 8px;">
                                    <li>תאריך</li>
                                    <li>דחיפות (דחוף/אטן/ארן/נתבג)</li>
                                    <li>מונה</li>
                                    <li>כתובת (עיר ורחוב)</li>
                                    <li>קוד הזנקה</li>
                                    <li>קוד רפואי</li>
                                    <li>יציאה (שעת התחלה)</li>
                                    <li>במקום (שעת הגעה)</li>
                                    <li>סיום (שעת סיום)</li>
                                </ul>
                                <li>📸 רישום קריאה מתמונה - פשוט תשלח תמונה!</li>
                            </ul>
                            <p>במה אוכל לעזור?</p>
                        </div>
                    </div>
                </div>
                
                <div class="ai-chat-input-area">
                    <!-- Preview for uploaded image -->
                    <div id="aiImagePreview" class="ai-image-preview hidden">
                        <img id="aiPreviewImage" src="" alt="תצוגה מקדימה">
                        <button id="aiRemoveImage" class="ai-remove-image">✕</button>
                    </div>
                    
                    <!-- Quick action buttons -->
                    <div class="ai-quick-actions">
                        <button class="ai-quick-btn" data-action="newcall">➕ קריאה חדשה</button>
                        <button class="ai-quick-btn" data-action="today">📊 היום</button>
                        <button class="ai-quick-btn" data-action="month">📅 החודש</button>
                    </div>
                    
                    <div class="ai-input-wrapper">
                        <input type="file" id="aiImageInput" accept="image/*" class="ai-file-input hidden">
                        <button id="aiUploadBtn" class="ai-upload-btn" title="העלה תמונה">📷</button>
                        <input type="text" id="aiChatInput" class="ai-chat-input" placeholder="שאל אותי משהו...">
                        <button id="aiSendBtn" class="ai-send-btn">
                            <span class="ai-send-icon">➤</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', chatHTML);
    }
    
    bindEvents() {
        // Toggle chat
        document.getElementById('aiChatToggle').addEventListener('click', () => {
            this.toggleChat();
        });
        
        document.getElementById('aiChatClose').addEventListener('click', () => {
            this.toggleChat();
        });
        
        // Send message
        document.getElementById('aiSendBtn').addEventListener('click', () => {
            this.sendMessage();
        });
        
        document.getElementById('aiChatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        // Image upload
        document.getElementById('aiUploadBtn').addEventListener('click', () => {
            document.getElementById('aiImageInput').click();
        });
        
        document.getElementById('aiImageInput').addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });
        
        document.getElementById('aiRemoveImage').addEventListener('click', () => {
            this.clearImage();
        });
        
        // Quick actions
        document.querySelectorAll('.ai-quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleQuickAction(action);
            });
        });
    }
    
    toggleChat() {
        this.isOpen = !this.isOpen;
        const panel = document.getElementById('aiChatPanel');
        
        if (this.isOpen) {
            panel.classList.remove('hidden');
            document.getElementById('aiChatInput').focus();
        } else {
            panel.classList.add('hidden');
        }
    }
    
    handleQuickAction(action) {
        const messages = {
            'newcall': 'אני רוצה לרשום קריאה חדשה',
            'today': 'כמה נסיעות עשיתי היום?',
            'month': 'תן לי סיכום של החודש'
        };
        
        const input = document.getElementById('aiChatInput');
        input.value = messages[action];
        this.sendMessage();
    }
    
    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('נא להעלות קובץ תמונה בלבד');
            return;
        }
        
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('גודל התמונה חייב להיות פחות מ-10MB');
            return;
        }
        
        try {
            const base64 = await this.fileToBase64(file);
            const preview = document.getElementById('aiImagePreview');
            const previewImage = document.getElementById('aiPreviewImage');
            
            previewImage.src = base64;
            preview.classList.remove('hidden');
            
            // Show processing message
            this.addMessage('מעבד את התמונה...', 'assistant');
            
            // Process image with OCR (client-side only - secure!)
            await this.processImageWithOCR(base64);
            
        } catch (error) {
            console.error('Error reading image:', error);
            this.showError('שגיאה בקריאת התמונה');
        }
    }
    
    async processImageWithOCR(base64Image) {
        try {
            this.addMessage('🔍 סורק את התמונה...', 'assistant');
            
            // Use Tesseract.js for client-side OCR (image never leaves browser!)
            const { data: { text } } = await Tesseract.recognize(
                base64Image,
                'heb+eng', // Hebrew and English
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                        }
                    }
                }
            );
            
            console.log('Extracted text:', text);
            this.addMessage('✅ טקסט חולץ מהתמונה', 'assistant');
            
            // Parse extracted text to find call data
            const callData = this.parseCallDataFromText(text);
            
            if (callData && Object.keys(callData).length > 0) {
                // Show what was found
                const foundFields = Object.entries(callData)
                    .filter(([_, value]) => value)
                    .map(([key, value]) => `${this.getFieldLabel(key)}: ${value}`)
                    .join('\n');
                
                this.addMessage(`מצאתי את הפרטים הבאים:\n\n${foundFields}\n\nהאם לרשום את הקריאה עם הפרטים האלה?`, 'assistant');
                this.showCallConfirmation(callData, 'נתונים שחולצו מהתמונה');
            } else {
                this.addMessage('לא הצלחתי למצוא מספיק פרטים בתמונה. תוכל לספק אותם ידנית?', 'assistant');
            }
            
            this.clearImage();
            
        } catch (error) {
            console.error('OCR Error:', error);
            this.addMessage('שגיאה בעיבוד התמונה. נסה שוב או הזן את הפרטים ידנית.', 'assistant');
            this.clearImage();
        }
    }
    
    parseCallDataFromText(text) {
        const callData = {};
        const lines = text.split('\n').map(line => line.trim());
        
        // Patterns to extract data (customize based on your screenshot format)
        const patterns = {
            date: /תאריך[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
            urgency: /דחיפות[:\s]*(דחוף|אטן|ארן|נתבג|אט"ן)/,
            meter: /מונה[:\s]*(\d+)/,
            city: /עיר[:\s]*([א-ת\s]+)/,
            street: /רחוב[:\s]*([א-ת\s\d]+)/,
            alertCode: /קוד הזנקה[:\s]*(\d+)/,
            medicalCode: /קוד רפואי[:\s]*(\d+)/,
            startTime: /יציאה[:\s]*(\d{1,2}:\d{2})/,
            arrivalTime: /במקום[:\s]*(\d{1,2}:\d{2})/,
            endTime: /סיום[:\s]*(\d{1,2}:\d{2})/
        };
        
        const fullText = text;
        
        // Extract date
        const dateMatch = fullText.match(patterns.date);
        if (dateMatch) callData.call_date = this.parseDate(dateMatch[1]);
        
        // Extract urgency
        const urgencyMatch = fullText.match(patterns.urgency);
        if (urgencyMatch) callData.call_type = urgencyMatch[1];
        
        // Extract meter number
        const meterMatch = fullText.match(patterns.meter);
        if (meterMatch) callData.meter_visa_number = meterMatch[1];
        
        // Extract city
        const cityMatch = fullText.match(patterns.city);
        if (cityMatch) callData.city = cityMatch[1].trim();
        
        // Extract street
        const streetMatch = fullText.match(patterns.street);
        if (streetMatch) callData.street = streetMatch[1].trim();
        
        // Extract codes
        const alertMatch = fullText.match(patterns.alertCode);
        if (alertMatch) callData.alert_code_id = alertMatch[1];
        
        const medicalMatch = fullText.match(patterns.medicalCode);
        if (medicalMatch) callData.medical_code_id = medicalMatch[1];
        
        // Extract times
        const startMatch = fullText.match(patterns.startTime);
        if (startMatch) callData.start_time = startMatch[1];
        
        const arrivalMatch = fullText.match(patterns.arrivalTime);
        if (arrivalMatch) callData.arrival_time = arrivalMatch[1];
        
        const endMatch = fullText.match(patterns.endTime);
        if (endMatch) callData.end_time = endMatch[1];
        
        return callData;
    }
    
    parseDate(dateStr) {
        // Convert DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD
        const parts = dateStr.split(/[-\/]/);
        if (parts.length === 3) {
            let [day, month, year] = parts;
            if (year.length === 2) year = '20' + year;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return dateStr;
    }
    
    getFieldLabel(fieldName) {
        const labels = {
            call_date: 'תאריך',
            call_type: 'דחיפות',
            meter_visa_number: 'מונה',
            city: 'עיר',
            street: 'רחוב',
            alert_code_id: 'קוד הזנקה',
            medical_code_id: 'קוד רפואי',
            start_time: 'יציאה',
            arrival_time: 'במקום',
            end_time: 'סיום'
        };
        return labels[fieldName] || fieldName;
    }
    
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    clearImage() {
        this.currentImage = null;
        document.getElementById('aiImagePreview').classList.add('hidden');
        document.getElementById('aiImageInput').value = '';
    }
    
    async sendMessage() {
        const input = document.getElementById('aiChatInput');
        const message = input.value.trim();
        
        if (!message && !this.currentImage) return;
        
        if (this.isLoading) return;
        
        // Add user message to chat
        if (message) {
            this.addMessage(message, 'user');
        }
        
        if (this.currentImage) {
            this.addMessage('📷 תמונה צורפה', 'user');
        }
        
        input.value = '';
        this.isLoading = true;
        this.showTypingIndicator();
        
        try {
            const response = await this.callAIAPI(message, this.currentImage);
            
            this.hideTypingIndicator();
            
            if (response.type === 'call_extracted') {
                // AI extracted call data from image
                this.pendingCallData = response.data;
                this.showCallConfirmation(response.data, response.message);
            } else {
                // Regular chat response
                this.addMessage(response.message, 'assistant');
                
                // Update context for next message
                if (response.context) {
                    this.chatContext = response.context;
                }
                
                // Show additional data if present
                if (response.data) {
                    this.showStatsData(response.data);
                }
            }
            
            this.clearImage();
            
        } catch (error) {
            this.hideTypingIndicator();
            this.showError('שגיאה בתקשורת עם Grok: ' + error.message);
        } finally {
            this.isLoading = false;
        }
    }
    
    async callAIAPI(message, image) {
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                image,
                context: this.chatContext
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'שגיאה בשרת');
        }
        
        return await response.json();
    }
    
    addMessage(content, role) {
        const messagesContainer = document.getElementById('aiChatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ai-message-${role}`;
        
        const icon = role === 'user' ? '👤' : '🤖';
        const name = role === 'user' ? 'אתה' : 'Josh';
        
        messageDiv.innerHTML = `
            <div class="ai-message-content">
                <strong>${icon} ${name}:</strong>
                <p>${this.formatMessage(content)}</p>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    formatMessage(text) {
        // Convert line breaks to <br>
        return text.replace(/\n/g, '<br>');
    }
    
    showTypingIndicator() {
        const messagesContainer = document.getElementById('aiChatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.id = 'aiTypingIndicator';
        typingDiv.className = 'ai-message ai-message-assistant';
        typingDiv.innerHTML = `
            <div class="ai-message-content">
                <strong>🤖 Josh:</strong>
                <p class="ai-typing">
                    <span></span>
                    <span></span>
                    <span></span>
                </p>
            </div>
        `;
        
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    hideTypingIndicator() {
        const indicator = document.getElementById('aiTypingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    showCallConfirmation(callData, message) {
        const messagesContainer = document.getElementById('aiChatMessages');
        const confirmDiv = document.createElement('div');
        confirmDiv.className = 'ai-message ai-message-assistant';
        
        // Format times for display
        const arrivalTimeDisplay = callData.arrival_time ? `<li><strong>במקום:</strong> ${callData.arrival_time}</li>` : '';
        const endTimeDisplay = callData.end_time ? `<li><strong>סיום:</strong> ${callData.end_time}</li>` : '';
        const alertCodeDisplay = callData.alert_code_id ? `<li><strong>קוד הזנקה:</strong> ${callData.alert_code_id}</li>` : '';
        const medicalCodeDisplay = callData.medical_code_id ? `<li><strong>קוד רפואי:</strong> ${callData.medical_code_id}</li>` : '';
        
        confirmDiv.innerHTML = `
            <div class="ai-message-content">
                <strong>🤖 Josh:</strong>
                <p>${message}</p>
                <div class="ai-call-preview">
                    <h4>📋 פרטי הקריאה לאישור:</h4>
                    <ul>
                        <li><strong>תאריך:</strong> ${callData.call_date || 'לא צוין'}</li>
                        <li><strong>דחיפות:</strong> ${callData.call_type || 'לא צוין'}</li>
                        <li><strong>מונה:</strong> ${callData.meter_visa_number || 'לא צוין'}</li>
                        <li><strong>כתובת:</strong> ${callData.location || (callData.city && callData.street ? callData.city + ', ' + callData.street : 'לא צוין')}</li>
                        ${alertCodeDisplay}
                        ${medicalCodeDisplay}
                        <li><strong>יציאה:</strong> ${callData.start_time || 'לא צוין'}</li>
                        ${arrivalTimeDisplay}
                        ${endTimeDisplay}
                    </ul>
                    <div class="ai-call-actions">
                        <button class="ai-btn ai-btn-primary" onclick="window.aiChat.confirmCall()">✓ אשר ורשום</button>
                        <button class="ai-btn ai-btn-secondary" onclick="window.aiChat.cancelCall()">✕ ביטול</button>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(confirmDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    async confirmCall() {
        if (!this.pendingCallData) return;
        
        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            
            const response = await fetch('/api/ai/create-call', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.pendingCallData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.addMessage('✅ הקריאה נרשמה בהצלחה!', 'assistant');
                this.pendingCallData = null;
                
                // Refresh the main page data
                if (window.callCounter) {
                    window.callCounter.loadStats();
                    window.callCounter.loadCalls();
                }
            } else {
                throw new Error(result.message);
            }
            
        } catch (error) {
            this.showError('שגיאה ברישום הקריאה: ' + error.message);
        }
    }
    
    cancelCall() {
        this.pendingCallData = null;
        this.addMessage('הקריאה בוטלה', 'assistant');
    }
    
    showStatsData(data) {
        const messagesContainer = document.getElementById('aiChatMessages');
        const statsDiv = document.createElement('div');
        statsDiv.className = 'ai-message ai-message-assistant';
        
        const callTypesHTML = Object.entries(data.callTypes)
            .map(([type, count]) => `<li>${type}: ${count}</li>`)
            .join('');
        
        statsDiv.innerHTML = `
            <div class="ai-message-content">
                <div class="ai-stats-box">
                    <h4>📊 סטטיסטיקות - ${this.getPeriodName(data.period)}</h4>
                    <ul>
                        <li><strong>סה"כ קריאות:</strong> ${data.totalCalls}</li>
                        <li><strong>סה"כ זמן:</strong> ${data.totalHours} שעות ו-${data.totalMinutes} דקות</li>
                        ${callTypesHTML ? '<li><strong>פילוח לפי סוג:</strong><ul>' + callTypesHTML + '</ul></li>' : ''}
                    </ul>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(statsDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    getPeriodName(period) {
        const names = {
            'day': 'היום',
            'week': 'השבוע',
            'month': 'החודש',
            'year': 'השנה'
        };
        return names[period] || period;
    }
    
    showError(message) {
        this.addMessage('❌ ' + message, 'assistant');
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.aiChat = new AIChatManager();
});
