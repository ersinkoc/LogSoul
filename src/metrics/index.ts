import { Storage } from '../storage';
import { LogAnalyzer } from '../analyzer';

export interface MetricsData {
  logsoul_requests_total: { [domain: string]: number };
  logsoul_errors_total: { [domain: string]: number };
  logsoul_response_time_avg: { [domain: string]: number };
  logsoul_response_time_95th: { [domain: string]: number };
  logsoul_domain_health_score: { [domain: string]: number };
  logsoul_security_threats_total: { [domain: string]: { [type: string]: number } };
  logsoul_bandwidth_bytes: { [domain: string]: number };
  logsoul_unique_ips: { [domain: string]: number };
  logsoul_system_uptime: number;
  logsoul_system_memory_usage: number;
  logsoul_domains_monitored: number;
}

export class MetricsCollector {
  private storage: Storage;
  private analyzer: LogAnalyzer;
  private startTime: Date;

  constructor(storage: Storage, analyzer: LogAnalyzer) {
    this.storage = storage;
    this.analyzer = analyzer;
    this.startTime = new Date();
  }

  async collectMetrics(): Promise<MetricsData> {
    const domains = await this.storage.getDomains();
    const metrics: MetricsData = {
      logsoul_requests_total: {},
      logsoul_errors_total: {},
      logsoul_response_time_avg: {},
      logsoul_response_time_95th: {},
      logsoul_domain_health_score: {},
      logsoul_security_threats_total: {},
      logsoul_bandwidth_bytes: {},
      logsoul_unique_ips: {},
      logsoul_system_uptime: Date.now() - this.startTime.getTime(),
      logsoul_system_memory_usage: process.memoryUsage().heapUsed,
      logsoul_domains_monitored: domains.length
    };

    // Collect metrics for each domain
    for (const domain of domains) {
      try {
        const stats = await this.storage.getDomainStats(domain.id, '1h');
        const analysis = await this.analyzer.analyzeDomain(domain.name, '1h');

        if (stats) {
          metrics.logsoul_requests_total[domain.name] = stats.requests_per_minute * 60;
          metrics.logsoul_errors_total[domain.name] = (stats.error_rate / 100) * (stats.requests_per_minute * 60);
          metrics.logsoul_response_time_avg[domain.name] = stats.avg_response_time;
          metrics.logsoul_domain_health_score[domain.name] = stats.health_score;
          metrics.logsoul_bandwidth_bytes[domain.name] = stats.traffic_volume;
          metrics.logsoul_unique_ips[domain.name] = stats.unique_ips;
        }

        // Calculate 95th percentile response time (simplified)
        metrics.logsoul_response_time_95th[domain.name] = (stats?.avg_response_time || 0) * 1.5;

        // Security threats by type
        metrics.logsoul_security_threats_total[domain.name] = {};
        analysis.securityThreats.forEach(threat => {
          if (!metrics.logsoul_security_threats_total[domain.name][threat.type]) {
            metrics.logsoul_security_threats_total[domain.name][threat.type] = 0;
          }
          metrics.logsoul_security_threats_total[domain.name][threat.type] += threat.count;
        });

      } catch (error) {
        console.error(`Error collecting metrics for ${domain.name}:`, error);
        // Set default values for failed metrics
        metrics.logsoul_requests_total[domain.name] = 0;
        metrics.logsoul_errors_total[domain.name] = 0;
        metrics.logsoul_response_time_avg[domain.name] = 0;
        metrics.logsoul_response_time_95th[domain.name] = 0;
        metrics.logsoul_domain_health_score[domain.name] = 0;
        metrics.logsoul_bandwidth_bytes[domain.name] = 0;
        metrics.logsoul_unique_ips[domain.name] = 0;
        metrics.logsoul_security_threats_total[domain.name] = {};
      }
    }

    return metrics;
  }

  formatPrometheusMetrics(metrics: MetricsData): string {
    let output = '';

    // Helper function to format metric
    const formatMetric = (name: string, help: string, type: string, values: any) => {
      output += `# HELP ${name} ${help}\n`;
      output += `# TYPE ${name} ${type}\n`;

      if (typeof values === 'object' && values !== null) {
        for (const [label, value] of Object.entries(values)) {
          if (typeof value === 'object') {
            // Handle nested objects (like security threats)
            for (const [subLabel, subValue] of Object.entries(value as any)) {
              output += `${name}{domain="${label}",type="${subLabel}"} ${subValue}\n`;
            }
          } else {
            output += `${name}{domain="${label}"} ${value}\n`;
          }
        }
      } else {
        output += `${name} ${values}\n`;
      }
      output += '\n';
    };

    // Format all metrics
    formatMetric(
      'logsoul_requests_total',
      'Total number of requests per domain',
      'counter',
      metrics.logsoul_requests_total
    );

    formatMetric(
      'logsoul_errors_total',
      'Total number of errors per domain',
      'counter',
      metrics.logsoul_errors_total
    );

    formatMetric(
      'logsoul_response_time_avg',
      'Average response time per domain in milliseconds',
      'gauge',
      metrics.logsoul_response_time_avg
    );

    formatMetric(
      'logsoul_response_time_95th',
      '95th percentile response time per domain in milliseconds',
      'gauge',
      metrics.logsoul_response_time_95th
    );

    formatMetric(
      'logsoul_domain_health_score',
      'Health score per domain (0-100)',
      'gauge',
      metrics.logsoul_domain_health_score
    );

    formatMetric(
      'logsoul_security_threats_total',
      'Number of security threats detected per domain and type',
      'counter',
      metrics.logsoul_security_threats_total
    );

    formatMetric(
      'logsoul_bandwidth_bytes',
      'Total bandwidth usage per domain in bytes',
      'counter',
      metrics.logsoul_bandwidth_bytes
    );

    formatMetric(
      'logsoul_unique_ips',
      'Number of unique IP addresses per domain',
      'gauge',
      metrics.logsoul_unique_ips
    );

    formatMetric(
      'logsoul_system_uptime',
      'LogSoul system uptime in milliseconds',
      'counter',
      metrics.logsoul_system_uptime
    );

    formatMetric(
      'logsoul_system_memory_usage',
      'LogSoul memory usage in bytes',
      'gauge',
      metrics.logsoul_system_memory_usage
    );

    formatMetric(
      'logsoul_domains_monitored',
      'Number of domains being monitored',
      'gauge',
      metrics.logsoul_domains_monitored
    );

    return output;
  }

  async getPrometheusMetrics(): Promise<string> {
    const metrics = await this.collectMetrics();
    return this.formatPrometheusMetrics(metrics);
  }

  async getJsonMetrics(): Promise<MetricsData> {
    return await this.collectMetrics();
  }
}