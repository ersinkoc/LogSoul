"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSecurityMiddleware = exports.SecurityMiddleware = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const security_1 = require("../security");
const waf_1 = require("../security/waf");
const i18n_1 = require("../i18n");
class SecurityMiddleware {
    constructor(config) {
        this.rateLimiters = new Map();
        this.security = new security_1.SecurityManager(config.storage, config.securityConfig);
        this.waf = (0, waf_1.createWAF)(this.security);
    }
    // Apply all security headers
    applySecurityHeaders() {
        return (0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "wss:", "ws:"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        });
    }
    // Custom security headers
    customSecurityHeaders() {
        return (req, res, next) => {
            const headers = this.security.getSecurityHeaders();
            Object.entries(headers).forEach(([key, value]) => {
                res.setHeader(key, value);
            });
            next();
        };
    }
    // Global rate limiter
    globalRateLimit() {
        if (!this.rateLimiters.has('global')) {
            this.rateLimiters.set('global', (0, express_rate_limit_1.default)({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 100,
                message: i18n_1.i18n.t('security.events.rateLimit'),
                standardHeaders: true,
                legacyHeaders: false,
                handler: (req, res) => {
                    this.security.logSecurityEvent({
                        type: 'brute_force',
                        severity: 'medium',
                        ip_address: req.ip || 'unknown',
                        user_agent: req.get('user-agent') || 'unknown',
                        path: req.path,
                        method: req.method,
                        blocked: true
                    });
                    res.status(429).json({
                        error: i18n_1.i18n.t('security.events.rateLimit')
                    });
                }
            }));
        }
        return this.rateLimiters.get('global');
    }
    // API-specific rate limiter
    apiRateLimit() {
        if (!this.rateLimiters.has('api')) {
            this.rateLimiters.set('api', (0, express_rate_limit_1.default)({
                windowMs: 1 * 60 * 1000, // 1 minute
                max: 30,
                message: 'Too many API requests',
                skipSuccessfulRequests: false
            }));
        }
        return this.rateLimiters.get('api');
    }
    // Auth rate limiter (stricter)
    authRateLimit() {
        if (!this.rateLimiters.has('auth')) {
            this.rateLimiters.set('auth', (0, express_rate_limit_1.default)({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 5,
                skipFailedRequests: true,
                message: 'Too many authentication attempts'
            }));
        }
        return this.rateLimiters.get('auth');
    }
    // Input validation middleware
    validateInput() {
        return async (req, res, next) => {
            try {
                // Check request size
                const contentLength = parseInt(req.get('content-length') || '0');
                if (contentLength > 10 * 1024 * 1024) { // 10MB
                    return res.status(413).json({ error: 'Request too large' });
                }
                // Validate common inputs
                const inputs = { ...req.query, ...req.body, ...req.params };
                for (const [key, value] of Object.entries(inputs)) {
                    if (typeof value === 'string') {
                        // Check for SQL injection
                        if (this.security.detectSQLInjection(value)) {
                            await this.security.logSecurityEvent({
                                type: 'sql_injection',
                                severity: 'high',
                                ip_address: req.ip || 'unknown',
                                user_agent: req.get('user-agent') || 'unknown',
                                path: req.path,
                                method: req.method,
                                payload: value,
                                blocked: true
                            });
                            return res.status(400).json({ error: i18n_1.i18n.t('security.events.invalidInput') });
                        }
                        // Check for XSS
                        if (this.security.detectXSS(value)) {
                            await this.security.logSecurityEvent({
                                type: 'xss',
                                severity: 'high',
                                ip_address: req.ip || 'unknown',
                                user_agent: req.get('user-agent') || 'unknown',
                                path: req.path,
                                method: req.method,
                                payload: value,
                                blocked: true
                            });
                            return res.status(400).json({ error: i18n_1.i18n.t('security.events.invalidInput') });
                        }
                    }
                }
                next();
            }
            catch (error) {
                console.error('Security validation error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        };
    }
    // IP-based security checks
    ipSecurity() {
        return async (req, res, next) => {
            const ip = req.ip || 'unknown';
            // Check whitelist
            if (ip !== 'unknown' && this.security.isIPWhitelisted(ip)) {
                return next();
            }
            // Check blacklist
            if (ip !== 'unknown' && this.security.isIPBlacklisted(ip)) {
                await this.security.logSecurityEvent({
                    type: 'intrusion_attempt',
                    severity: 'high',
                    ip_address: ip,
                    user_agent: req.get('user-agent'),
                    path: req.path,
                    method: req.method,
                    blocked: true
                });
                return res.status(403).json({ error: i18n_1.i18n.t('security.events.blocked') });
            }
            // Check IP reputation
            if (ip !== 'unknown') {
                const reputation = await this.security.checkIPReputation(ip);
                if (reputation.reputation_score < 50 || reputation.is_tor || reputation.is_proxy) {
                    await this.security.logSecurityEvent({
                        type: 'suspicious_activity',
                        severity: 'medium',
                        ip_address: ip,
                        user_agent: req.get('user-agent'),
                        path: req.path,
                        method: req.method,
                        blocked: false,
                        details: reputation
                    });
                }
            }
            next();
        };
    }
    // CSRF protection
    csrfProtection() {
        return (req, res, next) => {
            // Skip CSRF for GET requests
            if (req.method === 'GET') {
                return next();
            }
            const token = req.get('X-CSRF-Token') || req.body._csrf;
            const sessionId = req.session?.id || 'anonymous';
            if (!token || !this.security.validateCSRFToken(token, sessionId)) {
                return res.status(403).json({ error: 'Invalid CSRF token' });
            }
            next();
        };
    }
    // Audit logging
    auditLog() {
        return async (req, res, next) => {
            const startTime = Date.now();
            // Capture original end function
            const originalEnd = res.end;
            // Override response end to capture audit data
            const originalSend = res.send;
            const security = this.security;
            res.send = function (data) {
                // Log the audit entry
                const duration = Date.now() - startTime;
                const userId = req.user?.id;
                setImmediate(() => {
                    security.logAudit({
                        user_id: userId,
                        action: `${req.method} ${req.path}`,
                        resource: req.path,
                        ip_address: req.ip || 'unknown',
                        user_agent: req.get('user-agent') || 'unknown',
                        success: res.statusCode < 400,
                        details: {
                            duration,
                            status_code: res.statusCode,
                            query: req.query,
                            body_size: req.get('content-length')
                        }
                    });
                });
                return originalSend.call(res, data);
            };
            next();
        };
    }
    // File upload security
    fileUploadSecurity() {
        return (req, res, next) => {
            // Check if files exist in the request (added by multer or similar middleware)
            const files = req.files;
            if (!files) {
                return next();
            }
            const fileArray = Array.isArray(files) ? files : [files];
            for (const file of fileArray) {
                const validation = this.security.validateFileUpload(file.originalname || file.name, file.size);
                if (!validation.valid) {
                    return res.status(400).json({
                        error: validation.reason || i18n_1.i18n.t('security.events.fileBlocked')
                    });
                }
            }
            next();
        };
    }
    // Apply all security middleware
    applyAll() {
        return [
            this.applySecurityHeaders(),
            this.customSecurityHeaders(),
            this.globalRateLimit(),
            this.waf.middleware(),
            this.ipSecurity(),
            this.validateInput(),
            this.auditLog()
        ];
    }
}
exports.SecurityMiddleware = SecurityMiddleware;
// Factory function
const createSecurityMiddleware = (config) => {
    return new SecurityMiddleware(config);
};
exports.createSecurityMiddleware = createSecurityMiddleware;
//# sourceMappingURL=security.js.map