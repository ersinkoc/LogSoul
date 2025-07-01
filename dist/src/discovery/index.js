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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogDiscovery = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
class LogDiscovery {
    constructor(config) {
        this.logPatterns = [
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
        this.domainPatterns = [
            /\/var\/log\/nginx\/([^\/]+)/,
            /\/var\/log\/apache2\/([^\/]+)/,
            /\/var\/www\/vhosts\/([^\/]+)\/logs/,
            /\/home\/([^\/]+)\/logs/,
            /\/var\/www\/html\/([^\/]+)\/logs/,
            /\/var\/log\/httpd\/domains\/([^\/]+)/
        ];
        this.config = config;
    }
    async discoverLogs() {
        const result = {
            domains: new Set(),
            log_files: [],
            errors: []
        };
        console.log('🔍 Discovering log files...');
        for (const basePath of this.config.log_paths) {
            try {
                await this.scanPath(basePath, result);
            }
            catch (error) {
                result.errors.push(`Failed to scan ${basePath}: ${error}`);
            }
        }
        console.log(`✅ Found ${result.log_files.length} log files for ${result.domains.size} domains`);
        return result;
    }
    async scanPath(basePath, result) {
        if (!fs.existsSync(basePath)) {
            result.errors.push(`Path does not exist: ${basePath}`);
            return;
        }
        try {
            const stats = fs.statSync(basePath);
            if (!stats.isDirectory()) {
                return;
            }
        }
        catch (error) {
            result.errors.push(`Cannot access ${basePath}: ${error}`);
            return;
        }
        for (const pattern of this.logPatterns) {
            try {
                const fullPattern = path.join(basePath, pattern);
                const files = await (0, glob_1.glob)(fullPattern, {
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
                    }
                    catch (error) {
                        result.errors.push(`Failed to analyze ${file}: ${error}`);
                    }
                }
            }
            catch (error) {
                result.errors.push(`Glob pattern failed for ${pattern}: ${error}`);
            }
        }
    }
    async analyzeLogFile(filePath) {
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
        }
        catch (error) {
            throw new Error(`Cannot analyze ${filePath}: ${error}`);
        }
    }
    extractDomain(filePath) {
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
    detectLogType(filePath) {
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
    detectLogFormat(filePath) {
        return {
            name: 'nginx_combined',
            pattern: /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*)" (\d+) (\d+) "([^"]*)" "([^"]*)".*$/,
            fields: ['ip', 'timestamp', 'method', 'path', 'status', 'size', 'referer', 'user_agent']
        };
    }
    parseSize(sizeStr) {
        const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(.*)/);
        if (!match)
            return 0;
        const [, numStr, unit] = match;
        const num = parseFloat(numStr);
        switch (unit.toLowerCase()) {
            case 'gb': return num * 1024 * 1024 * 1024;
            case 'mb': return num * 1024 * 1024;
            case 'kb': return num * 1024;
            default: return num;
        }
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    async findDomainLogs(domain) {
        const result = await this.discoverLogs();
        return result.log_files.filter(file => file.domain === domain);
    }
    async listDomains() {
        const result = await this.discoverLogs();
        return Array.from(result.domains).sort();
    }
}
exports.LogDiscovery = LogDiscovery;
//# sourceMappingURL=index.js.map