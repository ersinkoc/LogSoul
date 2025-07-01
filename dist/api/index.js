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
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const ws_1 = require("ws");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path = __importStar(require("path"));
const monitor_1 = require("../monitor");
function createServer(config, storage, discovery, parser) {
    const app = (0, express_1.default)();
    const server = (0, http_1.createServer)(app);
    const wss = new ws_1.WebSocketServer({ server });
    const monitor = new monitor_1.FileMonitor(parser, storage, config);
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
                scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
    }));
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    const limiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        message: 'Too many requests from this IP'
    });
    app.use('/api/', limiter);
    app.use(express_1.default.static(path.join(__dirname, '../../web/static')));
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../../web/templates/index.html'));
    });
    app.get('/api/domains', async (req, res) => {
        try {
            const domains = await storage.getDomains();
            const domainsWithStats = await Promise.all(domains.map(async (domain) => {
                const stats = await storage.getDomainStats(domain.id);
                return { ...domain, stats };
            }));
            res.json(domainsWithStats);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch domains' });
        }
    });
    app.post('/api/domains', async (req, res) => {
        try {
            const { name } = req.body;
            if (!name) {
                return res.status(400).json({ error: 'Domain name is required' });
            }
            const domainId = await storage.addDomain(name);
            const domain = await storage.getDomain(name);
            res.status(201).json(domain);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to add domain' });
        }
    });
    app.get('/api/domains/:domain', async (req, res) => {
        try {
            const { domain: domainName } = req.params;
            const domain = await storage.getDomain(domainName);
            if (!domain) {
                return res.status(404).json({ error: 'Domain not found' });
            }
            const stats = await storage.getDomainStats(domain.id);
            const alerts = await storage.getAlerts(domain.id, 10);
            const logFiles = await discovery.findDomainLogs(domainName);
            res.json({
                ...domain,
                stats,
                alerts,
                log_files: logFiles
            });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch domain details' });
        }
    });
    app.get('/api/domains/:domain/logs', async (req, res) => {
        try {
            const { domain: domainName } = req.params;
            const { limit = 1000, offset = 0, start_time, end_time } = req.query;
            const domain = await storage.getDomain(domainName);
            if (!domain) {
                return res.status(404).json({ error: 'Domain not found' });
            }
            let logs;
            if (start_time && end_time) {
                logs = await storage.getLogsByTimeRange(domain.id, new Date(start_time), new Date(end_time));
            }
            else {
                logs = await storage.getLogs(domain.id, Number(limit), Number(offset));
            }
            res.json({
                logs,
                total: logs.length,
                domain: domainName
            });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch logs' });
        }
    });
    app.get('/api/domains/:domain/stats', async (req, res) => {
        try {
            const { domain: domainName } = req.params;
            const { range = '1h' } = req.query;
            const domain = await storage.getDomain(domainName);
            if (!domain) {
                return res.status(404).json({ error: 'Domain not found' });
            }
            const stats = await storage.getDomainStats(domain.id, range);
            res.json(stats);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch domain statistics' });
        }
    });
    app.get('/api/discovery', async (req, res) => {
        try {
            const result = await discovery.discoverLogs();
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to discover logs' });
        }
    });
    app.post('/api/discovery/scan', async (req, res) => {
        try {
            const result = await discovery.discoverLogs();
            for (const domain of result.domains) {
                await storage.addDomain(domain);
            }
            res.json({
                message: 'Discovery scan completed',
                domains_found: result.domains.size,
                log_files_found: result.log_files.length,
                errors: result.errors
            });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to run discovery scan' });
        }
    });
    app.get('/api/alerts', async (req, res) => {
        try {
            const { domain, limit = 100 } = req.query;
            let domainId;
            if (domain) {
                const domainObj = await storage.getDomain(domain);
                if (!domainObj) {
                    return res.status(404).json({ error: 'Domain not found' });
                }
                domainId = domainObj.id;
            }
            const alerts = await storage.getAlerts(domainId, Number(limit));
            res.json(alerts);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch alerts' });
        }
    });
    app.post('/api/alerts', async (req, res) => {
        try {
            const { domain, type, message, severity } = req.body;
            const domainObj = await storage.getDomain(domain);
            if (!domainObj) {
                return res.status(404).json({ error: 'Domain not found' });
            }
            const alertId = await storage.addAlert(domainObj.id, type, message, severity);
            res.status(201).json({ id: alertId, message: 'Alert created' });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to create alert' });
        }
    });
    app.get('/api/search', async (req, res) => {
        try {
            const { q, domain, limit = 100 } = req.query;
            if (!q) {
                return res.status(400).json({ error: 'Query parameter "q" is required' });
            }
            let domainId;
            if (domain) {
                const domainObj = await storage.getDomain(domain);
                if (!domainObj) {
                    return res.status(404).json({ error: 'Domain not found' });
                }
                domainId = domainObj.id;
            }
            const logs = await storage.getLogs(domainId || 0, Number(limit));
            const searchTerm = q.toLowerCase();
            const filteredLogs = logs.filter(log => log.raw_line.toLowerCase().includes(searchTerm) ||
                log.path.toLowerCase().includes(searchTerm) ||
                log.ip.includes(searchTerm) ||
                (log.user_agent && log.user_agent.toLowerCase().includes(searchTerm)));
            res.json({
                query: q,
                results: filteredLogs,
                total: filteredLogs.length
            });
        }
        catch (error) {
            res.status(500).json({ error: 'Search failed' });
        }
    });
    app.get('/api/monitor/status', (req, res) => {
        res.json(monitor.getStats());
    });
    app.post('/api/monitor/start', async (req, res) => {
        try {
            await monitor.start();
            res.json({ message: 'Monitor started' });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to start monitor' });
        }
    });
    app.post('/api/monitor/stop', async (req, res) => {
        try {
            await monitor.stop();
            res.json({ message: 'Monitor stopped' });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to stop monitor' });
        }
    });
    wss.on('connection', (ws, req) => {
        console.log('WebSocket client connected');
        const url = new URL(req.url, `http://${req.headers.host}`);
        const domain = url.searchParams.get('domain');
        if (domain) {
            const handleLogEntry = (entry) => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'log-entry',
                        data: entry
                    }));
                }
            };
            monitor.on('log-entry', handleLogEntry);
            ws.on('close', () => {
                monitor.removeListener('log-entry', handleLogEntry);
                console.log('WebSocket client disconnected');
            });
        }
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());
                switch (data.type) {
                    case 'subscribe':
                        if (data.domain) {
                            const logFiles = await discovery.findDomainLogs(data.domain);
                            await monitor.watchDomain(data.domain, logFiles);
                        }
                        break;
                    case 'unsubscribe':
                        if (data.domain) {
                            const logFiles = await discovery.findDomainLogs(data.domain);
                            await monitor.unwatchDomain(data.domain, logFiles);
                        }
                        break;
                }
            }
            catch (error) {
                console.error('WebSocket message error:', error);
            }
        });
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'Connected to LogSoul real-time stream'
        }));
    });
    app.use((req, res) => {
        res.status(404).json({ error: 'Not found' });
    });
    app.use((err, req, res, next) => {
        console.error('Server error:', err);
        res.status(500).json({ error: 'Internal server error' });
    });
    return server;
}
//# sourceMappingURL=index.js.map