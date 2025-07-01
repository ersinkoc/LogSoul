import { Storage } from '../storage';
import { Alert } from '../types';
export interface AnalysisResult {
    domain: string;
    timeRange: string;
    totalRequests: number;
    errorRate: number;
    avgResponseTime: number;
    topPages: Array<[string, number]>;
    topIPs: Array<[string, number]>;
    topUserAgents: Array<[string, number]>;
    topErrors: Array<[string, number]>;
    statusCodeDistribution: {
        [key: string]: number;
    };
    trafficPattern: Array<{
        timestamp: Date;
        requests: number;
    }>;
    securityThreats: SecurityThreat[];
    performanceIssues: PerformanceIssue[];
}
export interface SecurityThreat {
    type: 'sql_injection' | 'xss' | 'brute_force' | 'suspicious_ua' | 'path_traversal';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    count: number;
    ips: string[];
    paths: string[];
}
export interface PerformanceIssue {
    type: 'slow_response' | 'high_error_rate' | 'traffic_spike' | 'memory_usage';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    value: number;
    threshold: number;
}
export declare class LogAnalyzer {
    private storage;
    constructor(storage: Storage);
    analyzeDomain(domainName: string, timeRange?: string): Promise<AnalysisResult>;
    private getTimeRange;
    private getEmptyAnalysis;
    private calculateErrorRate;
    private calculateAvgResponseTime;
    private getTopPages;
    private getTopIPs;
    private getTopUserAgents;
    private getTopErrors;
    private getStatusCodeDistribution;
    private getTrafficPattern;
    private getBucketSize;
    private detectSecurityThreats;
    private detectPerformanceIssues;
    generateAlerts(domainName: string): Promise<Alert[]>;
    calculateHealthScore(domainName: string): Promise<number>;
}
//# sourceMappingURL=index.d.ts.map