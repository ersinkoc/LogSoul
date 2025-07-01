import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { LogFile, DiscoveryResult, Config } from '../types';

export class LogDiscovery {
  private config: Config;
  private logPatterns = [
    '**/*access*.log*',
    '**/*error*.log*',
    '**/*access_log*',
    '**/*error_log*',
    '**/access.log*',
    '**/error.log*',
    '**/app.log*',
    '**/debug.log*',
    '**/application.log*'
  ];

  private domainPatterns = [
    /\/var\/log\/nginx\/([^\/]+)/,
    /\/var\/log\/apache2\/([^\/]+)/,
    /\/var\/www\/vhosts\/([^\/]+)\/logs/,
    /\/home\/([^\/]+)\/logs/,
    /\/var\/www\/html\/([^\/]+)\/logs/,
    /\/var\/log\/httpd\/domains\/([^\/]+)/
  ];

  constructor(config: Config) {
    this.config = config;
  }

  async discoverLogs(): Promise<DiscoveryResult> {
    const result: DiscoveryResult = {
      domains: new Set<string>(),
      log_files: [],
      errors: []
    };

    console.log('🔍 Discovering log files...');

    for (const basePath of this.config.log_paths) {
      try {
        await this.scanPath(basePath, result);
      } catch (error) {
        result.errors.push(`Failed to scan ${basePath}: ${error}`);
      }
    }

    console.log(`✅ Found ${result.log_files.length} log files for ${result.domains.size} domains`);
    return result;
  }

  private async scanPath(basePath: string, result: DiscoveryResult): Promise<void> {
    if (!fs.existsSync(basePath)) {
      result.errors.push(`Path does not exist: ${basePath}`);
      return;
    }

    try {
      const stats = fs.statSync(basePath);
      if (!stats.isDirectory()) {
        return;
      }
    } catch (error) {
      result.errors.push(`Cannot access ${basePath}: ${error}`);
      return;
    }

    for (const pattern of this.logPatterns) {
      try {
        const fullPattern = path.join(basePath, pattern);
        const files = await glob(fullPattern, { 
          nodir: true,
          maxDepth: 10,
          ignore: ['**/node_modules/**', '**/.git/**']
        });

        for (const file of files) {
          try {
            const logFile = await this.analyzeLogFile(file);
            if (logFile) {
              result.log_files.push(logFile);
              result.domains.add(logFile.domain);
            }
          } catch (error) {
            result.errors.push(`Failed to analyze ${file}: ${error}`);
          }
        }
      } catch (error) {
        result.errors.push(`Glob pattern failed for ${pattern}: ${error}`);
      }
    }
  }

  private async analyzeLogFile(filePath: string): Promise<LogFile | null> {
    try {
      const stats = fs.statSync(filePath);
      
      if (stats.size > this.parseSize(this.config.monitoring.max_file_size)) {
        console.warn(`⚠️  Skipping large file: ${filePath} (${this.formatBytes(stats.size)})`);
        return null;
      }

      const domain = this.extractDomain(filePath);
      if (!domain) {
        return null;
      }

      const logType = this.detectLogType(filePath);
      const format = this.detectLogFormat(filePath);

      return {
        path: filePath,
        domain,
        type: logType,
        format,
        size: stats.size,
        last_modified: stats.mtime
      };
    } catch (error) {
      throw new Error(`Cannot analyze ${filePath}: ${error}`);
    }
  }

  private extractDomain(filePath: string): string | null {
    for (const pattern of this.domainPatterns) {
      const match = filePath.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    const fileName = path.basename(filePath);
    const domainMatch = fileName.match(/([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.)+[a-zA-Z]{2,}/);
    if (domainMatch) {
      return domainMatch[0];
    }

    const pathParts = filePath.split('/');
    for (const part of pathParts) {
      if (part.includes('.') && !part.includes('log')) {
        const domainMatch = part.match(/^([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.)+[a-zA-Z]{2,}$/);
        if (domainMatch) {
          return domainMatch[0];
        }
      }
    }

    return 'unknown';
  }

  private detectLogType(filePath: string): 'access' | 'error' | 'application' {
    const fileName = path.basename(filePath).toLowerCase();
    
    if (fileName.includes('error')) {
      return 'error';
    }
    
    if (fileName.includes('access')) {
      return 'access';
    }
    
    if (fileName.includes('app') || fileName.includes('application') || fileName.includes('debug')) {
      return 'application';
    }
    
    return 'access';
  }

  private detectLogFormat(filePath: string): any {
    return {
      name: 'nginx_combined',
      pattern: /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*)" (\d+) (\d+) "([^"]*)" "([^"]*)".*$/,
      fields: ['ip', 'timestamp', 'method', 'path', 'status', 'size', 'referer', 'user_agent']
    };
  }

  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(.*)/);
    if (!match) return 0;
    
    const [, numStr, unit] = match;
    const num = parseFloat(numStr);
    
    switch (unit.toLowerCase()) {
      case 'gb': return num * 1024 * 1024 * 1024;
      case 'mb': return num * 1024 * 1024;
      case 'kb': return num * 1024;
      default: return num;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async findDomainLogs(domain: string): Promise<LogFile[]> {
    const result = await this.discoverLogs();
    return result.log_files.filter(file => file.domain === domain);
  }

  async listDomains(): Promise<string[]> {
    const result = await this.discoverLogs();
    return Array.from(result.domains).sort();
  }
}