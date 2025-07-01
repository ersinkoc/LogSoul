#!/usr/bin/env node
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const discovery_1 = require("../discovery");
const parser_1 = require("../parser");
const storage_1 = require("../storage");
const program = new commander_1.Command();
class LogSoulCLI {
    constructor() {
        this.config = this.loadConfig();
        this.storage = new storage_1.Storage(this.config.storage.db_path);
        this.discovery = new discovery_1.LogDiscovery(this.config);
        this.parser = new parser_1.LogParser();
    }
    loadConfig() {
        const configPaths = [
            './logsoul.yaml',
            './configs/logsoul.yaml',
            path.join(__dirname, '../../configs/logsoul.yaml')
        ];
        for (const configPath of configPaths) {
            if (fs.existsSync(configPath)) {
                try {
                    const configContent = fs.readFileSync(configPath, 'utf8');
                    return yaml.load(configContent);
                }
                catch (error) {
                    console.warn(chalk_1.default.yellow(`Warning: Could not load config from ${configPath}`));
                }
            }
        }
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
    async init() {
        console.log(chalk_1.default.blue('🚀 Initializing LogSoul...'));
        if (!fs.existsSync('./logsoul.yaml')) {
            const configContent = yaml.dump(this.config, { indent: 2 });
            fs.writeFileSync('./logsoul.yaml', configContent);
            console.log(chalk_1.default.green('✅ Created logsoul.yaml configuration file'));
        }
        console.log(chalk_1.default.green('✅ LogSoul initialized successfully!'));
        console.log(chalk_1.default.dim('Next steps:'));
        console.log(chalk_1.default.dim('  logsoul discover  # Find all domains and logs'));
        console.log(chalk_1.default.dim('  logsoul server    # Start web interface'));
    }
    async discover() {
        console.log(chalk_1.default.blue('🔍 Discovering log files and domains...'));
        const result = await this.discovery.discoverLogs();
        console.log(chalk_1.default.green(`\n✅ Discovery complete!`));
        console.log(chalk_1.default.white(`📁 Found ${result.log_files.length} log files`));
        console.log(chalk_1.default.white(`🌐 Found ${result.domains.size} domains:`));
        const sortedDomains = Array.from(result.domains).sort();
        for (const domain of sortedDomains) {
            const domainFiles = result.log_files.filter(f => f.domain === domain);
            console.log(chalk_1.default.cyan(`  ${domain} (${domainFiles.length} files)`));
        }
        if (result.errors.length > 0) {
            console.log(chalk_1.default.yellow(`\n⚠️  ${result.errors.length} errors occurred:`));
            result.errors.slice(0, 5).forEach(error => {
                console.log(chalk_1.default.red(`  ${error}`));
            });
            if (result.errors.length > 5) {
                console.log(chalk_1.default.red(`  ... and ${result.errors.length - 5} more`));
            }
        }
        for (const domain of result.domains) {
            await this.storage.addDomain(domain);
        }
    }
    async listDomains() {
        const domains = await this.storage.getDomains();
        if (domains.length === 0) {
            console.log(chalk_1.default.yellow('No domains found. Run "logsoul discover" first.'));
            return;
        }
        console.log(chalk_1.default.blue('📋 Monitored Domains:\n'));
        for (const domain of domains) {
            const stats = await this.storage.getDomainStats(domain.id);
            const healthScore = stats?.health_score ?? 100;
            const healthColor = healthScore >= 80 ? 'green' :
                healthScore >= 60 ? 'yellow' : 'red';
            console.log(chalk_1.default.white(`🌐 ${domain.name}`));
            console.log(chalk_1.default.gray(`   Last seen: ${domain.last_seen.toLocaleString()}`));
            if (stats) {
                console.log(chalk_1.default[healthColor](`   Health: ${healthScore}/100`));
                console.log(chalk_1.default.gray(`   Requests/min: ${stats.requests_per_minute.toFixed(1)}`));
                console.log(chalk_1.default.gray(`   Error rate: ${stats.error_rate.toFixed(1)}%`));
            }
            console.log();
        }
    }
    async addDomain(domainName) {
        try {
            await this.storage.addDomain(domainName);
            console.log(chalk_1.default.green(`✅ Added domain: ${domainName}`));
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Failed to add domain: ${error}`));
        }
    }
    async watchDomain(domainName, options) {
        const domain = await this.storage.getDomain(domainName);
        if (!domain) {
            console.error(chalk_1.default.red(`❌ Domain not found: ${domainName}`));
            console.log(chalk_1.default.dim('Run "logsoul discover" or "logsoul add <domain>" first'));
            return;
        }
        console.log(chalk_1.default.blue(`👀 Watching logs for ${domainName}...`));
        console.log(chalk_1.default.dim('Press Ctrl+C to stop\n'));
        const logFiles = await this.discovery.findDomainLogs(domainName);
        if (logFiles.length === 0) {
            console.log(chalk_1.default.yellow(`No log files found for ${domainName}`));
            return;
        }
        for (const logFile of logFiles) {
            console.log(chalk_1.default.dim(`📁 ${logFile.path}`));
            try {
                for await (const entry of this.parser.streamFile(logFile.path, domain.id)) {
                    if (this.shouldShowEntry(entry, options)) {
                        this.displayLogEntry(entry, options);
                    }
                }
            }
            catch (error) {
                console.error(chalk_1.default.red(`Error reading ${logFile.path}: ${error}`));
            }
        }
    }
    shouldShowEntry(entry, options) {
        if (options.errorsOnly && entry.status < 400) {
            return false;
        }
        if (options.status && entry.status !== parseInt(options.status)) {
            return false;
        }
        if (options.ip && entry.ip !== options.ip) {
            return false;
        }
        return true;
    }
    displayLogEntry(entry, options) {
        const timestamp = entry.timestamp.toISOString();
        const statusColor = entry.status >= 500 ? 'red' :
            entry.status >= 400 ? 'yellow' :
                entry.status >= 300 ? 'blue' : 'green';
        const line = `[${chalk_1.default.gray(timestamp)}] ${chalk_1.default[statusColor](entry.status)} ${entry.method} ${entry.path} - ${entry.ip}`;
        console.log(line);
    }
    async showStats(domainName, options) {
        const domain = await this.storage.getDomain(domainName);
        if (!domain) {
            console.error(chalk_1.default.red(`❌ Domain not found: ${domainName}`));
            return;
        }
        const timeRange = options.hour ? '1h' :
            options.day ? '24h' :
                options.week ? '7d' : '1h';
        const stats = await this.storage.getDomainStats(domain.id, timeRange);
        if (!stats) {
            console.log(chalk_1.default.yellow(`No statistics available for ${domainName} in the last ${timeRange}`));
            return;
        }
        console.log(chalk_1.default.blue(`📊 Statistics for ${domainName} (last ${timeRange}):\n`));
        const healthColor = stats.health_score >= 80 ? 'green' :
            stats.health_score >= 60 ? 'yellow' : 'red';
        console.log(chalk_1.default.white(`Health Score: ${chalk_1.default[healthColor](stats.health_score + '/100')}`));
        console.log(chalk_1.default.white(`Requests/minute: ${chalk_1.default.cyan(stats.requests_per_minute.toFixed(1))}`));
        console.log(chalk_1.default.white(`Error rate: ${chalk_1.default.red(stats.error_rate.toFixed(1) + '%')}`));
        console.log(chalk_1.default.white(`Avg response time: ${chalk_1.default.yellow(stats.avg_response_time.toFixed(2) + 'ms')}`));
        console.log(chalk_1.default.white(`Traffic volume: ${chalk_1.default.magenta(this.formatBytes(stats.traffic_volume))}`));
        console.log(chalk_1.default.white(`Unique IPs: ${chalk_1.default.blue(stats.unique_ips.toString())}`));
    }
    async analyze(domainName, options) {
        const domain = await this.storage.getDomain(domainName);
        if (!domain) {
            console.error(chalk_1.default.red(`❌ Domain not found: ${domainName}`));
            return;
        }
        console.log(chalk_1.default.blue(`🔍 Analyzing ${domainName}...`));
        const timeRange = options.hour ? '1h' :
            options.day ? '24h' :
                options.week ? '7d' : '1h';
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
        }
        const logs = await this.storage.getLogsByTimeRange(domain.id, startTime, endTime);
        if (logs.length === 0) {
            console.log(chalk_1.default.yellow(`No logs found for ${domainName} in the specified time range`));
            return;
        }
        const analysis = this.analyzeLogs(logs);
        console.log(chalk_1.default.green(`\n✅ Analysis complete (${logs.length} entries):\n`));
        console.log(chalk_1.default.white('🔝 Top 10 Pages:'));
        analysis.topPages.slice(0, 10).forEach(([path, count], i) => {
            console.log(chalk_1.default.cyan(`  ${i + 1}. ${path} (${count} requests)`));
        });
        console.log(chalk_1.default.white('\n🌍 Top 10 IPs:'));
        analysis.topIPs.slice(0, 10).forEach(([ip, count], i) => {
            console.log(chalk_1.default.yellow(`  ${i + 1}. ${ip} (${count} requests)`));
        });
        console.log(chalk_1.default.white('\n❌ Top 10 Error Pages:'));
        analysis.topErrors.slice(0, 10).forEach(([path, count], i) => {
            console.log(chalk_1.default.red(`  ${i + 1}. ${path} (${count} errors)`));
        });
    }
    analyzeLogs(logs) {
        const pages = new Map();
        const ips = new Map();
        const errors = new Map();
        for (const log of logs) {
            pages.set(log.path, (pages.get(log.path) || 0) + 1);
            ips.set(log.ip, (ips.get(log.ip) || 0) + 1);
            if (log.status >= 400) {
                errors.set(log.path, (errors.get(log.path) || 0) + 1);
            }
        }
        return {
            topPages: Array.from(pages.entries()).sort((a, b) => b[1] - a[1]),
            topIPs: Array.from(ips.entries()).sort((a, b) => b[1] - a[1]),
            topErrors: Array.from(errors.entries()).sort((a, b) => b[1] - a[1])
        };
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    async startServer() {
        console.log(chalk_1.default.blue('🚀 Starting LogSoul web server...'));
        console.log(chalk_1.default.green(`🌐 Server will be available at http://localhost:${this.config.server.port}`));
        const { createServer } = await Promise.resolve().then(() => __importStar(require('../api')));
        const server = createServer(this.config, this.storage, this.discovery, this.parser);
        server.listen(this.config.server.port, this.config.server.host, () => {
            console.log(chalk_1.default.green(`✅ LogSoul server running on http://${this.config.server.host}:${this.config.server.port}`));
        });
    }
    async generateTestData() {
        console.log(chalk_1.default.blue('🧪 Generating test data...'));
        const { generateTestLogs } = await Promise.resolve().then(() => __importStar(require('../test-data-generator')));
        await generateTestLogs();
        console.log(chalk_1.default.green('✅ Test data generated!'));
    }
}
const cli = new LogSoulCLI();
program
    .name('logsoul')
    .description('LogSoul - Feel the pulse of your domains')
    .version('1.0.0');
program
    .command('init')
    .description('Initialize LogSoul')
    .action(() => cli.init());
program
    .command('discover')
    .description('Find all domains and logs')
    .action(() => cli.discover());
program
    .command('list')
    .description('List monitored domains')
    .action(() => cli.listDomains());
program
    .command('add <domain>')
    .description('Add domain manually')
    .action((domain) => cli.addDomain(domain));
program
    .command('watch <domain>')
    .description('Live tail all logs for domain')
    .option('--errors-only', 'Show only error logs')
    .option('--status <code>', 'Filter by status code')
    .option('--ip <address>', 'Filter by IP address')
    .action((domain, options) => cli.watchDomain(domain, options));
program
    .command('stats <domain>')
    .description('Show current stats for domain')
    .option('--hour', 'Last hour stats')
    .option('--day', 'Last 24 hours stats')
    .option('--week', 'Last week stats')
    .action((domain, options) => cli.showStats(domain, options));
program
    .command('analyze <domain>')
    .description('Analyze domain logs')
    .option('--hour', 'Analyze last hour')
    .option('--day', 'Analyze last 24 hours')
    .option('--week', 'Analyze last week')
    .action((domain, options) => cli.analyze(domain, options));
program
    .command('server')
    .description('Start web interface')
    .action(() => cli.startServer());
program
    .command('test')
    .description('Generate test data')
    .action(() => cli.generateTestData());
if (require.main === module) {
    program.parse();
}
//# sourceMappingURL=index.js.map