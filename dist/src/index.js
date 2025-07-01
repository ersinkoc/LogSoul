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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertManager = exports.LogAnalyzer = exports.FileMonitor = exports.Storage = exports.LogParser = exports.LogDiscovery = exports.LogSoulApp = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const discovery_1 = require("./discovery");
const parser_1 = require("./parser");
const storage_1 = require("./storage");
const monitor_1 = require("./monitor");
const analyzer_1 = require("./analyzer");
const alerts_1 = require("./alerts");
const api_1 = require("./api");
class LogSoulApp {
    constructor(configPath) {
        this.config = this.loadConfig(configPath);
        this.storage = new storage_1.Storage(this.config.storage.db_path);
        this.discovery = new discovery_1.LogDiscovery(this.config);
        this.parser = new parser_1.LogParser();
        this.analyzer = new analyzer_1.LogAnalyzer(this.storage);
        this.monitor = new monitor_1.FileMonitor(this.parser, this.storage, this.config);
        this.alertManager = new alerts_1.AlertManager(this.storage, this.analyzer, this.config);
        this.setupEventHandlers();
    }
    loadConfig(configPath) {
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
                    return yaml.load(configContent);
                }
                catch (error) {
                    console.warn(`⚠️  Could not load config from ${configFile}: ${error}`);
                }
            }
        }
        console.log('📄 Using default configuration');
        return this.getDefaultConfig();
    }
    getDefaultConfig() {
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
    setupEventHandlers() {
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
    async initialize() {
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
    async startServer(port, host) {
        const serverPort = port || this.config.server.port;
        const serverHost = host || this.config.server.host;
        console.log('🚀 Starting LogSoul web server...');
        this.server = (0, api_1.createServer)(this.config, this.storage, this.discovery, this.parser);
        await new Promise((resolve, reject) => {
            this.server.listen(serverPort, serverHost, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    console.log(`🌐 LogSoul server running on http://${serverHost}:${serverPort}`);
                    console.log(`📊 Dashboard: http://${serverHost}:${serverPort}`);
                    resolve();
                }
            });
        });
    }
    async discoverAndAdd() {
        console.log('🔍 Running discovery scan...');
        const result = await this.discovery.discoverLogs();
        for (const domain of result.domains) {
            await this.storage.addDomain(domain);
        }
        console.log(`✅ Discovery complete: ${result.domains.size} domains, ${result.log_files.length} log files`);
    }
    async analyzeDomain(domainName, timeRange = '1h') {
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
    async generateHealthScores() {
        console.log('💊 Calculating health scores...');
        const domains = await this.storage.getDomains();
        for (const domain of domains) {
            const healthScore = await this.analyzer.calculateHealthScore(domain.name);
            // Update health score in database (would need to add this method to Storage)
            console.log(`${domain.name}: ${healthScore}/100`);
        }
    }
    async cleanupOldData() {
        console.log('🧹 Cleaning up old data...');
        const deletedCount = await this.storage.cleanupOldLogs(this.config.storage.retention_days);
        console.log(`✅ Cleaned up ${deletedCount} old log entries`);
    }
    async shutdown() {
        console.log('⏹️  Shutting down LogSoul...');
        // Stop alert manager
        this.alertManager.stop();
        // Stop file monitor
        await this.monitor.stop();
        // Close server
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(() => resolve());
            });
        }
        // Close database
        await this.storage.close();
    }
    // Getters for components (useful for testing)
    getStorage() { return this.storage; }
    getDiscovery() { return this.discovery; }
    getParser() { return this.parser; }
    getMonitor() { return this.monitor; }
    getAnalyzer() { return this.analyzer; }
    getAlertManager() { return this.alertManager; }
    getConfig() { return this.config; }
}
exports.LogSoulApp = LogSoulApp;
// Export main class and utility function
__exportStar(require("./types"), exports);
var discovery_2 = require("./discovery");
Object.defineProperty(exports, "LogDiscovery", { enumerable: true, get: function () { return discovery_2.LogDiscovery; } });
var parser_2 = require("./parser");
Object.defineProperty(exports, "LogParser", { enumerable: true, get: function () { return parser_2.LogParser; } });
var storage_2 = require("./storage");
Object.defineProperty(exports, "Storage", { enumerable: true, get: function () { return storage_2.Storage; } });
var monitor_2 = require("./monitor");
Object.defineProperty(exports, "FileMonitor", { enumerable: true, get: function () { return monitor_2.FileMonitor; } });
var analyzer_2 = require("./analyzer");
Object.defineProperty(exports, "LogAnalyzer", { enumerable: true, get: function () { return analyzer_2.LogAnalyzer; } });
var alerts_2 = require("./alerts");
Object.defineProperty(exports, "AlertManager", { enumerable: true, get: function () { return alerts_2.AlertManager; } });
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
//# sourceMappingURL=index.js.map