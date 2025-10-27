# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

LogSoul is a smart log monitoring tool that automatically discovers and analyzes web server logs (Nginx/Apache) across domains. It provides real-time analytics, health scoring, security threat detection, and intelligent alerting through both a web dashboard and CLI interface.

**Key Stack**: TypeScript, Node.js, SQLite, Express, WebSocket, chokidar (file monitoring)

## Development Commands

### Build and Run
```bash
npm install              # Install dependencies
npm run build           # Compile TypeScript to dist/
npm run dev             # Run with hot-reload (nodemon + ts-node)
npm run start           # Run compiled version from dist/
```

### CLI Operations
```bash
npm run cli init                    # Initialize config (creates logsoul.yaml)
npm run cli discover                # Find all domains and log files
npm run cli server                  # Start web server on port 3000
npm run cli watch <domain>          # Live tail domain logs
npm run cli stats <domain>          # Show domain statistics
npm run cli analyze <domain> --hour # Analyze recent logs
npm run cli test                    # Generate test data scenarios
```

### TypeScript Compilation
- `tsconfig.json`: Compiles `src/` and `scripts/` to `dist/`
- Target: ES2020, CommonJS modules
- Source maps and declarations are generated

## Architecture

### Core System Flow
```
Log Files → Discovery → Parser → Storage (SQLite) → Analytics → Alerts
     ↓          ↓         ↓         ↓              ↓          ↓
  Monitor → WebSocket → API → Web Dashboard → User Actions
```

### Main Application Class (`src/index.ts`)
`LogSoulApp` is the central orchestrator that:
- Loads configuration from `logsoul.yaml` (or uses defaults)
- Initializes all subsystems (storage, discovery, parser, monitor, analyzer, alerts)
- Sets up event handlers between components
- Manages server lifecycle and graceful shutdown

**Key pattern**: Each subsystem is injected as a dependency and communicates via events.

### Component Breakdown

#### 1. Discovery System (`src/discovery/`)
- **Purpose**: Automatically finds log files across the filesystem
- **Search Locations**: `/var/log/{nginx,apache2}`, `/var/www/vhosts`, hosting panels (Plesk, cPanel, DirectAdmin)
- **Pattern Matching**: Uses glob patterns to find `*access*.log*`, `*error*.log*`, etc.
- **Domain Extraction**: Extracts domain names from file paths using regex patterns
- **Output**: `DiscoveryResult` with domains, log files, and errors

#### 2. Parser System (`src/parser/`)
- **Purpose**: Parse different log formats into structured `LogEntry` objects
- **Supported Formats**: Nginx combined, Nginx error, Apache combined, Apache error, generic patterns
- **Key Fields**: Extracts timestamp, IP, method, path, status, size, response_time, user_agent, referer
- **Format Detection**: Automatically identifies log format by pattern matching
- **Performance**: Uses compiled regex patterns with caching

#### 3. Storage Layer (`src/storage/`)
- **Database**: SQLite with synchronous API (sqlite3 package)
- **Schema**: Domains, log entries, alerts, with proper indexes
- **Key Methods**:
  - `addDomain(name)`: Insert/update domain
  - `addLogEntry(entry)`: Insert parsed log line
  - `getDomainStats(domainId)`: Aggregate statistics
  - `cleanupOldLogs(days)`: Retention policy enforcement
- **Performance**: Batch inserts, indexed queries on domain_id + timestamp

#### 4. Monitor System (`src/monitor/`)
- **Purpose**: Real-time file watching using chokidar
- **Events**: Emits `log-entry`, `file-added`, `file-removed`, `error`
- **Behavior**: Tails files from last position, parses new lines, stores in DB
- **Config**: Scan interval, batch size, max file size from `monitoring` config

#### 5. Analyzer System (`src/analyzer/`)
- **Purpose**: Generate insights and calculate health scores
- **Health Score (0-100)**: Based on error rate, response time, security threats, performance
- **Analytics**: Top pages, IPs, user agents, error analysis
- **Security Detection**: SQL injection, XSS, path traversal, brute force
- **Performance Issues**: Slow responses, error spikes, traffic anomalies

#### 6. Alert System (`src/alerts/`)
- **Built-in Rules**: High error rate, slow response, traffic spike, critical errors, security attacks
- **Alert Channels**: Console (always), Email (SMTP), Webhook (HTTP POST)
- **Cooldown**: Prevents alert spam with time-based cooldown
- **Custom Rules**: Support for user-defined alert conditions

#### 7. API Server (`src/api/`)
- **Framework**: Express with WebSocket support (ws package)
- **Security**: Helmet, CORS, rate limiting, JWT authentication
- **REST Endpoints**:
  - `GET /api/domains` - List all domains with stats
  - `GET /api/domains/:domain` - Get domain details
  - `GET /api/domains/:domain/logs` - Fetch log entries with filters
  - `GET /api/domains/:domain/stats` - Domain statistics
  - `GET /api/alerts` - List alerts
  - `POST /api/auth/login` - Authentication
  - `GET /api/metrics` - Prometheus metrics export
  - `GET /api/health` - Health check endpoint
- **WebSocket**: Real-time log streaming at `/ws` path
- **Static Files**: Serves web dashboard from `web/static/` and `web/templates/`

#### 8. CLI Interface (`src/cli/`)
- **Framework**: Commander.js with chalk for formatting
- **i18n Support**: Multi-language support via `src/i18n/`
- **Commands**: init, discover, list, add, watch, stats, analyze, server, test, export
- **Interactive Features**: Live log tailing with color-coded output
- **Config Loading**: Tries `./logsoul.yaml`, `./configs/logsoul.yaml`, falls back to defaults

#### 9. Security Features (`src/security/`, `src/auth/`, `src/middleware/`)
- **Authentication**: JWT-based with configurable session timeout
- **Authorization**: Role-based access control (RBAC)
- **WAF**: Web Application Firewall with block/monitor modes
- **Rate Limiting**: API-specific and auth-specific limits
- **Security Middleware**: CSP headers, HSTS, XSS protection

#### 10. Enterprise Features
- **Metrics** (`src/metrics/`): Prometheus-compatible metrics collection
- **Backup** (`src/backup/`): Automated backup with compression and retention
- **Plugins** (`src/plugins/`): Extensible plugin system with lifecycle hooks
- **Config Management** (`src/config/`): Dynamic configuration with validation

### Type Definitions (`src/types/index.ts`)
All core interfaces are defined here:
- `Domain`, `LogEntry`, `LogFile`, `LogFormat`
- `DomainStats`, `Alert`, `Config`
- `DiscoveryResult`

## Configuration

### Configuration File (`logsoul.yaml`)
The main configuration is YAML-based with these sections:
- `server`: Port and host for web server
- `storage`: Database path and retention policy
- `monitoring`: Scan interval, batch size, max file size
- `alerts`: Email/webhook notification settings
- `log_paths`: Directories to search for logs
- `ignore_patterns`: Patterns to skip (health checks, etc.)
- `panel_paths`: Templates for hosting panel log locations
- `security`: JWT secret, CORS, rate limiting, auth policies

**Config Loading Priority**:
1. Specified path (if provided)
2. `./logsoul.yaml`
3. `./configs/logsoul.yaml`
4. Hardcoded defaults

## Web Dashboard

Located in `web/`:
- `templates/index.html`: Main dashboard HTML
- `static/css/style.css`: Styling
- `static/js/app.js`: Frontend JavaScript (vanilla JS + Chart.js)
- `static/js/i18n.js`: Client-side internationalization

**Features**:
- Real-time updates via WebSocket
- Domain health scores with visual indicators
- Live log streaming
- Traffic analytics charts
- Alert notifications
- Responsive mobile design

## Development Patterns

### Adding a New Log Format
1. Add format definition in `src/parser/index.ts` with regex and field mapping
2. Add format detection logic in `identifyFormat()`
3. Test with sample logs using `npm run cli test`

### Creating Custom Alert Rules
1. Add rule definition to `defaultAlertRules` in `src/alerts/index.ts`
2. Implement condition logic in `processLogEntry()`
3. Configure cooldown and severity appropriately

### Adding API Endpoints
1. Add route handler in `src/api/index.ts`
2. Apply appropriate security middleware (authentication, rate limiting)
3. Update frontend in `web/static/js/app.js` to consume endpoint

### Plugin Development
1. Create plugin in `plugins/` directory following structure in `plugins/example-plugin/`
2. Implement required hooks: `onLoad`, `onUnload`, `onLogEntry`, etc.
3. Register routes via `registerRoutes()` if needed
4. Enable in config and load via `PluginManager`

## Testing and Data Generation

### Test Data Generator (`src/test-data-generator.ts`)
Generates realistic test scenarios:
- Normal traffic patterns
- Security attack scenarios (SQL injection, XSS, brute force)
- Performance degradation simulations
- Error spike scenarios
- Bot crawling patterns

Run with: `npm run cli test`

## Deployment

See `DEPLOYMENT.md` for comprehensive deployment guides:
- Production systemd service setup
- Nginx reverse proxy configuration
- Docker and Docker Compose
- Kubernetes manifests
- Cloud deployments (AWS ECS, GCP Cloud Run, Azure ACI)
- Security hardening and monitoring

## Key Files to Know

- `src/index.ts`: Main application orchestrator
- `src/cli/index.ts`: CLI entry point
- `src/api/index.ts`: API server setup
- `src/types/index.ts`: All TypeScript interfaces
- `package.json`: Scripts and dependencies (note: `bin` points to `dist/src/cli/index.js`)
- `tsconfig.json`: TypeScript compilation settings
- `logsoul.yaml`: Runtime configuration

## Common Development Tasks

### Debugging File Discovery Issues
1. Check permissions on log directories
2. Review `config.log_paths` in `logsoul.yaml`
3. Run `npm run cli discover` to see what's found
4. Check `domainPatterns` regex in `src/discovery/index.ts`

### Debugging Parser Issues
1. Enable debug logging in parser
2. Check raw log format matches supported patterns
3. Use `parser.parseLine()` directly in Node REPL to test
4. Add new format to `logFormats` array if needed

### Performance Optimization
- Batch log inserts in storage layer (already implemented)
- Adjust `monitoring.batch_size` in config
- Use indexes on frequently queried fields
- Run SQLite `VACUUM` and `ANALYZE` periodically
- Monitor memory with `--max-old-space-size` Node flag

### Adding Internationalization
1. Add translations to `src/i18n/locales/` (en.json, es.json, etc.)
2. Use `t('key.path')` in CLI code
3. Update `web/static/js/i18n.js` for frontend
4. Set language preference in config or env var

## Project Status

This is a feature-complete, production-ready log monitoring solution as documented in `PROJECT_STATUS.md`. All core features are implemented and tested. The codebase is well-structured for extensibility through the plugin system.
