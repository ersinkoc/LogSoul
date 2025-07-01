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
exports.Storage = void 0;
const sqlite3 = __importStar(require("sqlite3"));
class Storage {
    constructor(dbPath = './logsoul.db') {
        this.dbPath = dbPath;
        this.db = new sqlite3.Database(dbPath);
        this.initializeDatabase();
    }
    async initializeDatabase() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(`
          CREATE TABLE IF NOT EXISTS domains (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            health_score INTEGER DEFAULT 100
          )
        `);
                this.db.run(`
          CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain_id INTEGER NOT NULL,
            timestamp DATETIME NOT NULL,
            ip TEXT NOT NULL,
            method TEXT,
            path TEXT,
            status INTEGER,
            size INTEGER DEFAULT 0,
            response_time REAL,
            user_agent TEXT,
            referer TEXT,
            raw_line TEXT,
            FOREIGN KEY (domain_id) REFERENCES domains(id)
          )
        `);
                this.db.run(`
          CREATE TABLE IF NOT EXISTS metrics (
            domain_id INTEGER NOT NULL,
            timestamp DATETIME NOT NULL,
            requests INTEGER DEFAULT 0,
            errors INTEGER DEFAULT 0,
            avg_response_time REAL DEFAULT 0,
            bandwidth INTEGER DEFAULT 0,
            unique_ips INTEGER DEFAULT 0,
            PRIMARY KEY (domain_id, timestamp),
            FOREIGN KEY (domain_id) REFERENCES domains(id)
          )
        `);
                this.db.run(`
          CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME,
            FOREIGN KEY (domain_id) REFERENCES domains(id)
          )
        `);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_logs_domain_timestamp ON logs(domain_id, timestamp)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_logs_status ON logs(status)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_logs_ip ON logs(ip)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_alerts_domain ON alerts(domain_id)`);
                resolve();
            });
        });
    }
    async addDomain(name) {
        return new Promise((resolve, reject) => {
            const self = this;
            this.db.run('INSERT OR IGNORE INTO domains (name) VALUES (?)', [name], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                if (this.lastID) {
                    resolve(this.lastID);
                }
                else {
                    // Domain already exists, get its ID
                    self.db.get('SELECT id FROM domains WHERE name = ?', [name], (err, row) => {
                        if (err)
                            reject(err);
                        else
                            resolve(row.id);
                    });
                }
            });
        });
    }
    async getDomain(name) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM domains WHERE name = ?', [name], (err, row) => {
                if (err) {
                    reject(err);
                }
                else if (row) {
                    resolve({
                        id: row.id,
                        name: row.name,
                        created_at: new Date(row.created_at),
                        last_seen: new Date(row.last_seen),
                        health_score: row.health_score
                    });
                }
                else {
                    resolve(null);
                }
            });
        });
    }
    async getDomains() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM domains ORDER BY name', (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    const domains = rows.map(row => ({
                        id: row.id,
                        name: row.name,
                        created_at: new Date(row.created_at),
                        last_seen: new Date(row.last_seen),
                        health_score: row.health_score
                    }));
                    resolve(domains);
                }
            });
        });
    }
    async insertLogs(logs) {
        if (logs.length === 0)
            return;
        const stmt = this.db.prepare(`
      INSERT INTO logs (domain_id, timestamp, ip, method, path, status, size, response_time, user_agent, referer, raw_line)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                for (const log of logs) {
                    stmt.run([
                        log.domain_id,
                        log.timestamp.toISOString(),
                        log.ip,
                        log.method,
                        log.path,
                        log.status,
                        log.size,
                        log.response_time,
                        log.user_agent,
                        log.referer,
                        log.raw_line
                    ]);
                }
                this.db.run('COMMIT', (err) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
            stmt.finalize();
        });
    }
    async getLogs(domainId, limit = 1000, offset = 0) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM logs WHERE domain_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?', [domainId, limit, offset], (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    const logs = rows.map(row => ({
                        id: row.id,
                        domain_id: row.domain_id,
                        timestamp: new Date(row.timestamp),
                        ip: row.ip,
                        method: row.method,
                        path: row.path,
                        status: row.status,
                        size: row.size,
                        response_time: row.response_time,
                        user_agent: row.user_agent,
                        referer: row.referer,
                        raw_line: row.raw_line
                    }));
                    resolve(logs);
                }
            });
        });
    }
    async getLogsByTimeRange(domainId, startTime, endTime) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM logs WHERE domain_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC', [domainId, startTime.toISOString(), endTime.toISOString()], (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    const logs = rows.map(row => ({
                        id: row.id,
                        domain_id: row.domain_id,
                        timestamp: new Date(row.timestamp),
                        ip: row.ip,
                        method: row.method,
                        path: row.path,
                        status: row.status,
                        size: row.size,
                        response_time: row.response_time,
                        user_agent: row.user_agent,
                        referer: row.referer,
                        raw_line: row.raw_line
                    }));
                    resolve(logs);
                }
            });
        });
    }
    async getDomainStats(domainId, timeRange = '1h') {
        const timeRangeMap = {
            '1h': '-1 hour',
            '24h': '-24 hours',
            '7d': '-7 days',
            '30d': '-30 days'
        };
        const timeOffset = timeRangeMap[timeRange] || '-1 hour';
        return new Promise((resolve, reject) => {
            this.db.get(`
        SELECT 
          d.name as domain,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN l.status >= 400 THEN 1 END) as error_count,
          AVG(l.response_time) as avg_response_time,
          SUM(l.size) as total_bandwidth,
          COUNT(DISTINCT l.ip) as unique_ips,
          d.health_score
        FROM logs l
        JOIN domains d ON l.domain_id = d.id
        WHERE l.domain_id = ? 
        AND l.timestamp >= datetime('now', ?)
      `, [domainId, timeOffset], (err, row) => {
                if (err) {
                    reject(err);
                }
                else if (row && row.total_requests > 0) {
                    const stats = {
                        domain: row.domain,
                        requests_per_minute: row.total_requests / (parseInt(timeRange) || 60),
                        error_rate: (row.error_count / row.total_requests) * 100,
                        avg_response_time: row.avg_response_time || 0,
                        traffic_volume: row.total_bandwidth || 0,
                        unique_ips: row.unique_ips || 0,
                        health_score: row.health_score || 100
                    };
                    resolve(stats);
                }
                else {
                    resolve(null);
                }
            });
        });
    }
    async addAlert(domainId, type, message, severity) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT INTO alerts (domain_id, type, message, severity) VALUES (?, ?, ?, ?)', [domainId, type, message, severity], function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(this.lastID);
                }
            });
        });
    }
    async getAlerts(domainId, limit = 100) {
        const query = domainId
            ? 'SELECT * FROM alerts WHERE domain_id = ? ORDER BY created_at DESC LIMIT ?'
            : 'SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?';
        const params = domainId ? [domainId, limit] : [limit];
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    const alerts = rows.map(row => ({
                        id: row.id,
                        domain_id: row.domain_id,
                        type: row.type,
                        message: row.message,
                        severity: row.severity,
                        created_at: new Date(row.created_at),
                        resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined
                    }));
                    resolve(alerts);
                }
            });
        });
    }
    async updateDomainLastSeen(domainId) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE domains SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [domainId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async cleanupOldLogs(retentionDays) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM logs WHERE timestamp < datetime("now", "-" || ? || " days")', [retentionDays], function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(this.changes);
                }
            });
        });
    }
    async close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
}
exports.Storage = Storage;
//# sourceMappingURL=index.js.map