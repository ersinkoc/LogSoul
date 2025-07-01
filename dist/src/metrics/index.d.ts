import { Storage } from '../storage';
import { LogAnalyzer } from '../analyzer';
export interface MetricsData {
    logsoul_requests_total: {
        [domain: string]: number;
    };
    logsoul_errors_total: {
        [domain: string]: number;
    };
    logsoul_response_time_avg: {
        [domain: string]: number;
    };
    logsoul_response_time_95th: {
        [domain: string]: number;
    };
    logsoul_domain_health_score: {
        [domain: string]: number;
    };
    logsoul_security_threats_total: {
        [domain: string]: {
            [type: string]: number;
        };
    };
    logsoul_bandwidth_bytes: {
        [domain: string]: number;
    };
    logsoul_unique_ips: {
        [domain: string]: number;
    };
    logsoul_system_uptime: number;
    logsoul_system_memory_usage: number;
    logsoul_domains_monitored: number;
}
export declare class MetricsCollector {
    private storage;
    private analyzer;
    private startTime;
    constructor(storage: Storage, analyzer: LogAnalyzer);
    collectMetrics(): Promise<MetricsData>;
    formatPrometheusMetrics(metrics: MetricsData): string;
    getPrometheusMetrics(): Promise<string>;
    getJsonMetrics(): Promise<MetricsData>;
}
//# sourceMappingURL=index.d.ts.map