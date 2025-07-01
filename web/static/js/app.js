// LogSoul Frontend Application
class LogSoulApp {
    constructor() {
        this.currentSection = 'dashboard';
        this.websocket = null;
        this.realtimeActive = false;
        this.domains = [];
        this.init();
    }

    async init() {
        console.log('🔮 LogSoul initializing...');
        await this.loadDomains();
        await this.refreshDashboard();
        this.setupEventListeners();
        this.syncLanguageSelectors();
    }

    setupEventListeners() {
        // Modal close on outside click
        document.getElementById('add-domain-dialog').addEventListener('click', (e) => {
            if (e.target.id === 'add-domain-dialog') {
                this.hideAddDomainDialog();
            }
        });

        // Enter key in domain input
        document.getElementById('domain-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addDomain();
            }
        });
    }

    async loadDomains() {
        try {
            const response = await fetch('/api/domains');
            this.domains = await response.json();
            this.updateRealtimeDropdown();
        } catch (error) {
            console.error('Failed to load domains:', error);
            this.showNotification('Failed to load domains', 'error');
        }
    }

    updateRealtimeDropdown() {
        const select = document.getElementById('realtime-domain');
        select.innerHTML = `<option value="">${t('realtime.selectDomain')}</option>`;
        
        this.domains.forEach(domain => {
            const option = document.createElement('option');
            option.value = domain.name;
            option.textContent = domain.name;
            select.appendChild(option);
        });
    }

    async refreshDashboard() {
        try {
            await this.loadDomains();
            
            // Update stats
            document.getElementById('total-domains').textContent = this.domains.length;
            
            let totalRequests = 0;
            let totalHealth = 0;
            let activeAlerts = 0;

            for (const domain of this.domains) {
                if (domain.stats) {
                    totalRequests += domain.stats.requests_per_minute * 60; // Convert to hourly
                    totalHealth += domain.stats.health_score;
                }
            }

            document.getElementById('total-requests').textContent = Math.round(totalRequests);
            document.getElementById('avg-health').textContent = this.domains.length > 0 ? 
                Math.round(totalHealth / this.domains.length) : 100;
            
            // Load alerts count
            const alertsResponse = await fetch('/api/alerts?limit=100');
            const alerts = await alertsResponse.json();
            document.getElementById('active-alerts').textContent = 
                alerts.filter(a => !a.resolved_at).length;

            this.renderDomainsOverview();
            this.renderDomainsTable();
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
            this.showNotification('Failed to refresh dashboard', 'error');
        }
    }

    renderDomainsOverview() {
        const container = document.getElementById('domains-list');
        container.innerHTML = '';

        this.domains.slice(0, 6).forEach(domain => {
            const card = document.createElement('div');
            card.className = 'domain-card';
            card.onclick = () => this.showDomainDetails(domain.name);

            const healthClass = domain.stats?.health_score >= 80 ? 'health-excellent' :
                               domain.stats?.health_score >= 60 ? 'health-good' : 'health-poor';

            card.innerHTML = `
                <div class="domain-name">${domain.name}</div>
                <div class="domain-stats">
                    <div class="domain-stat">
                        <span>Health:</span>
                        <span class="health-score ${healthClass}">
                            ${domain.stats?.health_score || 100}/100
                        </span>
                    </div>
                    <div class="domain-stat">
                        <span>Requests/min:</span>
                        <span>${(domain.stats?.requests_per_minute || 0).toFixed(1)}</span>
                    </div>
                    <div class="domain-stat">
                        <span>Error Rate:</span>
                        <span>${(domain.stats?.error_rate || 0).toFixed(1)}%</span>
                    </div>
                    <div class="domain-stat">
                        <span>Last Seen:</span>
                        <span>${moment(domain.last_seen).fromNow()}</span>
                    </div>
                </div>
            `;

            container.appendChild(card);
        });
    }

    renderDomainsTable() {
        const tbody = document.getElementById('domains-table-body');
        tbody.innerHTML = '';

        this.domains.forEach(domain => {
            const row = document.createElement('tr');
            
            const healthClass = domain.stats?.health_score >= 80 ? 'health-excellent' :
                               domain.stats?.health_score >= 60 ? 'health-good' : 'health-poor';

            row.innerHTML = `
                <td>${domain.name}</td>
                <td>
                    <span class="health-score ${healthClass}">
                        ${domain.stats?.health_score || 100}/100
                    </span>
                </td>
                <td>${(domain.stats?.requests_per_minute || 0).toFixed(1)}</td>
                <td>${(domain.stats?.error_rate || 0).toFixed(1)}%</td>
                <td>${moment(domain.last_seen).fromNow()}</td>
                <td>
                    <button class="btn btn-secondary" onclick="showDomainDetails('${domain.name}')">
                        📊 Details
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    async scanForDomains() {
        try {
            this.showNotification('Scanning for domains...', 'info');
            
            const response = await fetch('/api/discovery/scan', { method: 'POST' });
            const result = await response.json();
            
            this.showNotification(
                `Found ${result.domains_found} domains and ${result.log_files_found} log files`,
                'success'
            );
            
            await this.refreshDashboard();
        } catch (error) {
            console.error('Failed to scan for domains:', error);
            this.showNotification('Failed to scan for domains', 'error');
        }
    }

    showAddDomainDialog() {
        document.getElementById('add-domain-dialog').classList.add('active');
        document.getElementById('domain-name').focus();
    }

    hideAddDomainDialog() {
        document.getElementById('add-domain-dialog').classList.remove('active');
        document.getElementById('domain-name').value = '';
    }

    async addDomain() {
        const domainName = document.getElementById('domain-name').value.trim();
        
        if (!domainName) {
            this.showNotification('Please enter a domain name', 'error');
            return;
        }

        try {
            const response = await fetch('/api/domains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: domainName })
            });

            if (response.ok) {
                this.showNotification(`Domain ${domainName} added successfully`, 'success');
                this.hideAddDomainDialog();
                await this.refreshDashboard();
            } else {
                throw new Error('Failed to add domain');
            }
        } catch (error) {
            console.error('Failed to add domain:', error);
            this.showNotification('Failed to add domain', 'error');
        }
    }

    async showDomainDetails(domainName) {
        try {
            const response = await fetch(`/api/domains/${domainName}`);
            const domain = await response.json();
            
            // For now, just show an alert with domain info
            alert(`Domain: ${domain.name}\nHealth: ${domain.stats?.health_score || 100}/100\nRequests/min: ${(domain.stats?.requests_per_minute || 0).toFixed(1)}\nError Rate: ${(domain.stats?.error_rate || 0).toFixed(1)}%`);
        } catch (error) {
            console.error('Failed to load domain details:', error);
            this.showNotification('Failed to load domain details', 'error');
        }
    }

    toggleRealtime() {
        const domain = document.getElementById('realtime-domain').value;
        
        if (!domain) {
            this.showNotification('Please select a domain first', 'error');
            return;
        }

        if (this.realtimeActive) {
            this.stopRealtime();
        } else {
            this.startRealtime(domain);
        }
    }

    startRealtime(domain) {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}?domain=${domain}`;
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                this.realtimeActive = true;
                this.updateRealtimeStatus(true);
                this.updateRealtimeButton();
                
                // Subscribe to domain logs
                this.websocket.send(JSON.stringify({
                    type: 'subscribe',
                    domain: domain
                }));
            };

            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'log-entry') {
                    this.displayLogEntry(data.data);
                }
            };

            this.websocket.onclose = () => {
                this.realtimeActive = false;
                this.updateRealtimeStatus(false);
                this.updateRealtimeButton();
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showNotification('Real-time connection failed', 'error');
            };
        } catch (error) {
            console.error('Failed to start real-time monitoring:', error);
            this.showNotification('Failed to start real-time monitoring', 'error');
        }
    }

    stopRealtime() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.realtimeActive = false;
        this.updateRealtimeStatus(false);
        this.updateRealtimeButton();
    }

    updateRealtimeStatus(connected) {
        const statusElement = document.getElementById('realtime-status');
        const indicator = statusElement.querySelector('.status-indicator');
        
        if (connected) {
            indicator.classList.add('connected');
            statusElement.innerHTML = '<span class="status-indicator connected"></span> Connected';
        } else {
            indicator.classList.remove('connected');
            statusElement.innerHTML = '<span class="status-indicator"></span> Disconnected';
        }
    }

    updateRealtimeButton() {
        const button = document.getElementById('realtime-toggle');
        
        if (this.realtimeActive) {
            button.textContent = '⏸️ Stop';
            button.classList.add('btn-secondary');
            button.classList.remove('btn-primary');
        } else {
            button.textContent = '▶️ Start';
            button.classList.add('btn-primary');
            button.classList.remove('btn-secondary');
        }
    }

    displayLogEntry(entry) {
        const container = document.getElementById('realtime-logs');
        const logDiv = document.createElement('div');
        logDiv.className = 'log-entry';

        const statusClass = entry.status >= 500 ? 'status-5xx' :
                           entry.status >= 400 ? 'status-4xx' :
                           entry.status >= 300 ? 'status-3xx' : 'status-2xx';

        logDiv.innerHTML = `
            <span class="log-timestamp">[${moment(entry.timestamp).format('HH:mm:ss')}]</span>
            <span class="log-status ${statusClass}">${entry.status}</span>
            <span class="log-method">${entry.method}</span>
            <span class="log-path">${entry.path}</span>
            <span class="log-ip">- ${entry.ip}</span>
        `;

        container.appendChild(logDiv);
        
        // Auto-scroll to bottom
        container.scrollTop = container.scrollHeight;
        
        // Keep only last 1000 entries
        const entries = container.querySelectorAll('.log-entry');
        if (entries.length > 1000) {
            entries[0].remove();
        }
    }

    switchRealtimeDomain() {
        if (this.realtimeActive) {
            this.stopRealtime();
        }
    }

    clearRealtimeLogs() {
        document.getElementById('realtime-logs').innerHTML = '';
    }

    async refreshAlerts() {
        try {
            const response = await fetch('/api/alerts');
            const alerts = await response.json();
            this.renderAlerts(alerts);
        } catch (error) {
            console.error('Failed to load alerts:', error);
            this.showNotification('Failed to load alerts', 'error');
        }
    }

    renderAlerts(alerts) {
        const container = document.getElementById('alerts-list');
        container.innerHTML = '';

        if (alerts.length === 0) {
            container.innerHTML = '<p>No alerts found.</p>';
            return;
        }

        alerts.forEach(alert => {
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert-item alert-${alert.severity}`;

            alertDiv.innerHTML = `
                <div class="alert-header">
                    <div>
                        <strong>${alert.type}</strong>
                        <span class="alert-severity alert-${alert.severity}">${alert.severity}</span>
                    </div>
                    <div class="alert-time">${moment(alert.created_at).fromNow()}</div>
                </div>
                <div class="alert-message">${alert.message}</div>
            `;

            container.appendChild(alertDiv);
        });
    }

    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            transition: all 0.3s ease;
        `;

        switch (type) {
            case 'success':
                notification.style.background = 'var(--success-color)';
                break;
            case 'error':
                notification.style.background = 'var(--error-color)';
                break;
            case 'warning':
                notification.style.background = 'var(--warning-color)';
                break;
            default:
                notification.style.background = 'var(--primary-color)';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    syncLanguageSelectors() {
        const currentLang = webI18n.getLanguage();
        
        // Sync header language selector
        const headerSelect = document.getElementById('language-select');
        if (headerSelect) {
            headerSelect.value = currentLang;
        }
        
        // Sync settings language selector
        const settingsSelect = document.getElementById('settings-language-select');
        if (settingsSelect) {
            settingsSelect.value = currentLang;
        }
    }
}

// Global functions for HTML onclick handlers
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionName).classList.add('active');

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Load section-specific data
    switch (sectionName) {
        case 'dashboard':
            app.refreshDashboard();
            break;
        case 'alerts':
            app.refreshAlerts();
            break;
    }
}

function refreshDashboard() {
    app.refreshDashboard();
}

function scanForDomains() {
    app.scanForDomains();
}

function showAddDomainDialog() {
    app.showAddDomainDialog();
}

function hideAddDomainDialog() {
    app.hideAddDomainDialog();
}

function addDomain() {
    app.addDomain();
}

function showDomainDetails(domainName) {
    app.showDomainDetails(domainName);
}

function toggleRealtime() {
    app.toggleRealtime();
}

function switchRealtimeDomain() {
    app.switchRealtimeDomain();
}

function clearRealtimeLogs() {
    app.clearRealtimeLogs();
}

function refreshAlerts() {
    app.refreshAlerts();
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new LogSoulApp();
});