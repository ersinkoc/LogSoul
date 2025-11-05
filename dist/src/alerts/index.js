"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertManager = void 0;
const events_1 = require("events");
class AlertManager extends events_1.EventEmitter {
    constructor(storage, analyzer, config) {
        super();
        this.rules = new Map();
        this.channels = [];
        this.storage = storage;
        this.analyzer = analyzer;
        this.config = config;
        this.initializeDefaultRules();
        this.initializeChannels();
    }
    initializeDefaultRules() {
        // High Error Rate Rule
        this.addRule({
            id: 'high_error_rate',
            name: 'High Error Rate',
            type: 'error_rate',
            condition: {
                threshold: 5,
                timeWindow: '5m',
                operator: '>',
                metric: 'error_rate_percent'
            },
            enabled: true,
            severity: 'high',
            cooldown: 15
        });
        // Slow Response Time Rule
        this.addRule({
            id: 'slow_response',
            name: 'Slow Response Time',
            type: 'response_time',
            condition: {
                threshold: 3000,
                timeWindow: '5m',
                operator: '>',
                metric: 'avg_response_time_ms'
            },
            enabled: true,
            severity: 'medium',
            cooldown: 10
        });
        // Traffic Spike Rule
        this.addRule({
            id: 'traffic_spike',
            name: 'Traffic Spike',
            type: 'traffic_spike',
            condition: {
                threshold: 300,
                timeWindow: '5m',
                operator: '>',
                metric: 'requests_per_minute'
            },
            enabled: true,
            severity: 'medium',
            cooldown: 30
        });
        // Critical Error Rate Rule
        this.addRule({
            id: 'critical_errors',
            name: 'Critical Error Rate',
            type: 'error_rate',
            condition: {
                threshold: 20,
                timeWindow: '5m',
                operator: '>',
                metric: 'error_rate_percent'
            },
            enabled: true,
            severity: 'critical',
            cooldown: 5
        });
        // Security Threat Rule
        this.addRule({
            id: 'security_attacks',
            name: 'Security Attacks Detected',
            type: 'security_threat',
            condition: {
                threshold: 10,
                timeWindow: '5m',
                operator: '>',
                metric: 'security_events'
            },
            enabled: true,
            severity: 'high',
            cooldown: 20
        });
    }
    initializeChannels() {
        // Console notification (always enabled)
        this.channels.push({
            type: 'console',
            config: {},
            enabled: true
        });
        // Email notification
        if (this.config.alerts.email.enabled) {
            this.channels.push({
                type: 'email',
                config: {
                    smtp_server: this.config.alerts.email.smtp_server
                },
                enabled: true
            });
        }
        // Webhook notification
        if (this.config.alerts.webhook.enabled) {
            this.channels.push({
                type: 'webhook',
                config: {
                    url: this.config.alerts.webhook.url
                },
                enabled: true
            });
        }
    }
    addRule(rule) {
        this.rules.set(rule.id, rule);
        console.log(`📋 Added alert rule: ${rule.name}`);
    }
    removeRule(ruleId) {
        this.rules.delete(ruleId);
        console.log(`🗑️  Removed alert rule: ${ruleId}`);
    }
    enableRule(ruleId) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            rule.enabled = true;
            console.log(`✅ Enabled alert rule: ${rule.name}`);
        }
    }
    disableRule(ruleId) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            rule.enabled = false;
            console.log(`❌ Disabled alert rule: ${rule.name}`);
        }
    }
    start() {
        if (this.checkInterval) {
            console.warn('Alert manager is already running');
            return;
        }
        console.log('🚨 Starting alert manager...');
        // Check alerts every minute
        this.checkInterval = setInterval(() => {
            this.checkAlerts().catch(error => {
                console.error('Error checking alerts:', error);
            });
        }, 60000);
        console.log('✅ Alert manager started');
    }
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = undefined;
            console.log('⏹️  Alert manager stopped');
        }
    }
    async checkAlerts() {
        const domains = await this.storage.getDomains();
        for (const domain of domains) {
            await this.checkDomainAlerts(domain.name);
        }
    }
    async checkDomainAlerts(domainName) {
        try {
            for (const [ruleId, rule] of this.rules) {
                if (!rule.enabled)
                    continue;
                if (rule.domain && rule.domain !== domainName)
                    continue;
                if (this.isInCooldown(rule))
                    continue;
                const shouldAlert = await this.evaluateRule(domainName, rule);
                if (shouldAlert) {
                    await this.triggerAlert(domainName, rule);
                }
            }
        }
        catch (error) {
            console.error(`Error checking alerts for ${domainName}:`, error);
        }
    }
    isInCooldown(rule) {
        if (!rule.lastTriggered)
            return false;
        const cooldownMs = rule.cooldown * 60 * 1000;
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        return timeSinceLastTrigger < cooldownMs;
    }
    async evaluateRule(domainName, rule) {
        const timeWindow = this.parseTimeWindow(rule.condition.timeWindow);
        try {
            switch (rule.type) {
                case 'error_rate':
                    return await this.checkErrorRate(domainName, rule, timeWindow);
                case 'response_time':
                    return await this.checkResponseTime(domainName, rule, timeWindow);
                case 'traffic_spike':
                    return await this.checkTrafficSpike(domainName, rule, timeWindow);
                case 'security_threat':
                    return await this.checkSecurityThreats(domainName, rule, timeWindow);
                default:
                    return false;
            }
        }
        catch (error) {
            console.error(`Error evaluating rule ${rule.id}:`, error);
            return false;
        }
    }
    parseTimeWindow(timeWindow) {
        const match = timeWindow.match(/^(\d+)([mhd])$/);
        if (!match)
            return '5m';
        const [, amount, unit] = match;
        const numAmount = parseInt(amount);
        switch (unit) {
            case 'm': return `${numAmount}m`;
            case 'h': return `${numAmount * 60}m`;
            case 'd': return `${numAmount * 24 * 60}m`;
            default: return '5m';
        }
    }
    async checkErrorRate(domainName, rule, timeWindow) {
        const domain = await this.storage.getDomain(domainName);
        if (!domain)
            return false;
        const stats = await this.storage.getDomainStats(domain.id, timeWindow);
        if (!stats)
            return false;
        const errorRate = stats.error_rate;
        return this.compareValues(errorRate, rule.condition.threshold, rule.condition.operator);
    }
    async checkResponseTime(domainName, rule, timeWindow) {
        const domain = await this.storage.getDomain(domainName);
        if (!domain)
            return false;
        const stats = await this.storage.getDomainStats(domain.id, timeWindow);
        if (!stats)
            return false;
        const avgResponseTime = stats.avg_response_time;
        return this.compareValues(avgResponseTime, rule.condition.threshold, rule.condition.operator);
    }
    async checkTrafficSpike(domainName, rule, timeWindow) {
        const domain = await this.storage.getDomain(domainName);
        if (!domain)
            return false;
        const stats = await this.storage.getDomainStats(domain.id, timeWindow);
        if (!stats)
            return false;
        const requestsPerMinute = stats.requests_per_minute;
        return this.compareValues(requestsPerMinute, rule.condition.threshold, rule.condition.operator);
    }
    async checkSecurityThreats(domainName, rule, timeWindow) {
        const analysis = await this.analyzer.analyzeDomain(domainName, timeWindow);
        const threatCount = analysis.securityThreats.length;
        return this.compareValues(threatCount, rule.condition.threshold, rule.condition.operator);
    }
    compareValues(value, threshold, operator) {
        switch (operator) {
            case '>': return value > threshold;
            case '<': return value < threshold;
            case '>=': return value >= threshold;
            case '<=': return value <= threshold;
            case '=': return value === threshold;
            default: return false;
        }
    }
    async triggerAlert(domainName, rule) {
        const domain = await this.storage.getDomain(domainName);
        if (!domain)
            return;
        const message = `Alert: ${rule.name} triggered for ${domainName}`;
        // Store alert in database
        await this.storage.addAlert(domain.id, rule.type, message, rule.severity);
        // Update rule last triggered time
        rule.lastTriggered = new Date();
        // Send notifications
        await this.sendNotifications({
            id: 0,
            domain_id: domain.id,
            type: rule.type,
            message,
            severity: rule.severity,
            created_at: new Date()
        });
        console.log(`🚨 Alert triggered: ${message}`);
        this.emit('alert', { domain: domainName, rule, message });
    }
    async sendNotifications(alert) {
        for (const channel of this.channels) {
            if (!channel.enabled)
                continue;
            try {
                await this.sendNotification(channel, alert);
            }
            catch (error) {
                console.error(`Failed to send notification via ${channel.type}:`, error);
            }
        }
    }
    async sendNotification(channel, alert) {
        switch (channel.type) {
            case 'console':
                this.sendConsoleNotification(alert);
                break;
            case 'email':
                await this.sendEmailNotification(channel.config, alert);
                break;
            case 'webhook':
                await this.sendWebhookNotification(channel.config, alert);
                break;
        }
    }
    sendConsoleNotification(alert) {
        const severityIcon = {
            low: '🟡',
            medium: '🟠',
            high: '🔴',
            critical: '🚨'
        }[alert.severity];
        console.log(`${severityIcon} [${alert.severity.toUpperCase()}] ${alert.message}`);
    }
    async sendEmailNotification(config, alert) {
        // Email implementation would go here
        // For now, just log that we would send an email
        console.log(`📧 Would send email alert: ${alert.message}`);
    }
    async sendWebhookNotification(config, alert) {
        // Webhook implementation would go here
        // For now, just log that we would send a webhook
        console.log(`🔗 Would send webhook alert to ${config.url}: ${alert.message}`);
    }
    async processLogEntry(entry) {
        // Real-time alert processing for individual log entries
        // Check for immediate threats that don't require time windows
        if (entry.status >= 500) {
            // Check if this is part of a pattern
            await this.checkImmediateAlerts(entry);
        }
    }
    async checkImmediateAlerts(entry) {
        // Check for patterns that should trigger immediate alerts
        const domain = await this.storage.getDomainById(entry.domain_id);
        if (!domain)
            return;
        // Example: Multiple 500 errors in quick succession
        const recentErrors = await this.storage.getLogsByTimeRange(entry.domain_id, new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        new Date());
        const recent500s = recentErrors.filter(log => log.status >= 500).length;
        if (recent500s > 10) {
            await this.storage.addAlert(entry.domain_id, 'critical_errors', `${recent500s} server errors in the last 5 minutes`, 'critical');
        }
    }
    getRules() {
        return Array.from(this.rules.values());
    }
    getRule(ruleId) {
        return this.rules.get(ruleId);
    }
    getChannels() {
        return this.channels;
    }
    addChannel(channel) {
        this.channels.push(channel);
    }
    removeChannel(type) {
        this.channels = this.channels.filter(ch => ch.type !== type);
    }
}
exports.AlertManager = AlertManager;
//# sourceMappingURL=index.js.map