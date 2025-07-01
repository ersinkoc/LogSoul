"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWAF = exports.WebApplicationFirewall = void 0;
const i18n_1 = require("../i18n");
class WebApplicationFirewall {
    constructor(security) {
        this.rules = new Map();
        this.blockedRequests = new Map();
        this.security = security;
        this.initializeRules();
    }
    initializeRules() {
        // SQL Injection rules
        this.addRule({
            id: 'sql-injection-001',
            name: 'SQL Injection - UNION SELECT',
            description: 'Detects UNION SELECT SQL injection attempts',
            enabled: true,
            severity: 'high',
            category: 'sql_injection',
            patterns: [
                /\bunion\s+select\b/i,
                /\bunion\s+all\s+select\b/i,
                /\bunion\s+distinct\s+select\b/i
            ],
            action: 'block',
            targets: ['query', 'body', 'headers', 'cookies']
        });
        this.addRule({
            id: 'sql-injection-002',
            name: 'SQL Injection - Time-based',
            description: 'Detects time-based SQL injection attempts',
            enabled: true,
            severity: 'high',
            category: 'sql_injection',
            patterns: [
                /\bsleep\s*\(\s*\d+\s*\)/i,
                /\bbenchmark\s*\(/i,
                /\bwaitfor\s+delay\b/i,
                /\bpg_sleep\s*\(/i
            ],
            action: 'block',
            targets: ['query', 'body']
        });
        // XSS rules
        this.addRule({
            id: 'xss-001',
            name: 'XSS - Script Tags',
            description: 'Detects script tag injection attempts',
            enabled: true,
            severity: 'high',
            category: 'xss',
            patterns: [
                /<script[^>]*>.*?<\/script>/gi,
                /<script[^>]*>/gi,
                /javascript:/gi,
                /onerror\s*=/gi,
                /onload\s*=/gi,
                /onclick\s*=/gi,
                /onmouseover\s*=/gi
            ],
            action: 'block',
            targets: ['query', 'body', 'headers']
        });
        this.addRule({
            id: 'xss-002',
            name: 'XSS - Event Handlers',
            description: 'Detects XSS via event handlers',
            enabled: true,
            severity: 'high',
            category: 'xss',
            patterns: [
                /\bon\w+\s*=\s*["'][^"']*["']/gi,
                /\bon\w+\s*=\s*[^>\s]+/gi
            ],
            action: 'block',
            targets: ['query', 'body']
        });
        // Local File Inclusion
        this.addRule({
            id: 'lfi-001',
            name: 'LFI - Path Traversal',
            description: 'Detects path traversal attempts',
            enabled: true,
            severity: 'high',
            category: 'lfi',
            patterns: [
                /\.\.[\/\\]/,
                /\/etc\/passwd/,
                /\/etc\/shadow/,
                /\/windows\/system32/i,
                /\.\.%2f/i,
                /\.\.%5c/i
            ],
            action: 'block',
            targets: ['query', 'body', 'path']
        });
        // Remote File Inclusion
        this.addRule({
            id: 'rfi-001',
            name: 'RFI - Remote URL',
            description: 'Detects remote file inclusion attempts',
            enabled: true,
            severity: 'critical',
            category: 'rfi',
            patterns: [
                /https?:\/\/.*\.(php|asp|jsp|cgi)/i,
                /ftp:\/\//i,
                /file:\/\//i,
                /data:text\/html/i
            ],
            action: 'block',
            targets: ['query', 'body']
        });
        // Remote Code Execution
        this.addRule({
            id: 'rce-001',
            name: 'RCE - Command Injection',
            description: 'Detects command injection attempts',
            enabled: true,
            severity: 'critical',
            category: 'rce',
            patterns: [
                /;\s*(ls|cat|pwd|whoami|id|uname)/,
                /\|\s*(ls|cat|pwd|whoami|id|uname)/,
                /`[^`]*`/,
                /\$\([^)]+\)/,
                /&&\s*(ls|cat|pwd|whoami|id|uname)/
            ],
            action: 'block',
            targets: ['query', 'body', 'headers']
        });
        // XXE (XML External Entity)
        this.addRule({
            id: 'xxe-001',
            name: 'XXE - External Entity',
            description: 'Detects XXE injection attempts',
            enabled: true,
            severity: 'high',
            category: 'xxe',
            patterns: [
                /<!ENTITY/i,
                /<!DOCTYPE[^>]*SYSTEM/i,
                /<!DOCTYPE[^>]*PUBLIC/i,
                /<!\[CDATA\[/i
            ],
            action: 'block',
            targets: ['body']
        });
        // Protocol violations
        this.addRule({
            id: 'protocol-001',
            name: 'Protocol - HTTP Smuggling',
            description: 'Detects HTTP request smuggling attempts',
            enabled: true,
            severity: 'high',
            category: 'custom',
            patterns: [
                /Content-Length:.*Content-Length:/i,
                /Transfer-Encoding:.*chunked.*Content-Length:/i
            ],
            action: 'block',
            targets: ['headers']
        });
        // Bot detection
        this.addRule({
            id: 'bot-001',
            name: 'Bot - Malicious User Agents',
            description: 'Detects known malicious bot user agents',
            enabled: true,
            severity: 'medium',
            category: 'custom',
            patterns: [
                /sqlmap/i,
                /nikto/i,
                /havij/i,
                /acunetix/i,
                /netsparker/i,
                /burpsuite/i,
                /nmap/i
            ],
            action: 'block',
            targets: ['headers']
        });
    }
    addRule(rule) {
        this.rules.set(rule.id, rule);
    }
    removeRule(ruleId) {
        this.rules.delete(ruleId);
    }
    enableRule(ruleId) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            rule.enabled = true;
        }
    }
    disableRule(ruleId) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            rule.enabled = false;
        }
    }
    extractValue(req, target) {
        switch (target) {
            case 'query':
                return JSON.stringify(req.query);
            case 'body':
                return JSON.stringify(req.body);
            case 'headers':
                return JSON.stringify(req.headers);
            case 'cookies':
                return JSON.stringify(req.cookies || {});
            case 'path':
                return req.path;
            default:
                return '';
        }
    }
    async inspect(req) {
        for (const rule of this.rules.values()) {
            if (!rule.enabled)
                continue;
            for (const target of rule.targets) {
                const value = this.extractValue(req, target);
                for (const pattern of rule.patterns) {
                    const match = value.match(pattern);
                    if (match) {
                        // Log the security event
                        await this.security.logSecurityEvent({
                            type: rule.category === 'custom' ? 'suspicious_activity' : rule.category,
                            severity: rule.severity,
                            ip_address: req.ip || 'unknown',
                            user_agent: req.get('user-agent') || 'unknown',
                            path: req.path,
                            method: req.method,
                            payload: match[0].substring(0, 100), // Limit payload size
                            blocked: rule.action === 'block',
                            details: {
                                rule_id: rule.id,
                                rule_name: rule.name,
                                target,
                                full_match: match[0]
                            }
                        });
                        if (rule.action === 'block') {
                            // Track blocked requests per IP
                            const ipAddress = req.ip || 'unknown';
                            const blockedCount = (this.blockedRequests.get(ipAddress) || 0) + 1;
                            this.blockedRequests.set(ipAddress, blockedCount);
                            // Auto-blacklist IPs with too many blocks
                            if (blockedCount >= 10) {
                                console.log(`🚫 Auto-blacklisting IP ${ipAddress} after ${blockedCount} blocked requests`);
                                // In production, this would add to IP blacklist
                            }
                            return { blocked: true, rule, match: match[0] };
                        }
                    }
                }
            }
        }
        return { blocked: false };
    }
    middleware() {
        return async (req, res, next) => {
            try {
                const result = await this.inspect(req);
                if (result.blocked && result.rule) {
                    console.log(`🛡️ WAF blocked request: ${result.rule.name} (${req.ip || 'unknown'})`);
                    return res.status(403).json({
                        error: i18n_1.i18n.t('security.events.blocked'),
                        details: process.env.NODE_ENV === 'development' ? {
                            rule: result.rule.name,
                            match: result.match
                        } : undefined
                    });
                }
                next();
            }
            catch (error) {
                console.error('WAF error:', error);
                // In case of WAF error, allow request to proceed
                next();
            }
        };
    }
    // Get WAF statistics
    getStats() {
        const enabledRules = Array.from(this.rules.values()).filter(rule => rule.enabled).length;
        return {
            totalRules: this.rules.size,
            enabledRules,
            blockedRequests: new Map(this.blockedRequests)
        };
    }
    // Reset blocked requests counter
    resetBlockedRequests() {
        this.blockedRequests.clear();
    }
}
exports.WebApplicationFirewall = WebApplicationFirewall;
// Export factory function
const createWAF = (security) => {
    return new WebApplicationFirewall(security);
};
exports.createWAF = createWAF;
//# sourceMappingURL=waf.js.map