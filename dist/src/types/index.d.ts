export interface Domain {
    id: number;
    name: string;
    created_at: Date;
    last_seen: Date;
    health_score: number;
}
export interface LogEntry {
    id?: number;
    domain_id: number;
    timestamp: Date;
    ip: string;
    method: string;
    path: string;
    status: number;
    size: number;
    response_time?: number;
    user_agent?: string;
    referer?: string;
    raw_line: string;
}
export interface LogFile {
    path: string;
    domain: string;
    type: 'access' | 'error' | 'application';
    format: LogFormat;
    size: number;
    last_modified: Date;
}
export interface LogFormat {
    name: string;
    pattern: RegExp;
    fields: string[];
}
export interface DomainStats {
    domain: string;
    requests_per_minute: number;
    error_rate: number;
    avg_response_time: number;
    traffic_volume: number;
    unique_ips: number;
    health_score: number;
}
export interface Alert {
    id?: number;
    domain_id: number;
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    created_at: Date;
    resolved_at?: Date;
}
export interface Config {
    server: {
        port: number;
        host: string;
    };
    storage: {
        db_path: string;
        retention_days: number;
    };
    monitoring: {
        scan_interval: string;
        batch_size: number;
        max_file_size: string;
    };
    alerts: {
        email: {
            enabled: boolean;
            smtp_server: string;
        };
        webhook: {
            enabled: boolean;
            url: string;
        };
    };
    log_paths: string[];
    ignore_patterns: string[];
    panel_paths: {
        [key: string]: string;
    };
    security?: {
        api_rate_limit?: {
            window_ms: number;
            max_requests: number;
            skip_successful_requests: boolean;
        };
        cors?: {
            origin: string[] | boolean;
            credentials: boolean;
            max_age: number;
        };
        auth?: {
            jwt_secret: string;
            session_timeout: number;
            max_login_attempts: number;
            lockout_duration: number;
            password_min_length: number;
            require_special_chars: boolean;
            require_numbers: boolean;
        };
        waf?: {
            enabled: boolean;
            mode: 'block' | 'monitor';
        };
    };
}
export interface DiscoveryResult {
    domains: Set<string>;
    log_files: LogFile[];
    errors: string[];
}
//# sourceMappingURL=index.d.ts.map