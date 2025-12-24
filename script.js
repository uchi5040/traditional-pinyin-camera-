/**
 * 繁体字ピンインカメラ
 * logic.js
 */

const APP = {
    apiKey: '',
    
    // UI Elements
    elements: {
        views: {
            initial: document.getElementById('initial-view'),
            loading: document.getElementById('loading-view'),
            result: document.getElementById('result-view'),
        },
        buttons: {
            settings: document.getElementById('settings-btn'),
            closeResult: document.getElementById('close-result-btn'),
            closeSettings: document.getElementById('close-settings-btn'),
            saveSettings: document.getElementById('save-settings-btn'),
            toggleVisibility: document.getElementById('toggle-visibility-btn'),
        },
        inputs: {
            camera: document.getElementById('camera-input'),
            apiKey: document.getElementById('api-key-input'),
        },
        modals: {
            settings: document.getElementById('settings-modal'),
        },
        containers: {
            result: document.getElementById('result-container'),
        },
        feedback: {
            saveStatus: document.getElementById('save-status'),
            toast: document.getElementById('toast'),
        }
    },

    init() {
        this.loadSettings();
        this.attachListeners();
        this.registerServiceWorker();
    },

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(() => console.log('Service Worker registered'))
                .catch(err => console.error('Service Worker registration failed:', err));
        }
    },

    loadSettings() {
        const storedKey = localStorage.getItem('gcv_api_key');
        if (storedKey) {
            this.apiKey = storedKey;
            this.elements.inputs.apiKey.value = storedKey;
        }
    },

    attachListeners() {
        // Camera Input
        this.elements.inputs.camera.addEventListener('change', (e) => this.handleImageCapture(e));

        // Settings Modal
        this.elements.buttons.settings.addEventListener('click', () => this.toggleModal('settings', true));
        this.elements.buttons.closeSettings.addEventListener('click', () => this.toggleModal('settings', false));
        this.elements.buttons.saveSettings.addEventListener('click', () => this.saveSettings());
        this.elements.buttons.toggleVisibility.addEventListener('click', () => this.toggleApiKeyVisibility());

        // Result View
        this.elements.buttons.closeResult.addEventListener('click', () => this.showView('initial'));
    },

    toggleModal(modalName, show) {
        const modal = this.elements.modals[modalName];
        if (show) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    },

    toggleApiKeyVisibility() {
        const input = this.elements.inputs.apiKey;
        const icon = this.elements.buttons.toggleVisibility.querySelector('span');
        if (input.type === 'password') {
            input.type = 'text';
            icon.textContent = 'visibility_off';
        } else {
            input.type = 'password';
            icon.textContent = 'visibility';
        }
    },

    saveSettings() {
        const key = this.elements.inputs.apiKey.value.trim();
        if (key) {
            this.apiKey = key;
            localStorage.setItem('gcv_api_key', key);
            this.showStatus('保存しました', 'success');
            setTimeout(() => this.toggleModal('settings', false), 1000);
        } else {
            this.showStatus('APIキーを入力してください', 'error');
        }
    },

    showStatus(msg, type) {
        const el = this.elements.feedback.saveStatus;
        el.textContent = msg;
        el.className = `status-msg ${type}`;
    },

    showToast(msg) {
        const toast = this.elements.feedback.toast;
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    },

    showView(viewName) {
        Object.values(this.elements.views).forEach(el => el.classList.add('hidden'));
        this.elements.views[viewName].classList.remove('hidden');
    },

    async handleImageCapture(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!this.apiKey) {
            this.showToast('設定からAPIキーを入力してください');
            this.toggleModal('settings', true);
            return;
        }

        this.showView('loading');

        try {
            const base64Image = await this.fileToBase64(file);
            const text = await this.performOCR(base64Image);
            
            if (text) {
                this.processAndDisplayResults(text);
                this.showView('result');
            } else {
                this.showToast('文字が認識できませんでした');
                this.showView('initial');
            }

        } catch (error) {
            console.error(error);
            this.showToast('エラーが発生しました: ' + error.message);
            this.showView('initial');
        } finally {
            // Reset input so same file can be selected again
            this.elements.inputs.camera.value = '';
        }
    },

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Remove data URL prefix (e.g. "data:image/jpeg;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    },

    async performOCR(base64Image) {
        const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`;
        const requestBody = {
            requests: [
                {
                    image: { content: base64Image },
                    features: [{ type: 'TEXT_DETECTION' }],
                    imageContext: { languageHints: ['zh-Hant'] } // Hint for Traditional Chinese
                }
            ]
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'API request failed');
        }

        const data = await response.json();
        const detections = data.responses[0]?.textAnnotations;
        
        if (detections && detections.length > 0) {
            // The first annotation is the full text
            return detections[0].description;
        }
        return null;
    },

    processAndDisplayResults(text) {
        const container = this.elements.containers.result;
        container.innerHTML = '';

        // Clean text: remove extra newlines, keep basic structure but focus on meaningful blocks
        // For simplicity, we split by newlines or punctuations to create cards
        // or just display it line by line.
        // Let's split by newlines for structure.
        const lines = text.split('\n').filter(line => line.trim() !== '');

        lines.forEach(line => {
            // Use pinyin-pro to convert
            // pinyin(text, options?)
            const pinyinText = pinyinPro.pinyin(line, { toneType: 'symbol' }); // "nǐ hǎo"
            
            const card = document.createElement('div');
            card.className = 'word-card';
            
            const pinyinEl = document.createElement('div');
            pinyinEl.className = 'word-pinyin';
            pinyinEl.textContent = pinyinText;
            
            const textEl = document.createElement('div');
            textEl.className = 'word-main';
            textEl.textContent = line;

            card.appendChild(pinyinEl);
            card.appendChild(textEl);
            container.appendChild(card);
        });
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    APP.init();
});
