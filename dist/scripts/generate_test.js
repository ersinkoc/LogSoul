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
exports.generateTestLogs = generateTestLogs;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const moment_1 = __importDefault(require("moment"));
class TestDataGenerator {
    constructor() {
        this.domains = ['example.com', 'testsite.org', 'mydomain.net'];
        this.commonPaths = [
            '/',
            '/about',
            '/contact',
            '/products',
            '/services',
            '/blog',
            '/api/users',
            '/api/products',
            '/login',
            '/register',
            '/admin',
            '/dashboard',
            '/search',
            '/images/logo.png',
            '/css/style.css',
            '/js/app.js',
            '/favicon.ico'
        ];
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/88.0',
            'Googlebot/2.1 (+http://www.google.com/bot.html)',
            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            'curl/7.68.0',
            'python-requests/2.25.1'
        ];
        this.suspiciousUserAgents = [
            'sqlmap/1.5.2',
            'nikto/2.1.6',
            'nmap-nse',
            'x',
            'a',
            'test'
        ];
        this.attackPaths = [
            "/admin/config.php",
            "/wp-admin/admin-ajax.php",
            "/phpMyAdmin/index.php",
            "/.env",
            "/etc/passwd",
            "/../../../etc/passwd",
            "/admin/login.php?username=admin'OR'1=1--",
            "/search?q=<script>alert('xss')</script>",
            "/api/users?id=1'UNION SELECT * FROM users--",
            "/login.php?redirect=javascript:alert(1)"
        ];
        this.ipRanges = [
            '192.168.1.',
            '10.0.0.',
            '172.16.0.',
            '203.0.113.',
            '198.51.100.',
            '185.220.', // Tor exit nodes
            '45.142.', // Suspicious range
        ];
    }
    async generateTestLogs() {
        console.log('🧪 Generating test data...');
        // Create test data directory
        const testDataDir = path.join(__dirname, '../test/testdata');
        if (!fs.existsSync(testDataDir)) {
            fs.mkdirSync(testDataDir, { recursive: true });
        }
        const scenarios = [
            {
                name: 'normal_traffic',
                description: 'Normal website traffic with gradual increase during day',
                duration: 60,
                generate: () => this.generateNormalTraffic()
            },
            {
                name: 'attack_scenario',
                description: 'Security attack scenario with SQL injection and XSS attempts',
                duration: 30,
                generate: () => this.generateAttackScenario()
            },
            {
                name: 'performance_issues',
                description: 'Performance degradation with increasing response times',
                duration: 45,
                generate: () => this.generatePerformanceIssues()
            },
            {
                name: 'error_spike',
                description: 'Error spike scenario simulating deployment gone wrong',
                duration: 20,
                generate: () => this.generateErrorSpike()
            },
            {
                name: 'bot_crawling',
                description: 'Bot crawling scenario with search engine bots',
                duration: 30,
                generate: () => this.generateBotCrawling()
            }
        ];
        for (const scenario of scenarios) {
            console.log(`📝 Generating ${scenario.name}: ${scenario.description}`);
            const logs = scenario.generate();
            await this.writeLogsToFiles(scenario.name, logs);
        }
        console.log('✅ Test data generation complete!');
        console.log(`📁 Test files created in: ${testDataDir}`);
    }
    generateNormalTraffic() {
        const logs = [];
        const now = new Date();
        // Generate 24 hours of traffic
        for (let hour = 0; hour < 24; hour++) {
            // Traffic varies by hour (more during day, less at night)
            const baseTraffic = this.getTrafficForHour(hour);
            for (let i = 0; i < baseTraffic; i++) {
                const timestamp = new Date(now.getTime() - (24 - hour) * 60 * 60 * 1000 + Math.random() * 60 * 60 * 1000);
                logs.push({
                    timestamp,
                    ip: this.generateIP(),
                    method: this.weightedChoice(['GET', 'POST', 'PUT', 'DELETE'], [80, 15, 3, 2]),
                    path: this.weightedChoice(this.commonPaths, [20, 10, 8, 12, 10, 15, 8, 8, 5, 5, 2, 3, 6, 4, 3, 2, 1]),
                    status: this.weightedChoice([200, 301, 404, 500], [85, 8, 5, 2]),
                    size: Math.floor(Math.random() * 50000) + 1000,
                    response_time: Math.floor(Math.random() * 1000) + 50,
                    user_agent: this.weightedChoice(this.userAgents, [25, 25, 20, 15, 10, 2, 2, 0.5, 0.5]),
                    referer: Math.random() > 0.3 ? this.generateReferer() : '-'
                });
            }
        }
        return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    generateAttackScenario() {
        const logs = [];
        const now = new Date();
        const attackerIPs = ['185.220.101.42', '45.142.213.33', '203.0.113.195'];
        // Generate attack traffic over 30 minutes
        for (let minute = 0; minute < 30; minute++) {
            const attackIntensity = Math.min(10, minute * 2); // Escalating attack
            for (let i = 0; i < attackIntensity; i++) {
                const timestamp = new Date(now.getTime() - (30 - minute) * 60 * 1000 + Math.random() * 60 * 1000);
                logs.push({
                    timestamp,
                    ip: this.weightedChoice(attackerIPs, [40, 30, 30]),
                    method: this.weightedChoice(['GET', 'POST'], [70, 30]),
                    path: this.weightedChoice(this.attackPaths, [15, 12, 10, 8, 8, 12, 10, 10, 10, 5]),
                    status: this.weightedChoice([404, 403, 500, 200], [40, 30, 20, 10]),
                    size: Math.floor(Math.random() * 5000) + 500,
                    response_time: Math.floor(Math.random() * 2000) + 100,
                    user_agent: this.weightedChoice(this.suspiciousUserAgents, [30, 25, 20, 10, 10, 5]),
                    referer: '-'
                });
            }
            // Mix in some normal traffic
            for (let i = 0; i < Math.floor(Math.random() * 5); i++) {
                const timestamp = new Date(now.getTime() - (30 - minute) * 60 * 1000 + Math.random() * 60 * 1000);
                logs.push({
                    timestamp,
                    ip: this.generateIP(),
                    method: 'GET',
                    path: this.weightedChoice(this.commonPaths.slice(0, 8), [20, 15, 12, 10, 10, 10, 8, 15]),
                    status: this.weightedChoice([200, 404], [90, 10]),
                    size: Math.floor(Math.random() * 20000) + 2000,
                    response_time: Math.floor(Math.random() * 500) + 100,
                    user_agent: this.weightedChoice(this.userAgents.slice(0, 5), [25, 25, 20, 15, 15]),
                    referer: this.generateReferer()
                });
            }
        }
        return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    generatePerformanceIssues() {
        const logs = [];
        const now = new Date();
        // Generate degrading performance over 45 minutes
        for (let minute = 0; minute < 45; minute++) {
            const requestCount = Math.floor(Math.random() * 10) + 5;
            const baseResponseTime = 200 + (minute * 100); // Increasing response times
            for (let i = 0; i < requestCount; i++) {
                const timestamp = new Date(now.getTime() - (45 - minute) * 60 * 1000 + Math.random() * 60 * 1000);
                const responseTime = baseResponseTime + Math.floor(Math.random() * 1000);
                logs.push({
                    timestamp,
                    ip: this.generateIP(),
                    method: this.weightedChoice(['GET', 'POST'], [80, 20]),
                    path: this.weightedChoice(this.commonPaths, [20, 10, 8, 12, 10, 15, 8, 8, 5, 5, 2, 3, 3, 2, 2, 1, 1]),
                    status: responseTime > 5000 ?
                        this.weightedChoice([200, 500, 503], [60, 25, 15]) :
                        this.weightedChoice([200, 500], [90, 10]),
                    size: Math.floor(Math.random() * 30000) + 1000,
                    response_time: responseTime,
                    user_agent: this.weightedChoice(this.userAgents.slice(0, 6), [20, 20, 20, 15, 15, 10]),
                    referer: Math.random() > 0.4 ? this.generateReferer() : '-'
                });
            }
        }
        return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    generateErrorSpike() {
        const logs = [];
        const now = new Date();
        // Normal traffic for first 10 minutes
        for (let minute = 0; minute < 10; minute++) {
            const requestCount = Math.floor(Math.random() * 8) + 3;
            for (let i = 0; i < requestCount; i++) {
                const timestamp = new Date(now.getTime() - (20 - minute) * 60 * 1000 + Math.random() * 60 * 1000);
                logs.push({
                    timestamp,
                    ip: this.generateIP(),
                    method: 'GET',
                    path: this.weightedChoice(this.commonPaths.slice(0, 10), [20, 15, 12, 10, 10, 10, 8, 8, 4, 3]),
                    status: this.weightedChoice([200, 404], [95, 5]),
                    size: Math.floor(Math.random() * 25000) + 2000,
                    response_time: Math.floor(Math.random() * 300) + 100,
                    user_agent: this.weightedChoice(this.userAgents.slice(0, 5), [25, 25, 20, 15, 15]),
                    referer: this.generateReferer()
                });
            }
        }
        // Error spike for next 10 minutes (deployment issue)
        for (let minute = 10; minute < 20; minute++) {
            const requestCount = Math.floor(Math.random() * 15) + 10;
            for (let i = 0; i < requestCount; i++) {
                const timestamp = new Date(now.getTime() - (20 - minute) * 60 * 1000 + Math.random() * 60 * 1000);
                logs.push({
                    timestamp,
                    ip: this.generateIP(),
                    method: this.weightedChoice(['GET', 'POST'], [70, 30]),
                    path: this.weightedChoice(this.commonPaths, [20, 10, 8, 12, 10, 15, 8, 8, 5, 5, 2, 3, 2, 1, 1, 0, 0]),
                    status: this.weightedChoice([500, 503, 502, 200, 404], [40, 25, 15, 15, 5]),
                    size: Math.floor(Math.random() * 10000) + 500,
                    response_time: Math.floor(Math.random() * 10000) + 1000,
                    user_agent: this.weightedChoice(this.userAgents.slice(0, 5), [25, 25, 20, 15, 15]),
                    referer: this.generateReferer()
                });
            }
        }
        return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    generateBotCrawling() {
        const logs = [];
        const now = new Date();
        const botUserAgents = [
            'Googlebot/2.1 (+http://www.google.com/bot.html)',
            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
            'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)'
        ];
        // Generate bot crawling over 30 minutes
        for (let minute = 0; minute < 30; minute++) {
            const botRequests = Math.floor(Math.random() * 5) + 2;
            const humanRequests = Math.floor(Math.random() * 3) + 1;
            // Bot requests
            for (let i = 0; i < botRequests; i++) {
                const timestamp = new Date(now.getTime() - (30 - minute) * 60 * 1000 + Math.random() * 60 * 1000);
                logs.push({
                    timestamp,
                    ip: this.generateBotIP(),
                    method: 'GET',
                    path: this.weightedChoice(this.commonPaths, [30, 20, 15, 10, 8, 5, 3, 3, 2, 2, 1, 1, 0, 0, 0, 0, 0]),
                    status: this.weightedChoice([200, 404, 301], [85, 10, 5]),
                    size: Math.floor(Math.random() * 40000) + 3000,
                    response_time: Math.floor(Math.random() * 500) + 200,
                    user_agent: this.weightedChoice(botUserAgents, [40, 30, 20, 10]),
                    referer: '-'
                });
            }
            // Human requests
            for (let i = 0; i < humanRequests; i++) {
                const timestamp = new Date(now.getTime() - (30 - minute) * 60 * 1000 + Math.random() * 60 * 1000);
                logs.push({
                    timestamp,
                    ip: this.generateIP(),
                    method: 'GET',
                    path: this.weightedChoice(this.commonPaths.slice(0, 12), [25, 15, 10, 12, 10, 8, 5, 5, 3, 3, 2, 2]),
                    status: this.weightedChoice([200, 404], [92, 8]),
                    size: Math.floor(Math.random() * 25000) + 2000,
                    response_time: Math.floor(Math.random() * 800) + 150,
                    user_agent: this.weightedChoice(this.userAgents.slice(0, 5), [25, 25, 20, 15, 15]),
                    referer: this.generateReferer()
                });
            }
        }
        return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    getTrafficForHour(hour) {
        // Simulate realistic traffic patterns
        const baseTraffic = [
            2, 1, 1, 1, 1, 2, 4, 8, 12, 15, 18, 20, // 00:00 - 11:59
            22, 25, 28, 30, 32, 28, 25, 20, 15, 10, 6, 3 // 12:00 - 23:59
        ];
        return Math.floor(baseTraffic[hour] * (0.8 + Math.random() * 0.4));
    }
    generateIP() {
        const range = this.weightedChoice(this.ipRanges, [30, 25, 20, 10, 10, 3, 2]);
        return range + Math.floor(Math.random() * 254 + 1);
    }
    generateBotIP() {
        const botRanges = ['66.249.', '157.55.', '207.46.', '199.59.'];
        const range = this.weightedChoice(botRanges, [40, 25, 20, 15]);
        return range + Math.floor(Math.random() * 254 + 1) + '.' + Math.floor(Math.random() * 254 + 1);
    }
    generateReferer() {
        const referers = [
            'https://www.google.com/',
            'https://www.bing.com/',
            'https://example.com/',
            'https://www.facebook.com/',
            'https://twitter.com/',
            'https://github.com/',
            'https://stackoverflow.com/'
        ];
        return this.weightedChoice(referers, [40, 15, 20, 10, 5, 5, 5]);
    }
    weightedChoice(items, weights) {
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return items[i];
            }
        }
        return items[items.length - 1];
    }
    async writeLogsToFiles(scenarioName, logs) {
        const testDataDir = path.join(__dirname, '../test/testdata');
        for (const domain of this.domains) {
            const domainLogs = logs.filter(() => Math.random() > 0.3); // Randomly assign logs to domains
            if (domainLogs.length === 0)
                continue;
            // Create domain directory
            const domainDir = path.join(testDataDir, domain);
            if (!fs.existsSync(domainDir)) {
                fs.mkdirSync(domainDir, { recursive: true });
            }
            // Write access log
            const accessLogPath = path.join(domainDir, `${scenarioName}_access.log`);
            const accessLogContent = domainLogs
                .map(log => this.formatAsNginxLog(log))
                .join('\n');
            fs.writeFileSync(accessLogPath, accessLogContent);
            // Write error log (only error entries)
            const errorLogs = domainLogs.filter(log => log.status >= 400);
            if (errorLogs.length > 0) {
                const errorLogPath = path.join(domainDir, `${scenarioName}_error.log`);
                const errorLogContent = errorLogs
                    .map(log => this.formatAsNginxErrorLog(log))
                    .join('\n');
                fs.writeFileSync(errorLogPath, errorLogContent);
            }
        }
    }
    formatAsNginxLog(log) {
        const timestamp = (0, moment_1.default)(log.timestamp).format('DD/MMM/YYYY:HH:mm:ss ZZ');
        return `${log.ip} - - [${timestamp}] "${log.method} ${log.path} HTTP/1.1" ${log.status} ${log.size} "${log.referer}" "${log.user_agent}"`;
    }
    formatAsNginxErrorLog(log) {
        const timestamp = (0, moment_1.default)(log.timestamp).format('YYYY/MM/DD HH:mm:ss');
        const errorMessages = {
            400: 'client sent invalid request',
            401: 'access denied',
            403: 'access forbidden',
            404: 'file not found',
            500: 'internal server error',
            502: 'upstream server error',
            503: 'service unavailable'
        };
        const message = errorMessages[log.status] || 'unknown error';
        return `${timestamp} [error] 12345#0: ${message}: "${log.path}", client: ${log.ip}, server: example.com, request: "${log.method} ${log.path} HTTP/1.1"`;
    }
}
async function generateTestLogs() {
    const generator = new TestDataGenerator();
    await generator.generateTestLogs();
}
// Run if called directly
if (require.main === module) {
    generateTestLogs().catch(console.error);
}
//# sourceMappingURL=generate_test.js.map