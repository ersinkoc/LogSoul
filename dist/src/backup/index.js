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
exports.BackupManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class BackupManager {
    constructor(storage, config) {
        this.storage = storage;
        this.config = config;
        this.backupConfig = {
            enabled: true,
            schedule: '0 2 * * *', // Daily at 2 AM
            retention_days: 30,
            compression: true,
            destination: './backups',
            include_logs: true,
            include_metrics: true
        };
    }
    async createBackup() {
        const startTime = Date.now();
        const backupId = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const backupDir = path.join(this.backupConfig.destination, backupId);
        console.log(`📦 Creating backup: ${backupId}`);
        try {
            // Ensure backup directory exists
            fs.mkdirSync(backupDir, { recursive: true });
            // Backup database
            await this.backupDatabase(backupDir);
            // Backup configuration
            await this.backupConfiguration(backupDir);
            // Backup metrics if enabled
            if (this.backupConfig.include_metrics) {
                await this.backupMetrics(backupDir);
            }
            // Create backup manifest
            const manifest = await this.createManifest(backupDir);
            // Compress if enabled
            let finalPath = backupDir;
            let compressedSize;
            if (this.backupConfig.compression) {
                finalPath = await this.compressBackup(backupDir);
                compressedSize = fs.statSync(finalPath).size;
                // Remove uncompressed directory
                fs.rmSync(backupDir, { recursive: true });
            }
            const size = this.calculateDirectorySize(this.backupConfig.compression ? finalPath : backupDir);
            const duration = Date.now() - startTime;
            const result = {
                id: backupId,
                timestamp: new Date(),
                size,
                compressed_size: compressedSize,
                file_path: finalPath,
                success: true,
                duration
            };
            console.log(`✅ Backup created: ${this.formatBytes(size)} in ${duration}ms`);
            // Cleanup old backups
            await this.cleanupOldBackups();
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            // Cleanup failed backup
            if (fs.existsSync(backupDir)) {
                fs.rmSync(backupDir, { recursive: true });
            }
            const result = {
                id: backupId,
                timestamp: new Date(),
                size: 0,
                file_path: '',
                success: false,
                error: error instanceof Error ? error.message : String(error),
                duration
            };
            console.error(`❌ Backup failed: ${result.error}`);
            return result;
        }
    }
    async backupDatabase(backupDir) {
        const dbPath = this.config.storage.db_path;
        const backupPath = path.join(backupDir, 'logsoul.db');
        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, backupPath);
            console.log(`📊 Database backed up: ${this.formatBytes(fs.statSync(backupPath).size)}`);
        }
    }
    async backupConfiguration(backupDir) {
        const configFiles = ['logsoul.yaml', 'package.json'];
        for (const file of configFiles) {
            if (fs.existsSync(file)) {
                fs.copyFileSync(file, path.join(backupDir, file));
            }
        }
        console.log(`⚙️  Configuration backed up`);
    }
    async backupMetrics(backupDir) {
        try {
            const domains = await this.storage.getDomains();
            const metrics = {
                timestamp: new Date().toISOString(),
                domains: [],
                summary: {
                    total_domains: domains.length,
                    backup_version: '1.0.0'
                }
            };
            for (const domain of domains) {
                const stats = await this.storage.getDomainStats(domain.id, '24h');
                const alerts = await this.storage.getAlerts(domain.id, 100);
                metrics.domains.push({
                    name: domain.name,
                    health_score: domain.health_score,
                    stats,
                    recent_alerts: alerts.length,
                    last_seen: domain.last_seen
                });
            }
            fs.writeFileSync(path.join(backupDir, 'metrics.json'), JSON.stringify(metrics, null, 2));
            console.log(`📈 Metrics backed up: ${domains.length} domains`);
        }
        catch (error) {
            console.warn(`⚠️  Metrics backup failed: ${error}`);
        }
    }
    async createManifest(backupDir) {
        const files = fs.readdirSync(backupDir);
        const manifest = {
            id: path.basename(backupDir),
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            files: files.map(file => ({
                name: file,
                size: fs.statSync(path.join(backupDir, file)).size,
                checksum: this.calculateChecksum(path.join(backupDir, file))
            })),
            config: {
                compression: this.backupConfig.compression,
                include_logs: this.backupConfig.include_logs,
                include_metrics: this.backupConfig.include_metrics
            }
        };
        fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
        return manifest;
    }
    async compressBackup(backupDir) {
        const archivePath = `${backupDir}.tar.gz`;
        return new Promise((resolve, reject) => {
            const tar = require('tar');
            tar.create({
                gzip: true,
                file: archivePath,
                cwd: path.dirname(backupDir)
            }, [path.basename(backupDir)]).then(() => {
                console.log(`🗜️  Backup compressed: ${this.formatBytes(fs.statSync(archivePath).size)}`);
                resolve(archivePath);
            }).catch(reject);
        });
    }
    async cleanupOldBackups() {
        const backupDir = this.backupConfig.destination;
        if (!fs.existsSync(backupDir))
            return;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.backupConfig.retention_days);
        const items = fs.readdirSync(backupDir);
        let deletedCount = 0;
        let freedSpace = 0;
        for (const item of items) {
            const itemPath = path.join(backupDir, item);
            const stats = fs.statSync(itemPath);
            if (stats.mtime < cutoffDate) {
                freedSpace += stats.size;
                fs.rmSync(itemPath, { recursive: true });
                deletedCount++;
            }
        }
        if (deletedCount > 0) {
            console.log(`🧹 Cleaned up ${deletedCount} old backups, freed ${this.formatBytes(freedSpace)}`);
        }
    }
    async restoreBackup(backupPath) {
        console.log(`📥 Restoring backup from: ${backupPath}`);
        try {
            let extractPath = backupPath;
            // Extract if compressed
            if (backupPath.endsWith('.tar.gz')) {
                extractPath = await this.extractBackup(backupPath);
            }
            // Verify manifest
            const manifestPath = path.join(extractPath, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                throw new Error('Invalid backup: manifest.json not found');
            }
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            console.log(`📋 Restoring backup: ${manifest.id} from ${manifest.timestamp}`);
            // Verify checksums
            for (const file of manifest.files) {
                if (file.name === 'manifest.json')
                    continue;
                const filePath = path.join(extractPath, file.name);
                const checksum = this.calculateChecksum(filePath);
                if (checksum !== file.checksum) {
                    throw new Error(`Checksum mismatch for ${file.name}`);
                }
            }
            // Close current database connection
            await this.storage.close();
            // Restore database
            const dbBackupPath = path.join(extractPath, 'logsoul.db');
            if (fs.existsSync(dbBackupPath)) {
                fs.copyFileSync(dbBackupPath, this.config.storage.db_path);
                console.log(`📊 Database restored`);
            }
            // Restore configuration
            const configBackupPath = path.join(extractPath, 'logsoul.yaml');
            if (fs.existsSync(configBackupPath)) {
                fs.copyFileSync(configBackupPath, 'logsoul.yaml');
                console.log(`⚙️  Configuration restored`);
            }
            console.log(`✅ Backup restored successfully`);
            return true;
        }
        catch (error) {
            console.error(`❌ Restore failed: ${error}`);
            return false;
        }
    }
    async extractBackup(archivePath) {
        const extractDir = path.join(path.dirname(archivePath), path.basename(archivePath, '.tar.gz'));
        return new Promise((resolve, reject) => {
            const tar = require('tar');
            tar.extract({
                file: archivePath,
                cwd: path.dirname(archivePath)
            }).then(() => {
                resolve(extractDir);
            }).catch(reject);
        });
    }
    async listBackups() {
        const backupDir = this.backupConfig.destination;
        if (!fs.existsSync(backupDir)) {
            return [];
        }
        const backups = [];
        const items = fs.readdirSync(backupDir);
        for (const item of items) {
            const itemPath = path.join(backupDir, item);
            const stats = fs.statSync(itemPath);
            // Try to read manifest
            let manifestPath = path.join(itemPath, 'manifest.json');
            if (item.endsWith('.tar.gz')) {
                // For compressed backups, we'll create a basic entry
                backups.push({
                    id: path.basename(item, '.tar.gz'),
                    timestamp: stats.mtime,
                    size: stats.size,
                    file_path: itemPath,
                    success: true,
                    duration: 0
                });
            }
            else if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    backups.push({
                        id: manifest.id,
                        timestamp: new Date(manifest.timestamp),
                        size: this.calculateDirectorySize(itemPath),
                        file_path: itemPath,
                        success: true,
                        duration: 0
                    });
                }
                catch (error) {
                    // Invalid manifest, skip
                }
            }
        }
        return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    calculateDirectorySize(dirPath) {
        if (fs.statSync(dirPath).isFile()) {
            return fs.statSync(dirPath).size;
        }
        let totalSize = 0;
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                totalSize += this.calculateDirectorySize(filePath);
            }
            else {
                totalSize += stats.size;
            }
        }
        return totalSize;
    }
    calculateChecksum(filePath) {
        const crypto = require('crypto');
        const data = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    getConfig() {
        return this.backupConfig;
    }
    updateConfig(config) {
        this.backupConfig = { ...this.backupConfig, ...config };
    }
}
exports.BackupManager = BackupManager;
//# sourceMappingURL=index.js.map