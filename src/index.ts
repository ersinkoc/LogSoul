import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { LogDiscovery } from './discovery';
import { LogParser } from './parser';
import { Storage } from './storage';
import { FileMonitor } from './monitor';
import { LogAnalyzer } from './analyzer';
import { AlertManager } from './alerts';
import { createServer } from './api';
import { Config } from './types';

export class LogSoulApp {
  private config: Config;
  private storage: Storage;
  private discovery: LogDiscovery;
  private parser: LogParser;
  private monitor: FileMonitor;
  private analyzer: LogAnalyzer;
  private alertManager: AlertManager;
  private server?: any;

  constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
    this.storage = new Storage(this.config.storage.db_path);
    this.discovery = new LogDiscovery(this.config);
    this.parser = new LogParser();
    this.analyzer = new LogAnalyzer(this.storage);
    this.monitor = new FileMonitor(this.parser, this.storage, this.config);
    this.alertManager = new AlertManager(this.storage, this.analyzer, this.config);
    
    this.setupEventHandlers();
  }

  private loadConfig(configPath?: string): Config {
    const configPaths = [
      configPath,
      './logsoul.yaml',
      './configs/logsoul.yaml',
      path.join(__dirname, '../configs/logsoul.yaml')
    ].filter(Boolean);

    for (const configFile of configPaths) {
      if (configFile && fs.existsSync(configFile)) {
        try {
          const configContent = fs.readFileSync(configFile, 'utf8');
          console.log(`📄 Loaded config from: ${configFile}`);
          return yaml.load(configContent) as Config;
        } catch (error) {
          console.warn(`⚠️  Could not load config from ${configFile}: ${error}`);
        }
      }
    }

    console.log('📄 Using default configuration');
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): Config {
    return {
      server: { port: 3000, host: "0.0.0.0" },
      storage: { db_path: "./logsoul.db", retention_days: 30 },
      monitoring: { scan_interval: "60s", batch_size: 1000, max_file_size: "1GB" },
      alerts: { email: { enabled: false, smtp_server: "" }, webhook: { enabled: false, url: "" } },
      log_paths: ["/var/log/nginx", "/var/log/apache2", "/var/www/vhosts", "/home/*/logs", "/var/www/html"],
      ignore_patterns: ["health-check", "monitoring/ping", "favicon.ico", "robots.txt"],
      panel_paths: {
        plesk: "/var/www/vhosts/{domain}/logs/",
        cpanel: "/home/{user}/logs/",
        directadmin: "/var/log/httpd/domains/"
      }
    };
  }

  private setupEventHandlers(): void {
    // Handle new log entries from file monitor
    this.monitor.on('log-entry', async (entry) => {
      await this.alertManager.processLogEntry(entry);
    });

    // Handle file monitoring events
    this.monitor.on('file-added', (filePath) => {
      console.log(`👀 Now monitoring: ${filePath}`);
    });

    this.monitor.on('file-removed', (filePath) => {
      console.log(`🚫 Stopped monitoring: ${filePath}`);
    });

    this.monitor.on('error', (error, filePath) => {
      console.error(`❌ File monitor error for ${filePath}:`, error.message);
    });

    // Handle alert events
    this.alertManager.on('alert', ({ domain, rule, message }) => {
      console.log(`🚨 Alert: ${message}`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      this.shutdown().then(() => {
        console.log('👋 LogSoul stopped gracefully');
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      this.shutdown().then(() => {
        console.log('👋 LogSoul stopped gracefully');
        process.exit(0);
      });
    });
  }

  async initialize(): Promise<void> {
    console.log('🔮 LogSoul initializing...');
    
    // Discover domains and log files
    console.log('🔍 Discovering domains and log files...');
    const discoveryResult = await this.discovery.discoverLogs();
    
    console.log(`📁 Found ${discoveryResult.log_files.length} log files`);
    console.log(`🌐 Found ${discoveryResult.domains.size} domains`);
    
    if (discoveryResult.errors.length > 0) {
      console.log(`⚠️  ${discoveryResult.errors.length} discovery errors occurred`);
      discoveryResult.errors.slice(0, 3).forEach(error => {
        console.log(`   ${error}`);
      });
    }

    // Add discovered domains to database
    for (const domain of discoveryResult.domains) {
      await this.storage.addDomain(domain);
    }

    // Start monitoring discovered log files
    console.log('👀 Starting file monitoring...');
    await this.monitor.start();
    
    for (const logFile of discoveryResult.log_files) {
      await this.monitor.watchFile(logFile);
    }

    // Start alert manager
    console.log('🚨 Starting alert manager...');
    this.alertManager.start();

    console.log('✅ LogSoul initialized successfully!');
  }

  async startServer(port?: number, host?: string): Promise<void> {
    const serverPort = port || this.config.server.port;
    const serverHost = host || this.config.server.host;

    console.log('🚀 Starting LogSoul web server...');
    
    this.server = createServer(this.config, this.storage, this.discovery, this.parser);
    
    await new Promise<void>((resolve, reject) => {
      this.server.listen(serverPort, serverHost, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🌐 LogSoul server running on http://${serverHost}:${serverPort}`);
          console.log(`📊 Dashboard: http://${serverHost}:${serverPort}`);
          resolve();
        }
      });
    });
  }

  async discoverAndAdd(): Promise<void> {
    console.log('🔍 Running discovery scan...');
    
    const result = await this.discovery.discoverLogs();
    
    for (const domain of result.domains) {
      await this.storage.addDomain(domain);
    }

    console.log(`✅ Discovery complete: ${result.domains.size} domains, ${result.log_files.length} log files`);
  }

  async analyzeDomain(domainName: string, timeRange: string = '1h'): Promise<void> {
    console.log(`🔍 Analyzing ${domainName} (last ${timeRange})...`);
    
    const analysis = await this.analyzer.analyzeDomain(domainName, timeRange);
    
    console.log(`📊 Analysis Results for ${domainName}:`);
    console.log(`   Total Requests: ${analysis.totalRequests}`);
    console.log(`   Error Rate: ${analysis.errorRate.toFixed(2)}%`);
    console.log(`   Avg Response Time: ${analysis.avgResponseTime.toFixed(2)}ms`);
    
    if (analysis.topPages.length > 0) {
      console.log('   Top Pages:');
      analysis.topPages.slice(0, 5).forEach(([path, count], i) => {
        console.log(`     ${i + 1}. ${path} (${count} requests)`);
      });
    }

    if (analysis.securityThreats.length > 0) {
      console.log(`   🚨 Security Threats: ${analysis.securityThreats.length}`);
      analysis.securityThreats.forEach(threat => {
        console.log(`     ${threat.type}: ${threat.description} (${threat.severity})`);
      });
    }

    if (analysis.performanceIssues.length > 0) {
      console.log(`   ⚡ Performance Issues: ${analysis.performanceIssues.length}`);
      analysis.performanceIssues.forEach(issue => {
        console.log(`     ${issue.type}: ${issue.description} (${issue.severity})`);
      });
    }
  }

  async generateHealthScores(): Promise<void> {
    console.log('💊 Calculating health scores...');
    
    const domains = await this.storage.getDomains();
    
    for (const domain of domains) {
      const healthScore = await this.analyzer.calculateHealthScore(domain.name);
      
      // Update health score in database (would need to add this method to Storage)
      console.log(`${domain.name}: ${healthScore}/100`);
    }
  }

  async cleanupOldData(): Promise<void> {
    console.log('🧹 Cleaning up old data...');
    
    const deletedCount = await this.storage.cleanupOldLogs(this.config.storage.retention_days);
    
    console.log(`✅ Cleaned up ${deletedCount} old log entries`);
  }

  async shutdown(): Promise<void> {
    console.log('⏹️  Shutting down LogSoul...');
    
    // Stop alert manager
    this.alertManager.stop();
    
    // Stop file monitor
    await this.monitor.stop();
    
    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => resolve());
      });
    }
    
    // Close database
    await this.storage.close();
  }

  // Getters for components (useful for testing)
  getStorage(): Storage { return this.storage; }
  getDiscovery(): LogDiscovery { return this.discovery; }
  getParser(): LogParser { return this.parser; }
  getMonitor(): FileMonitor { return this.monitor; }
  getAnalyzer(): LogAnalyzer { return this.analyzer; }
  getAlertManager(): AlertManager { return this.alertManager; }
  getConfig(): Config { return this.config; }
}

// Export main class and utility function
export * from './types';
export { LogDiscovery } from './discovery';
export { LogParser } from './parser';
export { Storage } from './storage';
export { FileMonitor } from './monitor';
export { LogAnalyzer } from './analyzer';
export { AlertManager } from './alerts';

// Main entry point when run directly
if (require.main === module) {
  const app = new LogSoulApp();
  
  app.initialize()
    .then(() => app.startServer())
    .catch(error => {
      console.error('❌ Failed to start LogSoul:', error);
      process.exit(1);
    });
}