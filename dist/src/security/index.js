"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityManager = exports.SecurityManager = void 0;
const crypto = __importStar(require("crypto"));
const i18n_1 = require("../i18n");
class SecurityManager {
    constructor(storage, config) {
        this.storage = storage;
        this.config = this.getDefaultConfig(config);
        this.encryptionKey = this.deriveEncryptionKey();
        this.initializeSecurityTables();
    }
    getDefaultConfig(overrides) {
        return {
            api_rate_limit: {
                window_ms: 15 * 60 * 1000, // 15 minutes
                max_requests: 100,
                skip_successful_requests: false
            },
            csp: {
                default_src: ["'self'"],
                script_src: ["'self'", "'unsafe-inline'"],
                style_src: ["'self'", "'unsafe-inline'"],
                img_src: ["'self'", "data:", "https:"],
                connect_src: ["'self'", "wss:"]
            },
            cors: {
                origin: false,
                credentials: true,
                max_age: 86400
            },
            headers: {
                hsts_max_age: 31536000,
                x_frame_options: 'DENY',
                x_content_type_options: true,
                x_xss_protection: true,
                referrer_policy: 'strict-origin-when-cross-origin'
            },
            validation: {
                max_request_size: '10MB',
                max_url_length: 2048,
                max_header_size: 8192,
                allowed_file_extensions: ['.log', '.txt', '.json', '.csv'],
                blocked_file_extensions: ['.exe', '.bat', '.cmd', '.sh', '.ps1']
            },
            ip_security: {
                whitelist: [],
                blacklist: [],
                geo_blocking_enabled: false,
                blocked_countries: [],
                max_requests_per_ip: 1000
            },
            encryption: {
                algorithm: 'aes-256-gcm',
                key_length: 32,
                iv_length: 16,
                salt_rounds: 10
            },
            ...overrides
        };
    }
    async initializeSecurityTables() {
        console.log('🛡️ Security system initialized');
    }
    deriveEncryptionKey() {
        const masterKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
        return crypto.pbkdf2Sync(masterKey, 'logsoul-security', 100000, 32, 'sha256');
    }
    // Encryption/Decryption
    encrypt(text) {
        const iv = crypto.randomBytes(this.config.encryption.iv_length);
        const cipher = crypto.createCipheriv(this.config.encryption.algorithm, this.encryptionKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();
        return {
            encrypted,
            iv: iv.toString('hex'),
            tag: tag.toString('hex')
        };
    }
    decrypt(encrypted, iv, tag) {
        const decipher = crypto.createDecipheriv(this.config.encryption.algorithm, this.encryptionKey, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    // Input Validation
    validateInput(input, type) {
        let sanitized = input.trim();
        let valid = true;
        // Remove null bytes
        sanitized = sanitized.replace(/\0/g, '');
        switch (type) {
            case 'path':
                // Prevent path traversal
                if (sanitized.includes('../') || sanitized.includes('..\\')) {
                    valid = false;
                }
                // Remove potentially dangerous characters
                sanitized = sanitized.replace(/[<>"|?*]/g, '');
                break;
            case 'domain':
                // Basic domain validation
                const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+[a-zA-Z0-9]$/;
                valid = domainRegex.test(sanitized) && sanitized.length <= 253;
                break;
            case 'email':
                // Basic email validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                valid = emailRegex.test(sanitized) && sanitized.length <= 254;
                break;
            case 'username':
                // Username validation
                const usernameRegex = /^[a-zA-Z0-9_-]{3,32}$/;
                valid = usernameRegex.test(sanitized);
                break;
            case 'general':
                // Remove potential XSS vectors
                sanitized = sanitized
                    .replace(/[<>]/g, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '');
                break;
        }
        return { valid, sanitized };
    }
    // SQL Injection Detection
    detectSQLInjection(input) {
        const sqlPatterns = [
            /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
            /(\b(script|javascript|vbscript|onload|onerror|onclick)\b)/i,
            /(--|\/\*|\*\/|xp_|sp_)/i,
            /(\bor\b\s*\d+\s*=\s*\d+)/i,
            /(\band\b\s*\d+\s*=\s*\d+)/i,
            /(['"];\s*(drop|delete|update|insert))/i
        ];
        return sqlPatterns.some(pattern => pattern.test(input));
    }
    // XSS Detection
    detectXSS(input) {
        const xssPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /<iframe[^>]*>.*?<\/iframe>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<img[^>]+src[\\s]*=[\\s]*["\']javascript:/gi,
            /eval\s*\(/gi,
            /expression\s*\(/gi
        ];
        return xssPatterns.some(pattern => pattern.test(input));
    }
    // CSRF Token Management
    generateCSRFToken(sessionId) {
        const data = sessionId + Date.now().toString();
        return crypto.createHmac('sha256', this.encryptionKey)
            .update(data)
            .digest('hex');
    }
    validateCSRFToken(token, sessionId) {
        // In a real implementation, you'd store and compare tokens
        // This is a simplified version
        return token.length === 64 && /^[a-f0-9]+$/.test(token);
    }
    // IP Security
    async checkIPReputation(ip) {
        // In a real implementation, this would query external IP reputation services
        // For now, return a mock reputation
        return {
            ip_address: ip,
            reputation_score: 75,
            is_proxy: false,
            is_vpn: false,
            is_tor: false,
            is_datacenter: false,
            country_code: 'US',
            last_updated: new Date()
        };
    }
    isIPWhitelisted(ip) {
        return this.config.ip_security.whitelist.includes(ip);
    }
    isIPBlacklisted(ip) {
        return this.config.ip_security.blacklist.includes(ip);
    }
    // Security Event Logging
    async logSecurityEvent(event) {
        const securityEvent = {
            ...event,
            timestamp: new Date()
        };
        // Log to storage
        console.log(`🚨 Security Event: ${event.type} from ${event.ip_address} (${event.severity})`);
        // Send alerts for high/critical events
        if (event.severity === 'high' || event.severity === 'critical') {
            await this.sendSecurityAlert(securityEvent);
        }
    }
    async sendSecurityAlert(event) {
        console.log(`📧 Security Alert: ${event.type} - ${event.severity}`);
        // In a real implementation, this would send emails, webhooks, etc.
    }
    // Audit Logging
    async logAudit(audit) {
        const auditLog = {
            ...audit,
            timestamp: new Date()
        };
        console.log(`📝 Audit: ${audit.action} on ${audit.resource} by user ${audit.user_id || 'anonymous'}`);
    }
    // Content Security Policy Header
    getCSPHeader() {
        const directives = Object.entries(this.config.csp)
            .map(([key, values]) => {
            const directive = key.replace(/_/g, '-');
            return `${directive} ${values.join(' ')}`;
        })
            .join('; ');
        return directives;
    }
    // Security Headers
    getSecurityHeaders() {
        const headers = {};
        // HSTS
        headers['Strict-Transport-Security'] = `max-age=${this.config.headers.hsts_max_age}; includeSubDomains; preload`;
        // X-Frame-Options
        headers['X-Frame-Options'] = this.config.headers.x_frame_options;
        // X-Content-Type-Options
        if (this.config.headers.x_content_type_options) {
            headers['X-Content-Type-Options'] = 'nosniff';
        }
        // X-XSS-Protection
        if (this.config.headers.x_xss_protection) {
            headers['X-XSS-Protection'] = '1; mode=block';
        }
        // Referrer-Policy
        headers['Referrer-Policy'] = this.config.headers.referrer_policy;
        // CSP
        headers['Content-Security-Policy'] = this.getCSPHeader();
        return headers;
    }
    // Password Strength Validation
    checkPasswordStrength(password) {
        let score = 0;
        const feedback = [];
        // Length
        if (password.length >= 8)
            score += 1;
        if (password.length >= 12)
            score += 1;
        if (password.length >= 16)
            score += 1;
        else
            feedback.push(i18n_1.i18n.t('security.password.tooShort'));
        // Character variety
        if (/[a-z]/.test(password))
            score += 1;
        else
            feedback.push(i18n_1.i18n.t('security.password.needsLowercase'));
        if (/[A-Z]/.test(password))
            score += 1;
        else
            feedback.push(i18n_1.i18n.t('security.password.needsUppercase'));
        if (/[0-9]/.test(password))
            score += 1;
        else
            feedback.push(i18n_1.i18n.t('security.password.needsNumbers'));
        if (/[^a-zA-Z0-9]/.test(password))
            score += 1;
        else
            feedback.push(i18n_1.i18n.t('security.password.needsSpecial'));
        // Common patterns
        if (!/(.)\1{2,}/.test(password))
            score += 1;
        else
            feedback.push(i18n_1.i18n.t('security.password.avoidRepeating'));
        if (!/^(123|abc|qwerty|password)/i.test(password))
            score += 1;
        else
            feedback.push(i18n_1.i18n.t('security.password.tooCommon'));
        return { score: Math.min(score / 9 * 100, 100), feedback };
    }
    // File Upload Security
    validateFileUpload(filename, size) {
        const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
        // Check blocked extensions
        if (this.config.validation.blocked_file_extensions.includes(extension)) {
            return { valid: false, reason: 'File type not allowed' };
        }
        // Check allowed extensions if specified
        if (this.config.validation.allowed_file_extensions.length > 0 &&
            !this.config.validation.allowed_file_extensions.includes(extension)) {
            return { valid: false, reason: 'File type not permitted' };
        }
        // Check file size
        const maxSize = this.parseSize(this.config.validation.max_request_size);
        if (size > maxSize) {
            return { valid: false, reason: 'File size exceeds limit' };
        }
        return { valid: true };
    }
    parseSize(size) {
        const units = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024
        };
        const match = size.match(/^(\d+)\s*([A-Z]+)$/i);
        if (!match)
            return 0;
        const value = parseInt(match[1]);
        const unit = match[2].toUpperCase();
        return value * (units[unit] || 1);
    }
}
exports.SecurityManager = SecurityManager;
// Export singleton instance
const securityManager = (storage, config) => {
    return new SecurityManager(storage, config);
};
exports.securityManager = securityManager;
//# sourceMappingURL=index.js.map