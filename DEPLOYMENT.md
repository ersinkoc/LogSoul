# 🚀 LogSoul Deployment Guide

This guide covers deploying LogSoul in various environments from development to enterprise production.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Cloud Deployments](#cloud-deployments)
- [Security Hardening](#security-hardening)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### System Requirements
- **CPU**: 2+ cores (4+ recommended for production)
- **RAM**: 4GB minimum (8GB+ recommended)
- **Storage**: 20GB minimum (SSD recommended)
- **OS**: Linux (Ubuntu 20.04+, CentOS 8+, RHEL 8+)

### Software Dependencies
- **Node.js**: 16.0.0 or higher
- **npm**: 7.0.0 or higher
- **SQLite3**: Latest version
- **Python**: 3.6+ (for some npm packages)
- **Git**: For source deployment

## 🛠️ Development Setup

### Quick Development Setup
```bash
# Clone repository
git clone https://github.com/user/logsoul.git
cd logsoul

# Install dependencies
npm install

# Build project
npm run build

# Initialize LogSoul
npm run cli init

# Start development server
npm run dev
```

### Development Configuration
```yaml
# logsoul.yaml for development
server:
  port: 3000
  host: "localhost"

storage:
  db_path: "./dev-logsoul.db"
  retention_days: 7

monitoring:
  scan_interval: 30s
  batch_size: 100

log_paths:
  - "./test/testdata"
  - "./logs"

alerts:
  email:
    enabled: false
  webhook:
    enabled: false
```

## 🏭 Production Deployment

### 1. System Preparation

#### Create LogSoul User
```bash
# Create dedicated user
sudo adduser --system --group --home /opt/logsoul logsoul

# Create directories
sudo mkdir -p /opt/logsoul/{app,data,logs,backups}
sudo chown -R logsoul:logsoul /opt/logsoul
```

#### Install Node.js (Ubuntu/Debian)
```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### Install Node.js (CentOS/RHEL)
```bash
# Add NodeSource repository
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -

# Install Node.js
sudo yum install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Application Deployment

#### Deploy Application Files
```bash
# Switch to logsoul user
sudo su - logsoul

# Navigate to app directory
cd /opt/logsoul/app

# Clone repository (or upload built artifacts)
git clone https://github.com/user/logsoul.git .

# Install production dependencies
npm ci --only=production

# Build application
npm run build

# Create production configuration
cp configs/logsoul.yaml logsoul.yaml
```

#### Production Configuration
```yaml
# /opt/logsoul/app/logsoul.yaml
server:
  port: 3000
  host: "0.0.0.0"

storage:
  db_path: "/opt/logsoul/data/logsoul.db"
  retention_days: 90

monitoring:
  scan_interval: 60s
  batch_size: 1000
  max_file_size: 1GB

log_paths:
  - "/var/log/nginx"
  - "/var/log/apache2"
  - "/var/www/vhosts"
  - "/home/*/logs"

alerts:
  email:
    enabled: true
    smtp_server: "smtp.company.com:587"
  webhook:
    enabled: true
    url: "https://hooks.slack.com/your-webhook"

# Security settings
auth:
  jwt_secret: "your-super-secure-jwt-secret-here"
  session_timeout: 480
  max_login_attempts: 5
```

### 3. Systemd Service Setup

#### Create Service File
```bash
sudo tee /etc/systemd/system/logsoul.service << 'EOF'
[Unit]
Description=LogSoul - Smart Log Monitoring
Documentation=https://github.com/user/logsoul
After=network.target
Wants=network.target

[Service]
Type=simple
User=logsoul
Group=logsoul
WorkingDirectory=/opt/logsoul/app
ExecStart=/usr/bin/node dist/src/index.js
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=10
KillMode=mixed
KillSignal=SIGINT
TimeoutStopSec=30

# Environment
Environment=NODE_ENV=production
Environment=NODE_OPTIONS="--max-old-space-size=2048"

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/logsoul/data /opt/logsoul/logs /opt/logsoul/backups
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=logsoul

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable logsoul
sudo systemctl start logsoul

# Check status
sudo systemctl status logsoul
```

### 4. Nginx Reverse Proxy

#### Install Nginx
```bash
sudo apt-get install nginx  # Ubuntu/Debian
sudo yum install nginx      # CentOS/RHEL
```

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/logsoul
server {
    listen 80;
    server_name logsoul.yourcompany.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name logsoul.yourcompany.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/logsoul.crt;
    ssl_certificate_key /etc/ssl/private/logsoul.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Logging
    access_log /var/log/nginx/logsoul_access.log;
    error_log /var/log/nginx/logsoul_error.log;

    # Main application
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        # ... other proxy settings
    }
}

# Rate limiting zone
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
}
```

#### Enable Site
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/logsoul /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 5. SSL/TLS Setup

#### Using Let's Encrypt
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d logsoul.yourcompany.com

# Test auto-renewal
sudo certbot renew --dry-run
```

#### Using Custom Certificates
```bash
# Copy certificates
sudo cp your-certificate.crt /etc/ssl/certs/logsoul.crt
sudo cp your-private.key /etc/ssl/private/logsoul.key

# Set permissions
sudo chmod 644 /etc/ssl/certs/logsoul.crt
sudo chmod 600 /etc/ssl/private/logsoul.key
```

## 🐳 Docker Deployment

### Single Container Deployment

#### Build Image
```bash
# Build Docker image
docker build -t logsoul:1.0.0 .

# Tag for registry
docker tag logsoul:1.0.0 your-registry.com/logsoul:1.0.0
```

#### Run Container
```bash
# Create data volume
docker volume create logsoul-data

# Run LogSoul container
docker run -d \
  --name logsoul \
  --restart unless-stopped \
  -p 3000:3000 \
  -v logsoul-data:/app/data \
  -v /var/log:/host/var/log:ro \
  -v /var/www:/host/var/www:ro \
  -e NODE_ENV=production \
  logsoul:1.0.0
```

### Docker Compose Deployment

#### Production docker-compose.yml
```yaml
version: '3.8'

services:
  logsoul:
    build: .
    container_name: logsoul
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - logsoul-data:/app/data
      - logsoul-backups:/app/backups
      - /var/log:/host/var/log:ro
      - /var/www:/host/var/www:ro
      - ./logsoul.yaml:/app/logsoul.yaml:ro
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: nginx:alpine
    container_name: logsoul-proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - logsoul
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  prometheus:
    image: prom/prometheus:latest
    container_name: logsoul-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./configs/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    container_name: logsoul-grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}

volumes:
  logsoul-data:
  logsoul-backups:
  prometheus-data:
  grafana-data:

networks:
  default:
    name: logsoul-network
```

#### Environment File (.env)
```bash
# Security
JWT_SECRET=your-super-secure-jwt-secret-minimum-64-characters-long
GRAFANA_PASSWORD=secure-grafana-admin-password

# Database
DATABASE_URL=sqlite:///app/data/logsoul.db

# Monitoring
PROMETHEUS_RETENTION=30d
```

## ☸️ Kubernetes Deployment

### Namespace and ConfigMap
```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: logsoul

---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: logsoul-config
  namespace: logsoul
data:
  logsoul.yaml: |
    server:
      port: 3000
      host: "0.0.0.0"
    storage:
      db_path: "/app/data/logsoul.db"
      retention_days: 90
    monitoring:
      scan_interval: 60s
      batch_size: 1000
    log_paths:
      - "/var/log"
    alerts:
      email:
        enabled: true
      webhook:
        enabled: true
```

### Secret
```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: logsoul-secrets
  namespace: logsoul
type: Opaque
data:
  jwt-secret: <base64-encoded-jwt-secret>
  db-password: <base64-encoded-db-password>
```

### Deployment
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: logsoul
  namespace: logsoul
  labels:
    app: logsoul
spec:
  replicas: 2
  selector:
    matchLabels:
      app: logsoul
  template:
    metadata:
      labels:
        app: logsoul
    spec:
      serviceAccountName: logsoul
      containers:
      - name: logsoul
        image: logsoul:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: logsoul-secrets
              key: jwt-secret
        volumeMounts:
        - name: config
          mountPath: /app/logsoul.yaml
          subPath: logsoul.yaml
        - name: data
          mountPath: /app/data
        - name: logs
          mountPath: /var/log
          readOnly: true
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: config
        configMap:
          name: logsoul-config
      - name: data
        persistentVolumeClaim:
          claimName: logsoul-data
      - name: logs
        hostPath:
          path: /var/log
```

### Service and Ingress
```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: logsoul-service
  namespace: logsoul
spec:
  selector:
    app: logsoul
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP

---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: logsoul-ingress
  namespace: logsoul
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - logsoul.yourcompany.com
    secretName: logsoul-tls
  rules:
  - host: logsoul.yourcompany.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: logsoul-service
            port:
              number: 80
```

## ☁️ Cloud Deployments

### AWS Deployment

#### Using ECS with Fargate
```json
{
  "family": "logsoul",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "logsoul",
      "image": "your-account.dkr.ecr.region.amazonaws.com/logsoul:1.0.0",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:logsoul/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/logsoul",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Google Cloud Platform

#### Using Cloud Run
```yaml
# cloudrun.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: logsoul
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/memory: "2Gi"
        run.googleapis.com/cpu: "1000m"
    spec:
      containers:
      - image: gcr.io/project-id/logsoul:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        resources:
          limits:
            memory: 2Gi
            cpu: 1000m
```

### Azure Container Instances

#### ARM Template
```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": [
    {
      "type": "Microsoft.ContainerInstance/containerGroups",
      "apiVersion": "2019-12-01",
      "name": "logsoul",
      "location": "[resourceGroup().location]",
      "properties": {
        "containers": [
          {
            "name": "logsoul",
            "properties": {
              "image": "logsoul:1.0.0",
              "ports": [
                {
                  "port": 3000,
                  "protocol": "TCP"
                }
              ],
              "environmentVariables": [
                {
                  "name": "NODE_ENV",
                  "value": "production"
                }
              ],
              "resources": {
                "requests": {
                  "cpu": 1,
                  "memoryInGB": 2
                }
              }
            }
          }
        ],
        "osType": "Linux",
        "ipAddress": {
          "type": "Public",
          "ports": [
            {
              "port": 3000,
              "protocol": "TCP"
            }
          ]
        }
      }
    }
  ]
}
```

## 🔒 Security Hardening

### System Security
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Install fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### Application Security
```yaml
# Additional security settings in logsoul.yaml
security:
  rate_limiting:
    enabled: true
    window_ms: 900000  # 15 minutes
    max_requests: 100
  
  cors:
    origin: ["https://logsoul.yourcompany.com"]
    credentials: true
  
  headers:
    csp: "default-src 'self'; script-src 'self' 'unsafe-inline'"
    hsts: "max-age=31536000; includeSubDomains; preload"
  
  auth:
    enforce_https: true
    secure_cookies: true
    session_timeout: 480  # 8 hours
```

### Database Security
```bash
# Encrypt database file
sudo apt install ecryptfs-utils

# Create encrypted directory
sudo mkdir /opt/logsoul/data-encrypted
sudo mount -t ecryptfs /opt/logsoul/data-encrypted /opt/logsoul/data

# Set proper permissions
sudo chown logsoul:logsoul /opt/logsoul/data
sudo chmod 700 /opt/logsoul/data
```

## 📊 Monitoring & Maintenance

### Health Checks
```bash
#!/bin/bash
# /opt/logsoul/scripts/healthcheck.sh

# Check if service is running
if ! systemctl is-active --quiet logsoul; then
    echo "CRITICAL: LogSoul service is not running"
    exit 2
fi

# Check API health
if ! curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "CRITICAL: LogSoul API is not responding"
    exit 2
fi

# Check disk space
DISK_USAGE=$(df /opt/logsoul/data | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    echo "WARNING: Disk usage is $DISK_USAGE%"
    exit 1
fi

echo "OK: LogSoul is healthy"
exit 0
```

### Backup Strategy
```bash
#!/bin/bash
# /opt/logsoul/scripts/backup.sh

BACKUP_DIR="/opt/logsoul/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="logsoul_backup_$DATE.tar.gz"

# Create backup
cd /opt/logsoul
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
    data/ \
    app/logsoul.yaml \
    logs/

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "logsoul_backup_*.tar.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_FILE"
```

### Log Rotation
```bash
# /etc/logrotate.d/logsoul
/opt/logsoul/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 logsoul logsoul
    postrotate
        systemctl reload logsoul
    endscript
}
```

## 🔧 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check service status
sudo systemctl status logsoul

# Check logs
sudo journalctl -u logsoul -f

# Check configuration
npm run cli -- config validate

# Check permissions
sudo ls -la /opt/logsoul/
```

#### High Memory Usage
```bash
# Monitor memory usage
top -p $(pgrep -f "node.*logsoul")

# Check for memory leaks
node --inspect=0.0.0.0:9229 dist/src/index.js

# Adjust Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### Database Issues
```bash
# Check database file
sudo ls -la /opt/logsoul/data/logsoul.db

# Backup and repair database
sqlite3 /opt/logsoul/data/logsoul.db ".backup /tmp/backup.db"
sqlite3 /opt/logsoul/data/logsoul.db "PRAGMA integrity_check;"
```

#### Permission Denied Errors
```bash
# Fix ownership
sudo chown -R logsoul:logsoul /opt/logsoul/

# Fix permissions
sudo chmod 755 /opt/logsoul/
sudo chmod 644 /opt/logsoul/app/logsoul.yaml
sudo chmod 600 /opt/logsoul/data/logsoul.db
```

### Performance Tuning

#### Node.js Optimization
```bash
# Set production environment
export NODE_ENV=production

# Optimize memory usage
export NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"

# Enable cluster mode (if needed)
export CLUSTER_MODE=true
export CLUSTER_WORKERS=4
```

#### Database Optimization
```sql
-- Regular maintenance queries
PRAGMA optimize;
VACUUM;
ANALYZE;

-- Index optimization
CREATE INDEX IF NOT EXISTS idx_logs_domain_timestamp_status 
ON logs(domain_id, timestamp, status);
```

This deployment guide provides comprehensive coverage for deploying LogSoul in various environments. Choose the deployment method that best fits your infrastructure and requirements.

For additional support, refer to the main README.md or open an issue on GitHub.