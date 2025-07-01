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
exports.FileMonitor = void 0;
const chokidar = __importStar(require("chokidar"));
const fs = __importStar(require("fs"));
const events_1 = require("events");
class FileMonitor extends events_1.EventEmitter {
    constructor(parser, storage, config) {
        super();
        this.watchers = new Map();
        this.filePositions = new Map();
        this.isRunning = false;
        this.parser = parser;
        this.storage = storage;
        this.config = config;
    }
    async start() {
        if (this.isRunning) {
            console.warn('FileMonitor is already running');
            return;
        }
        this.isRunning = true;
        console.log('🔍 Starting file monitor...');
    }
    async stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        for (const [path, watcher] of this.watchers) {
            await watcher.close();
        }
        this.watchers.clear();
        this.filePositions.clear();
        console.log('⏹️  File monitor stopped');
    }
    async watchFile(logFile) {
        if (this.watchers.has(logFile.path)) {
            console.warn(`Already watching ${logFile.path}`);
            return;
        }
        try {
            const stats = fs.statSync(logFile.path);
            this.filePositions.set(logFile.path, stats.size);
            const watcher = chokidar.watch(logFile.path, {
                persistent: true,
                usePolling: false,
                ignoreInitial: true
            });
            watcher.on('change', async () => {
                await this.handleFileChange(logFile);
            });
            watcher.on('unlink', () => {
                this.handleFileRemoved(logFile.path);
            });
            watcher.on('error', (error) => {
                this.emit('error', error, logFile.path);
            });
            this.watchers.set(logFile.path, watcher);
            console.log(`👀 Now watching: ${logFile.path}`);
            this.emit('file-added', logFile.path);
        }
        catch (error) {
            this.emit('error', new Error(`Failed to watch ${logFile.path}: ${error}`), logFile.path);
        }
    }
    async unwatchFile(filePath) {
        const watcher = this.watchers.get(filePath);
        if (watcher) {
            await watcher.close();
            this.watchers.delete(filePath);
            this.filePositions.delete(filePath);
            console.log(`🚫 Stopped watching: ${filePath}`);
        }
    }
    async handleFileChange(logFile) {
        try {
            const currentPosition = this.filePositions.get(logFile.path) || 0;
            const stats = fs.statSync(logFile.path);
            if (stats.size < currentPosition) {
                console.log(`📄 File rotated: ${logFile.path}`);
                this.filePositions.set(logFile.path, 0);
                return;
            }
            if (stats.size === currentPosition) {
                return;
            }
            const domain = await this.storage.getDomain(logFile.domain);
            if (!domain) {
                console.warn(`Domain not found: ${logFile.domain}`);
                return;
            }
            const newBytes = stats.size - currentPosition;
            if (newBytes > this.parseSize(this.config.monitoring.max_file_size)) {
                console.warn(`File change too large, skipping: ${logFile.path} (${this.formatBytes(newBytes)})`);
                this.filePositions.set(logFile.path, stats.size);
                return;
            }
            const entries = await this.readNewLines(logFile, currentPosition, domain.id);
            if (entries.length > 0) {
                await this.storage.insertLogs(entries);
                await this.storage.updateDomainLastSeen(domain.id);
                for (const entry of entries) {
                    this.emit('log-entry', entry);
                }
            }
            this.filePositions.set(logFile.path, stats.size);
        }
        catch (error) {
            this.emit('error', new Error(`Error processing file change: ${error}`), logFile.path);
        }
    }
    async readNewLines(logFile, startPosition, domainId) {
        const entries = [];
        const stream = fs.createReadStream(logFile.path, {
            start: startPosition,
            encoding: 'utf8'
        });
        let buffer = '';
        return new Promise((resolve, reject) => {
            stream.on('data', (chunk) => {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const entry = this.parser.parseLine(line, domainId, logFile.format);
                            if (entry) {
                                entries.push(entry);
                            }
                        }
                        catch (error) {
                            console.warn(`Failed to parse line: ${line.substring(0, 100)}...`);
                        }
                    }
                }
            });
            stream.on('end', () => {
                if (buffer.trim()) {
                    try {
                        const entry = this.parser.parseLine(buffer, domainId, logFile.format);
                        if (entry) {
                            entries.push(entry);
                        }
                    }
                    catch (error) {
                        console.warn(`Failed to parse final line: ${buffer.substring(0, 100)}...`);
                    }
                }
                resolve(entries);
            });
            stream.on('error', reject);
        });
    }
    handleFileRemoved(filePath) {
        console.log(`🗑️  File removed: ${filePath}`);
        this.unwatchFile(filePath);
        this.emit('file-removed', filePath);
    }
    async watchDomain(domainName, logFiles) {
        console.log(`🌐 Starting to watch domain: ${domainName} (${logFiles.length} files)`);
        for (const logFile of logFiles) {
            await this.watchFile(logFile);
        }
    }
    async unwatchDomain(domainName, logFiles) {
        console.log(`🚫 Stopping watch for domain: ${domainName}`);
        for (const logFile of logFiles) {
            await this.unwatchFile(logFile.path);
        }
    }
    getWatchedFiles() {
        return Array.from(this.watchers.keys());
    }
    isWatching(filePath) {
        return this.watchers.has(filePath);
    }
    async tailFile(filePath, lines = 100) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const allLines = data.split('\n');
            return allLines.slice(-lines).filter(line => line.trim());
        }
        catch (error) {
            throw new Error(`Failed to tail file ${filePath}: ${error}`);
        }
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
    getStats() {
        return {
            watchedFiles: this.watchers.size,
            filePositions: Object.fromEntries(this.filePositions),
            isRunning: this.isRunning
        };
    }
}
exports.FileMonitor = FileMonitor;
//# sourceMappingURL=index.js.map