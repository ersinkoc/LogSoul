// Web Interface Internationalization
class WebI18n {
    constructor() {
        this.currentLang = 'en';
        this.translations = {
            en: {
                title: 'LogSoul - Feel the pulse of your domains',
                nav: {
                    dashboard: 'Dashboard',
                    domains: 'Domains',
                    realtime: 'Real-time',
                    alerts: 'Alerts',
                    settings: 'Settings'
                },
                dashboard: {
                    title: '📊 Dashboard',
                    refresh: '🔄 Refresh',
                    domains: 'Domains',
                    requestsPerHour: 'Requests/hr',
                    avgHealth: 'Avg Health',
                    activeAlerts: 'Active Alerts',
                    domainOverview: 'Domain Overview'
                },
                domains: {
                    title: '🌐 Domains',
                    discover: '🔍 Discover',
                    addDomain: '➕ Add Domain',
                    health: 'Health',
                    requestsPerMin: 'Requests/min',
                    errorRate: 'Error Rate',
                    lastSeen: 'Last Seen',
                    actions: 'Actions',
                    details: '📊 Details'
                },
                realtime: {
                    title: '⚡ Real-time Logs',
                    selectDomain: 'Select Domain',
                    start: '▶️ Start',
                    stop: '⏸️ Stop',
                    clear: '🗑️ Clear',
                    connected: 'Connected',
                    disconnected: 'Disconnected'
                },
                alerts: {
                    title: '🚨 Alerts',
                    refresh: '🔄 Refresh',
                    noAlerts: 'No alerts found.'
                },
                settings: {
                    title: '⚙️ Settings',
                    monitorSettings: 'Monitor Settings',
                    scanInterval: 'Scan Interval (seconds):',
                    batchSize: 'Batch Size:',
                    alertSettings: 'Alert Settings',
                    enableEmail: 'Enable Email Alerts',
                    enableWebhook: 'Enable Webhook Alerts',
                    language: 'Language:'
                },
                modal: {
                    addDomain: {
                        title: 'Add Domain',
                        domainName: 'Domain Name:',
                        placeholder: 'example.com',
                        cancel: 'Cancel',
                        add: 'Add Domain'
                    }
                }
            },
            tr: {
                title: 'LogSoul - Alan adlarınızın nabzını hissedin',
                nav: {
                    dashboard: 'Panel',
                    domains: 'Alan Adları',
                    realtime: 'Canlı',
                    alerts: 'Uyarılar',
                    settings: 'Ayarlar'
                },
                dashboard: {
                    title: '📊 Panel',
                    refresh: '🔄 Yenile',
                    domains: 'Alan Adları',
                    requestsPerHour: 'İstek/saat',
                    avgHealth: 'Ort. Sağlık',
                    activeAlerts: 'Aktif Uyarılar',
                    domainOverview: 'Alan Adı Genel Bakış'
                },
                domains: {
                    title: '🌐 Alan Adları',
                    discover: '🔍 Keşfet',
                    addDomain: '➕ Alan Adı Ekle',
                    health: 'Sağlık',
                    requestsPerMin: 'İstek/dk',
                    errorRate: 'Hata Oranı',
                    lastSeen: 'Son Görülme',
                    actions: 'İşlemler',
                    details: '📊 Detaylar'
                },
                realtime: {
                    title: '⚡ Canlı Loglar',
                    selectDomain: 'Alan Adı Seç',
                    start: '▶️ Başlat',
                    stop: '⏸️ Durdur',
                    clear: '🗑️ Temizle',
                    connected: 'Bağlandı',
                    disconnected: 'Bağlantı Kesildi'
                },
                alerts: {
                    title: '🚨 Uyarılar',
                    refresh: '🔄 Yenile',
                    noAlerts: 'Uyarı bulunamadı.'
                },
                settings: {
                    title: '⚙️ Ayarlar',
                    monitorSettings: 'İzleme Ayarları',
                    scanInterval: 'Tarama Aralığı (saniye):',
                    batchSize: 'Toplu İşlem Boyutu:',
                    alertSettings: 'Uyarı Ayarları',
                    enableEmail: 'E-posta Uyarılarını Etkinleştir',
                    enableWebhook: 'Webhook Uyarılarını Etkinleştir',
                    language: 'Dil:'
                },
                modal: {
                    addDomain: {
                        title: 'Alan Adı Ekle',
                        domainName: 'Alan Adı:',
                        placeholder: 'ornek.com',
                        cancel: 'İptal',
                        add: 'Alan Adı Ekle'
                    }
                }
            }
        };
    }

    setLanguage(lang) {
        this.currentLang = lang;
        document.documentElement.lang = lang;
        this.updateInterface();
        this.syncSelectors(lang);
        localStorage.setItem('logsoul_language', lang);
    }

    getLanguage() {
        return this.currentLang;
    }

    t(key, ...args) {
        const keys = key.split('.');
        let value = this.translations[this.currentLang];

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Fallback to English
                value = this.translations.en;
                for (const fallbackKey of keys) {
                    if (value && typeof value === 'object' && fallbackKey in value) {
                        value = value[fallbackKey];
                    } else {
                        return key;
                    }
                }
                break;
            }
        }

        if (typeof value === 'string') {
            // Replace placeholders {0}, {1}, etc.
            return value.replace(/\{(\d+)\}/g, (match, index) => {
                const argIndex = parseInt(index);
                return args[argIndex] !== undefined ? String(args[argIndex]) : match;
            });
        }

        return key;
    }

    updateInterface() {
        // Update page title
        document.title = this.t('title');

        // Update navigation
        const navButtons = document.querySelectorAll('.nav-btn');
        const navKeys = ['dashboard', 'domains', 'realtime', 'alerts', 'settings'];
        navButtons.forEach((btn, index) => {
            if (navKeys[index]) {
                btn.textContent = this.t(`nav.${navKeys[index]}`);
            }
        });

        // Update section headers
        this.updateElement('#dashboard .section-header h2', this.t('dashboard.title'));
        this.updateElement('#domains .section-header h2', this.t('domains.title'));
        this.updateElement('#realtime .section-header h2', this.t('realtime.title'));
        this.updateElement('#alerts .section-header h2', this.t('alerts.title'));
        this.updateElement('#settings .section-header h2', this.t('settings.title'));

        // Update dashboard
        this.updateElement('#dashboard .section-header button', this.t('dashboard.refresh'));
        const statLabels = document.querySelectorAll('#dashboard .stat-label');
        const dashboardKeys = ['domains', 'requestsPerHour', 'avgHealth', 'activeAlerts'];
        statLabels.forEach((label, index) => {
            if (dashboardKeys[index]) {
                label.textContent = this.t(`dashboard.${dashboardKeys[index]}`);
            }
        });
        this.updateElement('#dashboard h3', this.t('dashboard.domainOverview'));

        // Update domains section
        this.updateElement('#domains .btn-secondary', this.t('domains.discover'));
        this.updateElement('#domains .btn-primary', this.t('domains.addDomain'));
        
        // Update table headers
        const tableHeaders = document.querySelectorAll('#domains th');
        const domainTableKeys = ['name', 'health', 'requestsPerMin', 'errorRate', 'lastSeen', 'actions'];
        tableHeaders.forEach((th, index) => {
            if (domainTableKeys[index] && index > 0) { // Skip first column (Domain name)
                th.textContent = this.t(`domains.${domainTableKeys[index]}`);
            } else if (index === 0) {
                th.textContent = this.t('domains.title').replace('🌐 ', '');
            }
        });

        // Update realtime section
        this.updateElement('#realtime-domain option[value=""]', this.t('realtime.selectDomain'));
        this.updateElement('#realtime-toggle', this.t('realtime.start'));
        this.updateElement('#realtime .btn-secondary', this.t('realtime.clear'));

        // Update alerts section
        this.updateElement('#alerts .btn-primary', this.t('alerts.refresh'));

        // Update settings section
        this.updateElement('.settings-group:first-child h3', this.t('settings.monitorSettings'));
        this.updateElement('.settings-group:last-child h3', this.t('settings.alertSettings'));
        
        const settingLabels = document.querySelectorAll('.setting-item label');
        if (settingLabels[0]) settingLabels[0].childNodes[0].textContent = this.t('settings.scanInterval');
        if (settingLabels[1]) settingLabels[1].childNodes[0].textContent = this.t('settings.batchSize');
        if (settingLabels[2]) settingLabels[2].childNodes[1].textContent = ' ' + this.t('settings.enableEmail');
        if (settingLabels[3]) settingLabels[3].childNodes[1].textContent = ' ' + this.t('settings.enableWebhook');

        // Update modal
        this.updateElement('#add-domain-dialog h3', this.t('modal.addDomain.title'));
        this.updateElement('#add-domain-dialog label[for="domain-name"]', this.t('modal.addDomain.domainName'));
        const domainInput = document.getElementById('domain-name');
        if (domainInput) {
            domainInput.placeholder = this.t('modal.addDomain.placeholder');
        }
        this.updateElement('#add-domain-dialog .btn-secondary', this.t('modal.addDomain.cancel'));
        this.updateElement('#add-domain-dialog .btn-primary', this.t('modal.addDomain.add'));
    }

    updateElement(selector, text) {
        const element = document.querySelector(selector);
        if (element) {
            element.textContent = text;
        }
    }

    syncSelectors(lang) {
        // Sync all language selectors
        const selectors = document.querySelectorAll('#language-select, #settings-language-select');
        selectors.forEach(select => {
            if (select && select.value !== lang) {
                select.value = lang;
            }
        });
    }

    init() {
        // Load saved language preference
        const savedLang = localStorage.getItem('logsoul_language');
        if (savedLang && (savedLang === 'en' || savedLang === 'tr')) {
            this.setLanguage(savedLang);
        }
    }
}

// Global instance
const webI18n = new WebI18n();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    webI18n.init();
});

// Global translation function
function t(key, ...args) {
    return webI18n.t(key, ...args);
}

// Global language switch function
function switchLanguage(lang) {
    webI18n.setLanguage(lang);
}