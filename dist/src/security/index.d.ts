import { Storage } from '../storage';
export interface SecurityConfig {
    api_rate_limit: {
        window_ms: number;
        max_requests: number;
        skip_successful_requests: boolean;
    };
    csp: {
        default_src: string[];
        script_src: string[];
        style_src: string[];
        img_src: string[];
        connect_src: string[];
    };
    cors: {
        origin: string[] | boolean;
        credentials: boolean;
        max_age: number;
    };
    headers: {
        hsts_max_age: number;
        x_frame_options: 'DENY' | 'SAMEORIGIN';
        x_content_type_options: boolean;
        x_xss_protection: boolean;
        referrer_policy: string;
    };
    validation: {
        max_request_size: string;
        max_url_length: number;
        max_header_size: number;
        allowed_file_extensions: string[];
        blocked_file_extensions: string[];
    };
    ip_security: {
        whitelist: string[];
        blacklist: string[];
        geo_blocking_enabled: boolean;
        blocked_countries: string[];
        max_requests_per_ip: number;
    };
    encryption: {
        algorithm: string;
        key_length: number;
        iv_length: number;
        salt_rounds: number;
    };
}
export interface SecurityEvent {
    id: number;
    type: 'intrusion_attempt' | 'brute_force' | 'sql_injection' | 'xss' | 'csrf' | 'suspicious_activity' | 'lfi' | 'rfi' | 'rce' | 'xxe';
    severity: 'low' | 'medium' | 'high' | 'critical';
    ip_address: string;
    user_agent?: string;
    path?: string;
    method?: string;
    payload?: string;
    timestamp: Date;
    blocked: boolean;
    details?: any;
}
export interface IPReputation {
    ip_address: string;
    reputation_score: number;
    is_proxy: boolean;
    is_vpn: boolean;
    is_tor: boolean;
    is_datacenter: boolean;
    country_code?: string;
    last_updated: Date;
}
export interface AuditLog {
    id: number;
    user_id?: number;
    action: string;
    resource: string;
    ip_address: string;
    user_agent?: string;
    timestamp: Date;
    success: boolean;
    details?: any;
}
export declare class SecurityManager {
    private storage;
    private config;
    private encryptionKey;
    constructor(storage: Storage, config?: Partial<SecurityConfig>);
    private getDefaultConfig;
    private initializeSecurityTables;
    private deriveEncryptionKey;
    encrypt(text: string): {
        encrypted: string;
        iv: string;
        tag: string;
    };
    decrypt(encrypted: string, iv: string, tag: string): string;
    validateInput(input: string, type: 'path' | 'domain' | 'email' | 'username' | 'general'): {
        valid: boolean;
        sanitized: string;
    };
    detectSQLInjection(input: string): boolean;
    detectXSS(input: string): boolean;
    generateCSRFToken(sessionId: string): string;
    validateCSRFToken(token: string, sessionId: string): boolean;
    checkIPReputation(ip: string): Promise<IPReputation>;
    isIPWhitelisted(ip: string): boolean;
    isIPBlacklisted(ip: string): boolean;
    logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void>;
    private sendSecurityAlert;
    logAudit(audit: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void>;
    getCSPHeader(): string;
    getSecurityHeaders(): Record<string, string>;
    checkPasswordStrength(password: string): {
        score: number;
        feedback: string[];
    };
    validateFileUpload(filename: string, size: number): {
        valid: boolean;
        reason?: string;
    };
    private parseSize;
}
export declare const securityManager: (storage: Storage, config?: Partial<SecurityConfig>) => SecurityManager;
//# sourceMappingURL=index.d.ts.map