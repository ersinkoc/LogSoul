"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogAnalyzer = void 0;
class LogAnalyzer {
    constructor(storage) {
        this.storage = storage;
    }
    async analyzeDomain(domainName, timeRange = '1h') {
        const domain = await this.storage.getDomain(domainName);
        if (!domain) {
            throw new Error(`Domain not found: ${domainName}`);
        }
        const { startTime, endTime } = this.getTimeRange(timeRange);
        const logs = await this.storage.getLogsByTimeRange(domain.id, startTime, endTime);
        if (logs.length === 0) {
            return this.getEmptyAnalysis(domainName, timeRange);
        }
        const analysis = {
            domain: domainName,
            timeRange,
            totalRequests: logs.length,
            errorRate: this.calculateErrorRate(logs),
            avgResponseTime: this.calculateAvgResponseTime(logs),
            topPages: this.getTopPages(logs),
            topIPs: this.getTopIPs(logs),
            topUserAgents: this.getTopUserAgents(logs),
            topErrors: this.getTopErrors(logs),
            statusCodeDistribution: this.getStatusCodeDistribution(logs),
            trafficPattern: this.getTrafficPattern(logs, timeRange),
            securityThreats: this.detectSecurityThreats(logs),
            performanceIssues: this.detectPerformanceIssues(logs, timeRange)
        };
        return analysis;
    }
    getTimeRange(timeRange) {
        const endTime = new Date();
        const startTime = new Date();
        switch (timeRange) {
            case '1h':
                startTime.setHours(startTime.getHours() - 1);
                break;
            case '24h':
                startTime.setDate(startTime.getDate() - 1);
                break;
            case '7d':
                startTime.setDate(startTime.getDate() - 7);
                break;
            case '30d':
                startTime.setDate(startTime.getDate() - 30);
                break;
            default:
                startTime.setHours(startTime.getHours() - 1);
        }
        return { startTime, endTime };
    }
    getEmptyAnalysis(domain, timeRange) {
        return {
            domain,
            timeRange,
            totalRequests: 0,
            errorRate: 0,
            avgResponseTime: 0,
            topPages: [],
            topIPs: [],
            topUserAgents: [],
            topErrors: [],
            statusCodeDistribution: {},
            trafficPattern: [],
            securityThreats: [],
            performanceIssues: []
        };
    }
    calculateErrorRate(logs) {
        const errors = logs.filter(log => log.status >= 400).length;
        return logs.length > 0 ? (errors / logs.length) * 100 : 0;
    }
    calculateAvgResponseTime(logs) {
        const withResponseTime = logs.filter(log => log.response_time !== undefined);
        if (withResponseTime.length === 0)
            return 0;
        const total = withResponseTime.reduce((sum, log) => sum + (log.response_time || 0), 0);
        return total / withResponseTime.length;
    }
    getTopPages(logs) {
        const pages = new Map();
        logs.forEach(log => {
            const path = log.path || '/';
            pages.set(path, (pages.get(path) || 0) + 1);
        });
        return Array.from(pages.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    }
    getTopIPs(logs) {
        const ips = new Map();
        logs.forEach(log => {
            ips.set(log.ip, (ips.get(log.ip) || 0) + 1);
        });
        return Array.from(ips.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    }
    getTopUserAgents(logs) {
        const userAgents = new Map();
        logs.forEach(log => {
            if (log.user_agent) {
                userAgents.set(log.user_agent, (userAgents.get(log.user_agent) || 0) + 1);
            }
        });
        return Array.from(userAgents.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    }
    getTopErrors(logs) {
        const errors = new Map();
        logs.filter(log => log.status >= 400).forEach(log => {
            const path = log.path || '/';
            errors.set(path, (errors.get(path) || 0) + 1);
        });
        return Array.from(errors.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    }
    getStatusCodeDistribution(logs) {
        const distribution = {};
        logs.forEach(log => {
            const statusGroup = Math.floor(log.status / 100) * 100;
            const key = `${statusGroup}xx`;
            distribution[key] = (distribution[key] || 0) + 1;
        });
        return distribution;
    }
    getTrafficPattern(logs, timeRange) {
        const pattern = [];
        const bucketSize = this.getBucketSize(timeRange);
        const buckets = new Map();
        logs.forEach(log => {
            const bucketTime = Math.floor(log.timestamp.getTime() / bucketSize) * bucketSize;
            buckets.set(bucketTime, (buckets.get(bucketTime) || 0) + 1);
        });
        Array.from(buckets.entries())
            .sort((a, b) => a[0] - b[0])
            .forEach(([timestamp, requests]) => {
            pattern.push({
                timestamp: new Date(timestamp),
                requests
            });
        });
        return pattern;
    }
    getBucketSize(timeRange) {
        switch (timeRange) {
            case '1h': return 5 * 60 * 1000; // 5 minutes
            case '24h': return 60 * 60 * 1000; // 1 hour
            case '7d': return 6 * 60 * 60 * 1000; // 6 hours
            case '30d': return 24 * 60 * 60 * 1000; // 1 day
            default: return 5 * 60 * 1000;
        }
    }
    detectSecurityThreats(logs) {
        const threats = [];
        // SQL Injection Detection
        const sqlInjectionLogs = logs.filter(log => /(\bSELECT\b|\bUNION\b|\bINSERT\b|\bDELETE\b|\bDROP\b|\bUPDATE\b).*(\bFROM\b|\bWHERE\b)/i.test(log.path || '') ||
            /(union.*select|select.*from|insert.*into|delete.*from)/i.test(log.path || ''));
        if (sqlInjectionLogs.length > 0) {
            threats.push({
                type: 'sql_injection',
                severity: sqlInjectionLogs.length > 10 ? 'critical' : sqlInjectionLogs.length > 5 ? 'high' : 'medium',
                description: `Detected ${sqlInjectionLogs.length} potential SQL injection attempts`,
                count: sqlInjectionLogs.length,
                ips: [...new Set(sqlInjectionLogs.map(log => log.ip))],
                paths: [...new Set(sqlInjectionLogs.map(log => log.path || ''))]
            });
        }
        // XSS Detection
        const xssLogs = logs.filter(log => /<script|javascript:|onload=|onerror=|alert\(|document\.cookie/i.test(log.path || ''));
        if (xssLogs.length > 0) {
            threats.push({
                type: 'xss',
                severity: xssLogs.length > 5 ? 'high' : 'medium',
                description: `Detected ${xssLogs.length} potential XSS attempts`,
                count: xssLogs.length,
                ips: [...new Set(xssLogs.map(log => log.ip))],
                paths: [...new Set(xssLogs.map(log => log.path || ''))]
            });
        }
        // Path Traversal Detection
        const pathTraversalLogs = logs.filter(log => /(\.\.\/)|(\.\.\\)|(%2e%2e%2f)|(%2e%2e%5c)/i.test(log.path || ''));
        if (pathTraversalLogs.length > 0) {
            threats.push({
                type: 'path_traversal',
                severity: pathTraversalLogs.length > 5 ? 'high' : 'medium',
                description: `Detected ${pathTraversalLogs.length} potential path traversal attempts`,
                count: pathTraversalLogs.length,
                ips: [...new Set(pathTraversalLogs.map(log => log.ip))],
                paths: [...new Set(pathTraversalLogs.map(log => log.path || ''))]
            });
        }
        // Brute Force Detection (many 401/403 from same IP)
        const authFailures = new Map();
        logs.filter(log => log.status === 401 || log.status === 403).forEach(log => {
            authFailures.set(log.ip, (authFailures.get(log.ip) || 0) + 1);
        });
        authFailures.forEach((count, ip) => {
            if (count > 20) {
                threats.push({
                    type: 'brute_force',
                    severity: count > 100 ? 'critical' : count > 50 ? 'high' : 'medium',
                    description: `${count} authentication failures from ${ip}`,
                    count,
                    ips: [ip],
                    paths: []
                });
            }
        });
        // Suspicious User Agents
        const suspiciousUA = logs.filter(log => log.user_agent && (/nikto|sqlmap|nmap|metasploit|burpsuite|havij|acunetix|w3af/i.test(log.user_agent) ||
            log.user_agent.length < 10 ||
            /^[a-zA-Z]{1,5}$/.test(log.user_agent)));
        if (suspiciousUA.length > 0) {
            threats.push({
                type: 'suspicious_ua',
                severity: 'medium',
                description: `Detected ${suspiciousUA.length} requests with suspicious user agents`,
                count: suspiciousUA.length,
                ips: [...new Set(suspiciousUA.map(log => log.ip))],
                paths: [...new Set(suspiciousUA.map(log => log.path || ''))]
            });
        }
        return threats;
    }
    detectPerformanceIssues(logs, timeRange) {
        const issues = [];
        // High Error Rate
        const errorRate = this.calculateErrorRate(logs);
        if (errorRate > 5) {
            issues.push({
                type: 'high_error_rate',
                severity: errorRate > 15 ? 'critical' : errorRate > 10 ? 'high' : 'medium',
                description: `Error rate is ${errorRate.toFixed(2)}%`,
                value: errorRate,
                threshold: 5
            });
        }
        // Slow Response Times
        const avgResponseTime = this.calculateAvgResponseTime(logs);
        if (avgResponseTime > 1000) {
            issues.push({
                type: 'slow_response',
                severity: avgResponseTime > 5000 ? 'critical' : avgResponseTime > 3000 ? 'high' : 'medium',
                description: `Average response time is ${avgResponseTime.toFixed(0)}ms`,
                value: avgResponseTime,
                threshold: 1000
            });
        }
        // Traffic Spike Detection
        const pattern = this.getTrafficPattern(logs, timeRange);
        if (pattern.length > 1) {
            const avgRequests = pattern.reduce((sum, p) => sum + p.requests, 0) / pattern.length;
            const maxRequests = Math.max(...pattern.map(p => p.requests));
            if (maxRequests > avgRequests * 3) {
                issues.push({
                    type: 'traffic_spike',
                    severity: maxRequests > avgRequests * 10 ? 'critical' : 'high',
                    description: `Traffic spike detected: ${maxRequests} requests (${(maxRequests / avgRequests).toFixed(1)}x normal)`,
                    value: maxRequests,
                    threshold: avgRequests * 3
                });
            }
        }
        return issues;
    }
    async generateAlerts(domainName) {
        const analysis = await this.analyzeDomain(domainName, '1h');
        const alerts = [];
        const domain = await this.storage.getDomain(domainName);
        if (!domain)
            return alerts;
        // Generate alerts from security threats
        for (const threat of analysis.securityThreats) {
            await this.storage.addAlert(domain.id, `security_${threat.type}`, threat.description, threat.severity);
        }
        // Generate alerts from performance issues
        for (const issue of analysis.performanceIssues) {
            await this.storage.addAlert(domain.id, `performance_${issue.type}`, issue.description, issue.severity);
        }
        return alerts;
    }
    async calculateHealthScore(domainName) {
        const analysis = await this.analyzeDomain(domainName, '24h');
        let score = 100;
        // Deduct points for error rate
        score -= analysis.errorRate * 2;
        // Deduct points for slow response times
        if (analysis.avgResponseTime > 1000) {
            score -= Math.min(30, (analysis.avgResponseTime - 1000) / 100);
        }
        // Deduct points for security threats
        analysis.securityThreats.forEach(threat => {
            switch (threat.severity) {
                case 'critical':
                    score -= 20;
                    break;
                case 'high':
                    score -= 15;
                    break;
                case 'medium':
                    score -= 10;
                    break;
                case 'low':
                    score -= 5;
                    break;
            }
        });
        // Deduct points for performance issues
        analysis.performanceIssues.forEach(issue => {
            switch (issue.severity) {
                case 'critical':
                    score -= 15;
                    break;
                case 'high':
                    score -= 10;
                    break;
                case 'medium':
                    score -= 5;
                    break;
                case 'low':
                    score -= 2;
                    break;
            }
        });
        return Math.max(0, Math.round(score));
    }
}
exports.LogAnalyzer = LogAnalyzer;
//# sourceMappingURL=index.js.map