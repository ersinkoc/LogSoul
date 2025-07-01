#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { LogDiscovery } from '../discovery';
import { LogParser } from '../parser';
import { Storage } from '../storage';
import { FileMonitor } from '../monitor';
import { Config } from '../types';
import { i18n, t } from '../i18n';

const program = new Command();

class LogSoulCLI {
  private config: Config;
  private storage: Storage;
  private discovery: LogDiscovery;
  private parser: LogParser;
  private monitor?: FileMonitor;

  constructor() {
    this.loadLanguagePreference();
    this.config = this.loadConfig();
    this.storage = new Storage(this.config.storage.db_path);
    this.discovery = new LogDiscovery(this.config);
    this.parser = new LogParser();
  }

  private loadConfig(): Config {
    const configPaths = [
      './logsoul.yaml',
      './configs/logsoul.yaml',
      path.join(__dirname, '../../configs/logsoul.yaml')
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const configContent = fs.readFileSync(configPath, 'utf8');
          return yaml.load(configContent) as Config;
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Could not load config from ${configPath}`));
        }
      }
    }

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

  async init(): Promise<void> {
    console.log(chalk.blue(t('cli.init.title')));
    
    if (!fs.existsSync('./logsoul.yaml')) {
      const configContent = yaml.dump(this.config, { indent: 2 });
      fs.writeFileSync('./logsoul.yaml', configContent);
      console.log(chalk.green(t('cli.init.configCreated')));
    }

    console.log(chalk.green(t('cli.init.success')));
    console.log(chalk.dim(t('cli.init.nextSteps')));
    console.log(chalk.dim(`  ${t('cli.init.discover')}`));
    console.log(chalk.dim(`  ${t('cli.init.server')}`));
  }

  async discover(): Promise<void> {
    console.log(chalk.blue(t('cli.discover.title')));
    
    const result = await this.discovery.discoverLogs();
    
    console.log(chalk.green(`\n${t('cli.discover.complete')}`));
    console.log(chalk.white(t('cli.discover.logFiles', result.log_files.length)));
    console.log(chalk.white(t('cli.discover.domains', result.domains.size)));
    
    const sortedDomains = Array.from(result.domains).sort();
    for (const domain of sortedDomains) {
      const domainFiles = result.log_files.filter(f => f.domain === domain);
      console.log(chalk.cyan(`  ${domain} (${domainFiles.length} files)`));
    }

    if (result.errors.length > 0) {
      console.log(chalk.yellow(`\n${t('cli.discover.errors', result.errors.length)}`));
      result.errors.slice(0, 5).forEach(error => {
        console.log(chalk.red(`  ${error}`));
      });
      if (result.errors.length > 5) {
        console.log(chalk.red(`  ... and ${result.errors.length - 5} more`));
      }
    }

    for (const domain of result.domains) {
      await this.storage.addDomain(domain);
    }
  }

  async listDomains(): Promise<void> {
    const domains = await this.storage.getDomains();
    
    if (domains.length === 0) {
      console.log(chalk.yellow(t('cli.list.empty')));
      return;
    }

    console.log(chalk.blue(t('cli.list.title') + '\n'));
    
    for (const domain of domains) {
      const stats = await this.storage.getDomainStats(domain.id);
      const healthScore = stats?.health_score ?? 100;
      const healthColor = healthScore >= 80 ? 'green' : 
                         healthScore >= 60 ? 'yellow' : 'red';
      
      console.log(chalk.white(`🌐 ${domain.name}`));
      console.log(chalk.gray(`   ${t('cli.list.lastSeen', domain.last_seen.toLocaleString())}`));
      if (stats) {
        console.log(chalk[healthColor](`   ${t('cli.list.health', healthScore)}`));
        console.log(chalk.gray(`   ${t('cli.list.requests', stats.requests_per_minute.toFixed(1))}`));
        console.log(chalk.gray(`   ${t('cli.list.errorRate', stats.error_rate.toFixed(1))}`));
      }
      console.log();
    }
  }

  async addDomain(domainName: string): Promise<void> {
    try {
      await this.storage.addDomain(domainName);
      console.log(chalk.green(t('cli.success.domainAdded', domainName)));
    } catch (error) {
      console.error(chalk.red(t('cli.errors.addFailed', error)));
    }
  }

  async watchDomain(domainName: string, options: any): Promise<void> {
    const domain = await this.storage.getDomain(domainName);
    if (!domain) {
      console.error(chalk.red(t('cli.errors.domainNotFound', domainName)));
      console.log(chalk.dim(t('cli.errors.discoverFirst')));
      return;
    }

    console.log(chalk.blue(t('cli.watch.title', domainName)));
    console.log(chalk.dim(t('cli.watch.stop') + '\n'));

    const logFiles = await this.discovery.findDomainLogs(domainName);
    if (logFiles.length === 0) {
      console.log(chalk.yellow(t('cli.watch.noLogs', domainName)));
      return;
    }

    for (const logFile of logFiles) {
      console.log(chalk.dim(`📁 ${logFile.path}`));
      
      try {
        for await (const entry of this.parser.streamFile(logFile.path, domain.id)) {
          if (this.shouldShowEntry(entry, options)) {
            this.displayLogEntry(entry, options);
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error reading ${logFile.path}: ${error}`));
      }
    }
  }

  private shouldShowEntry(entry: any, options: any): boolean {
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

  private displayLogEntry(entry: any, options: any): void {
    const timestamp = entry.timestamp.toISOString();
    const statusColor = entry.status >= 500 ? 'red' :
                       entry.status >= 400 ? 'yellow' :
                       entry.status >= 300 ? 'blue' : 'green';

    const line = `[${chalk.gray(timestamp)}] ${chalk[statusColor](entry.status)} ${entry.method} ${entry.path} - ${entry.ip}`;
    console.log(line);
  }

  async showStats(domainName: string, options: any): Promise<void> {
    const domain = await this.storage.getDomain(domainName);
    if (!domain) {
      console.error(chalk.red(t('cli.errors.domainNotFound', domainName)));
      return;
    }

    const timeRange = options.hour ? '1h' : 
                     options.day ? '24h' : 
                     options.week ? '7d' : '1h';

    const stats = await this.storage.getDomainStats(domain.id, timeRange);
    if (!stats) {
      console.log(chalk.yellow(t('cli.stats.noData', domainName, timeRange)));
      return;
    }

    console.log(chalk.blue(t('cli.stats.title', domainName, timeRange) + '\n'));
    
    const healthColor = stats.health_score >= 80 ? 'green' : 
                       stats.health_score >= 60 ? 'yellow' : 'red';
    
    console.log(chalk.white(t('cli.stats.healthScore', chalk[healthColor](stats.health_score))));
    console.log(chalk.white(t('cli.stats.requestsPerMin', chalk.cyan(stats.requests_per_minute.toFixed(1)))));
    console.log(chalk.white(t('cli.stats.errorRate', chalk.red(stats.error_rate.toFixed(1)))));
    console.log(chalk.white(t('cli.stats.avgResponseTime', chalk.yellow(stats.avg_response_time.toFixed(2)))));
    console.log(chalk.white(t('cli.stats.trafficVolume', chalk.magenta(this.formatBytes(stats.traffic_volume)))));
    console.log(chalk.white(t('cli.stats.uniqueIPs', chalk.blue(stats.unique_ips.toString()))));
  }

  async analyze(domainName: string, options: any): Promise<void> {
    const domain = await this.storage.getDomain(domainName);
    if (!domain) {
      console.error(chalk.red(t('cli.errors.domainNotFound', domainName)));
      return;
    }

    console.log(chalk.blue(t('cli.analyze.title', domainName, options.hour ? '1h' : options.day ? '24h' : options.week ? '7d' : '1h')));
    
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
      console.log(chalk.yellow(t('cli.analyze.noLogs', domainName)));
      return;
    }

    const analysis = this.analyzeLogs(logs);
    
    console.log(chalk.green(`\n${t('cli.analyze.complete', logs.length)}\n`));
    
    console.log(chalk.white(t('cli.analyze.topPages')));
    analysis.topPages.slice(0, 10).forEach(([path, count]: [string, number], i: number) => {
      console.log(chalk.cyan(`  ${i + 1}. ${path} (${count} requests)`));
    });

    console.log(chalk.white('\n' + t('cli.analyze.topIPs')));
    analysis.topIPs.slice(0, 10).forEach(([ip, count]: [string, number], i: number) => {
      console.log(chalk.yellow(`  ${i + 1}. ${ip} (${count} requests)`));
    });

    console.log(chalk.white('\n' + t('cli.analyze.topErrors')));
    analysis.topErrors.slice(0, 10).forEach(([path, count]: [string, number], i: number) => {
      console.log(chalk.red(`  ${i + 1}. ${path} (${count} errors)`));
    });
  }

  private analyzeLogs(logs: any[]): any {
    const pages = new Map<string, number>();
    const ips = new Map<string, number>();
    const errors = new Map<string, number>();

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

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async startServer(): Promise<void> {
    console.log(chalk.blue(t('cli.server.starting')));
    console.log(chalk.green(t('cli.server.available', this.config.server.port)));
    
    const { createServer } = await import('../api');
    const server = createServer(this.config, this.storage, this.discovery, this.parser);
    
    server.listen(this.config.server.port, this.config.server.host, () => {
      console.log(chalk.green(t('cli.server.running', this.config.server.host, this.config.server.port)));
      console.log(chalk.blue(t('cli.server.dashboard', this.config.server.host, this.config.server.port)));
    });
  }

  async generateTestData(): Promise<void> {
    console.log(chalk.blue('🧪 Generating test data...'));
    
    const { generateTestLogs } = await import('../test-data-generator');
    await generateTestLogs();
    
    console.log(chalk.green(t('cli.success.testDataGenerated')));
  }

  private loadLanguagePreference(): void {
    const configPath = './logsoul-cli.json';
    try {
      if (fs.existsSync(configPath)) {
        const cliConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (cliConfig.language && (cliConfig.language === 'en' || cliConfig.language === 'tr')) {
          i18n.setLocale(cliConfig.language);
        }
      }
    } catch (error) {
      // Ignore errors, use default language
    }
  }

  private saveLanguagePreference(lang: 'en' | 'tr'): void {
    const configPath = './logsoul-cli.json';
    const cliConfig = { language: lang };
    try {
      fs.writeFileSync(configPath, JSON.stringify(cliConfig, null, 2));
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not save language preference: ${error}`));
    }
  }

  setLanguage(lang: 'en' | 'tr'): void {
    i18n.setLocale(lang);
    this.saveLanguagePreference(lang);
    console.log(chalk.green(`✅ Language set to: ${lang === 'tr' ? 'Türkçe' : 'English'}`));
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

program
  .command('lang <language>')
  .description('Set language (en|tr)')
  .action((language) => {
    if (language === 'en' || language === 'tr') {
      cli.setLanguage(language);
    } else {
      console.error(chalk.red('❌ Supported languages: en, tr'));
    }
  });

if (require.main === module) {
  program.parse();
}