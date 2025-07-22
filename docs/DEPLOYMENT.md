# 🚀 Deployment Guide

## Overview

This guide covers deploying the P2P Messenger application in various environments, from local development to production cloud deployments.

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (`npm run test:all`)
- [ ] Code coverage meets requirements (>80%)
- [ ] No security vulnerabilities (`npm audit`)
- [ ] Documentation updated
- [ ] Environment variables configured

### Build Verification
- [ ] Production build successful (`npm run build`)
- [ ] Build artifacts verified (`npm run preview`)
- [ ] Bundle size optimized
- [ ] Static assets properly referenced

## Local Development Deployment

### Quick Start
```bash
# Install dependencies
npm install

# Start development environment
npm run dev:full
```

### Manual Setup
```bash
# Terminal 1: Start signaling server
npm run server

# Terminal 2: Start React development server
npm run dev
```

### Verification
- Frontend: http://localhost:3000
- Signaling Server: http://localhost:4000
- Health Check: http://localhost:4000/health (if implemented)

## Production Build Process

### 1. Environment Preparation
```bash
# Set production environment
export NODE_ENV=production

# Install production dependencies only
npm ci --only=production
```

### 2. Frontend Build
```bash
# Build React application
npm run build

# Verify build output
ls -la dist/
```

### 3. Build Artifacts
```
dist/
├── index.html          # Main HTML file
├── assets/
│   ├── index-[hash].js # Main JavaScript bundle
│   ├── index-[hash].css # Styles
│   └── vendor-[hash].js # Vendor libraries
└── favicon.ico         # Application icon
```

## Server Deployment Options

### Option 1: Traditional VPS/Server

#### System Requirements
- Ubuntu 20.04+ or CentOS 8+
- Node.js 18+
- nginx (recommended)
- SSL certificate

#### Installation Steps
```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install nginx
sudo apt install nginx -y

# 4. Create application user
sudo useradd -m -s /bin/bash p2pmessenger
sudo su - p2pmessenger

# 5. Deploy application
git clone <repository-url> p2p-messenger
cd p2p-messenger
npm ci --only=production
npm run build
```

#### nginx Configuration
```nginx
# /etc/nginx/sites-available/p2p-messenger
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL Configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # Serve static files
    location / {
        root /home/p2pmessenger/p2p-messenger/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Proxy signaling server
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Process Management (PM2)
```bash
# Install PM2
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'p2p-messenger-server',
    script: 'server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    }
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Option 2: Docker Deployment

#### Dockerfile
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production image
FROM node:18-alpine AS production

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S p2puser -u 1001
USER p2puser

EXPOSE 4000

CMD ["node", "server/index.js"]
```

#### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  p2p-messenger:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
      - CORS_ORIGIN=https://your-domain.com
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./dist:/usr/share/nginx/html
    depends_on:
      - p2p-messenger
    restart: unless-stopped
```

#### Deployment Commands
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Update deployment
docker-compose pull
docker-compose up -d --force-recreate
```

### Option 3: Cloud Platform Deployment

#### Heroku Deployment
```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create your-p2p-messenger

# Configure environment
heroku config:set NODE_ENV=production
heroku config:set NPM_CONFIG_PRODUCTION=false

# Create Procfile
echo "web: node server/index.js" > Procfile

# Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

#### Vercel Deployment (Frontend Only)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy frontend
vercel --prod

# Configure custom domain
vercel domains add your-domain.com
```

#### Railway Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

## Environment Configuration

### Production Environment Variables
```bash
# Server Configuration
NODE_ENV=production
PORT=4000

# CORS Configuration
CORS_ORIGIN=https://your-domain.com

# Socket.IO Configuration
SOCKET_IO_PING_TIMEOUT=60000
SOCKET_IO_PING_INTERVAL=25000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Security
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100        # requests per window
```

### Frontend Configuration
```javascript
// src/config/production.js
export const config = {
  signalingServer: 'https://your-domain.com',
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }
};
```

## SSL/TLS Configuration

### Let's Encrypt (Certbot)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Manual SSL Setup
```bash
# Generate private key
openssl genrsa -out private.key 2048

# Generate certificate signing request
openssl req -new -key private.key -out certificate.csr

# Install certificate files
sudo cp certificate.crt /etc/ssl/certs/
sudo cp private.key /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/private.key
```

## Monitoring and Logging

### Application Monitoring
```javascript
// server/monitoring.js
const express = require('express');
const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    connections: io.engine.clientsCount,
    rooms: rooms.size,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  });
});
```

### Log Configuration
```javascript
// server/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console()
  ]
});
```

## Performance Optimization

### Frontend Optimization
```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          p2p: ['./src/lib/P2PApp.js']
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

### Server Optimization
```javascript
// server/index.js optimizations
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');

const app = express();

// Security headers
app.use(helmet());

// Compression
app.use(compression());

// Static file caching
app.use(express.static('dist', {
  maxAge: '1y',
  etag: true
}));
```

## Backup and Recovery

### Database Backup (if applicable)
```bash
# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application data
tar -czf $BACKUP_DIR/p2p-messenger-$DATE.tar.gz \
  /home/p2pmessenger/p2p-messenger

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

### Recovery Procedure
```bash
# Stop application
pm2 stop p2p-messenger-server

# Restore from backup
tar -xzf /backups/p2p-messenger-YYYYMMDD_HHMMSS.tar.gz -C /

# Restart application
pm2 start p2p-messenger-server
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
sudo lsof -i :4000

# Kill process
sudo kill -9 <PID>
```

#### Permission Denied
```bash
# Fix file permissions
sudo chown -R p2pmessenger:p2pmessenger /home/p2pmessenger/p2p-messenger
sudo chmod -R 755 /home/p2pmessenger/p2p-messenger
```

#### SSL Certificate Issues
```bash
# Test SSL certificate
openssl s_client -connect your-domain.com:443

# Verify certificate chain
curl -I https://your-domain.com
```

### Log Analysis
```bash
# View application logs
pm2 logs p2p-messenger-server

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# View system logs
sudo journalctl -u nginx -f
```

## Security Hardening

### Server Security
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# Disable root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

### Application Security
```javascript
// Rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
```
