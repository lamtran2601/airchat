# 08 - Deployment Guide

## 🚀 Production Deployment Guide

### **Deployment Overview**

P2P Messenger consists of two main components that can be deployed separately:
1. **Frontend (React App)**: Static files that can be hosted on any CDN
2. **Backend (Signaling Server)**: Node.js server that requires a hosting platform

### **🏗️ Architecture for Production**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Static CDN    │    │ Signaling Server│    │   Static CDN    │
│   (Frontend)    │    │   (Backend)     │    │   (Frontend)    │
│                 │    │                 │    │                 │
│ User A Browser  │◄──►│  WebSocket      │◄──►│ User B Browser  │
│                 │    │  Coordination   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         └──────────────────────────────────────────────┘
                    Direct P2P Connection
```

### **📦 Frontend Deployment**

#### **Build for Production**
```bash
# Create production build
npm run build

# Output directory: dist/
# Contains: index.html, assets/, and other static files
```

#### **Static Hosting Options**

**1. Netlify (Recommended)**
```bash
# Option 1: Drag and drop
# 1. Run `npm run build`
# 2. Drag `dist/` folder to Netlify dashboard
# 3. Configure custom domain if needed

# Option 2: Git-based deployment
# 1. Connect GitHub repository
# 2. Set build command: `npm run build`
# 3. Set publish directory: `dist`
# 4. Deploy automatically on git push
```

**2. Vercel**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Configuration in vercel.json:
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

**3. GitHub Pages**
```bash
# Install gh-pages
npm install --save-dev gh-pages

# Add to package.json scripts:
"deploy": "gh-pages -d dist"

# Deploy
npm run build
npm run deploy
```

**4. AWS S3 + CloudFront**
```bash
# Build and upload to S3
npm run build
aws s3 sync dist/ s3://your-bucket-name --delete

# Configure CloudFront for SPA routing
# Error Pages: 404 -> /index.html (200)
```

#### **Frontend Environment Configuration**
```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable for production
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          p2p: ['socket.io-client']
        }
      }
    }
  },
  define: {
    __SIGNALING_URL__: JSON.stringify(process.env.VITE_SIGNALING_URL || 'https://your-signaling-server.com')
  }
});
```

### **🖥️ Backend Deployment**

#### **Prepare for Production**
```javascript
// server/index.js - Production optimizations
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);

// Production CORS configuration
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      "https://yourdomain.com",
      "https://www.yourdomain.com"
    ],
    methods: ["GET", "POST"],
    credentials: false
  },
  // Production optimizations
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server running on port ${PORT}`);
});
```

#### **Hosting Platform Options**

**1. Railway (Recommended)**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Environment variables in Railway dashboard:
# PORT=4000
# ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**2. Heroku**
```bash
# Install Heroku CLI
# Create Procfile:
echo "web: node server/index.js" > Procfile

# Deploy
heroku create your-app-name
git push heroku main

# Set environment variables
heroku config:set ALLOWED_ORIGINS=https://yourdomain.com
```

**3. DigitalOcean App Platform**
```yaml
# .do/app.yaml
name: p2p-signaling-server
services:
- name: signaling-server
  source_dir: /
  github:
    repo: your-username/p2p-messenger
    branch: main
  run_command: node server/index.js
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: PORT
    value: "4000"
  - key: ALLOWED_ORIGINS
    value: "https://yourdomain.com"
```

**4. AWS EC2 with PM2**
```bash
# On EC2 instance
sudo apt update
sudo apt install nodejs npm

# Install PM2
npm install -g pm2

# Clone and setup
git clone your-repo
cd p2p-messenger
npm install

# Start with PM2
pm2 start server/index.js --name "p2p-signaling"
pm2 startup
pm2 save

# Configure nginx reverse proxy
sudo apt install nginx
```

**Nginx Configuration:**
```nginx
# /etc/nginx/sites-available/p2p-signaling
server {
    listen 80;
    server_name your-signaling-domain.com;
    
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### **🔒 SSL/HTTPS Configuration**

#### **Why HTTPS is Required**
- **WebRTC Requirement**: Modern browsers require HTTPS for WebRTC
- **Security**: Encrypted communication
- **Browser Features**: Camera, microphone access requires HTTPS

#### **SSL Certificate Options**

**1. Let's Encrypt (Free)**
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-signaling-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

**2. Cloudflare (Free)**
- Add domain to Cloudflare
- Enable "Full (strict)" SSL mode
- Use Cloudflare nameservers
- Automatic SSL certificate management

**3. Platform SSL**
- Railway: Automatic HTTPS
- Heroku: Automatic HTTPS
- Vercel: Automatic HTTPS
- Netlify: Automatic HTTPS

### **🌍 Environment Configuration**

#### **Environment Variables**

**Frontend (.env.production):**
```bash
VITE_SIGNALING_URL=https://your-signaling-server.com
VITE_APP_TITLE=P2P Messenger
VITE_MAX_FILE_SIZE=100000000  # 100MB
```

**Backend (.env):**
```bash
NODE_ENV=production
PORT=4000
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
MAX_ROOMS=1000
MAX_PEERS_PER_ROOM=20
LOG_LEVEL=info
```

#### **Production Configuration**
```javascript
// config/production.js
export const config = {
  signaling: {
    url: process.env.VITE_SIGNALING_URL || 'https://your-signaling-server.com',
    timeout: 10000,
    reconnectAttempts: 5
  },
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  },
  features: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxPeers: 20,
    enableFileTransfer: true,
    enableVoiceChat: false
  }
};
```

### **📊 Monitoring and Analytics**

#### **Health Monitoring**
```javascript
// server/monitoring.js
import express from 'express';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: io.engine.clientsCount
  });
});

// Metrics endpoint
router.get('/metrics', (req, res) => {
  res.json({
    activeRooms: rooms.size,
    totalConnections: io.engine.clientsCount,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

export default router;
```

#### **Error Tracking**
```javascript
// Add error tracking (e.g., Sentry)
import * as Sentry from '@sentry/node';

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production'
  });
}

// Error handling middleware
app.use(Sentry.Handlers.errorHandler());
```

#### **Logging**
```javascript
// server/logger.js
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

export default logger;
```

### **🔧 Performance Optimization**

#### **Frontend Optimizations**
```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          p2p: ['socket.io-client'],
          utils: ['lodash', 'date-fns']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
```

#### **Backend Optimizations**
```javascript
// server/index.js
const io = new Server(server, {
  // Connection limits
  maxHttpBufferSize: 1e6, // 1MB
  pingTimeout: 60000,
  pingInterval: 25000,
  
  // Compression
  compression: true,
  
  // Transport optimization
  transports: ['websocket'],
  allowEIO3: true
});

// Rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### **🔄 CI/CD Pipeline**

#### **GitHub Actions Example**
```yaml
# .github/workflows/deploy.yml
name: Deploy P2P Messenger

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v1.2
        with:
          publish-dir: './dist'
          production-branch: main
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@v1.0.0
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: "p2p-signaling-server"
```

### **🚨 Security Considerations**

#### **Production Security Checklist**
- [ ] HTTPS enabled for both frontend and backend
- [ ] CORS properly configured with specific origins
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] Error messages don't expose sensitive information
- [ ] Dependencies regularly updated
- [ ] Environment variables secured
- [ ] Monitoring and alerting configured

#### **Security Headers**
```javascript
// server/security.js
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "wss:", "https:"]
    }
  }
}));
```

### **📈 Scaling Considerations**

#### **Horizontal Scaling**
- **Multiple Signaling Servers**: Load balance with sticky sessions
- **CDN Distribution**: Global frontend distribution
- **Regional Deployment**: Deploy servers in multiple regions

#### **Monitoring Scaling Needs**
- **Connection Count**: Monitor active connections
- **Room Distribution**: Track room sizes and distribution
- **Resource Usage**: CPU, memory, network utilization
- **Response Times**: Monitor signaling latency

This deployment guide provides a comprehensive approach to taking P2P Messenger from development to production with proper security, monitoring, and scalability considerations.
