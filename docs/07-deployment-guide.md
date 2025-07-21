# 🚀 Deployment Guide

This guide covers deploying the P2P Chat application to production environments.

## 📋 Prerequisites

- Node.js 18+
- pnpm 8+
- Git repository access
- Cloud platform accounts (Vercel, Railway, etc.)

## 🏗️ Build Process

### 1. Prepare for Production

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Type check
pnpm type-check

# Lint code
pnpm lint

# Build all packages
pnpm build
```

### 2. Environment Configuration

**Frontend Environment Variables:**

```env
VITE_SIGNALING_URL=https://your-signaling-server.railway.app
VITE_DEV_MODE=false
```

**Server Environment Variables:**

```env
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
```

## 🌐 Frontend Deployment (Vercel)

### Option 1: Vercel CLI

1. **Install Vercel CLI**

   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**

   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   cd apps/frontend
   vercel --prod
   ```

### Option 2: GitHub Integration

1. **Connect Repository**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Build Settings**
   - Framework Preset: `Vite`
   - Root Directory: `apps/frontend`
   - Build Command: `pnpm build`
   - Output Directory: `dist`

3. **Set Environment Variables**
   ```
   VITE_SIGNALING_URL=https://your-signaling-server.railway.app
   ```

### Option 3: Netlify

1. **Build Configuration (netlify.toml)**

   ```toml
   [build]
     base = "apps/frontend"
     command = "pnpm build"
     publish = "dist"

   [build.environment]
     NODE_VERSION = "18"
   ```

2. **Deploy**
   - Connect GitHub repository
   - Set build settings
   - Deploy

## 🖥️ Signaling Server Deployment (Railway)

### Option 1: Railway CLI

1. **Install Railway CLI**

   ```bash
   npm i -g @railway/cli
   ```

2. **Login to Railway**

   ```bash
   railway login
   ```

3. **Initialize Project**

   ```bash
   cd apps/signaling-server
   railway init
   ```

4. **Deploy**
   ```bash
   railway up
   ```

### Option 2: GitHub Integration

1. **Connect Repository**
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project"
   - Select "Deploy from GitHub repo"

2. **Configure Service**
   - Root Directory: `apps/signaling-server`
   - Build Command: `pnpm build`
   - Start Command: `pnpm start`

3. **Set Environment Variables**
   ```
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend.vercel.app
   ```

### Option 3: DigitalOcean App Platform

1. **Create App**
   - Go to DigitalOcean Apps
   - Create new app from GitHub

2. **Configure Build**
   ```yaml
   name: p2p-signaling-server
   services:
     - name: signaling-server
       source_dir: apps/signaling-server
       github:
         repo: your-username/p2p-chat
         branch: main
       run_command: pnpm start
       build_command: pnpm install && pnpm build
       environment_slug: node-js
       instance_count: 1
       instance_size_slug: basic-xxs
       envs:
         - key: NODE_ENV
           value: production
         - key: FRONTEND_URL
           value: https://your-frontend.vercel.app
   ```

## 🔧 Production Optimizations

### Frontend Optimizations

1. **Vite Configuration**

   ```typescript
   // vite.config.ts
   export default defineConfig({
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             vendor: ['react', 'react-dom'],
             ui: ['@headlessui/react', '@heroicons/react'],
           },
         },
       },
       minify: 'terser',
       sourcemap: false,
     },
   });
   ```

2. **PWA Configuration**
   - Service worker caching
   - Offline functionality
   - App manifest

### Server Optimizations

1. **Production Dependencies**

   ```bash
   pnpm install --prod
   ```

2. **Process Management**

   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start dist/index.js --name "signaling-server"
   ```

3. **Health Checks**
   ```typescript
   app.get('/health', (req, res) => {
     res.json({
       status: 'ok',
       timestamp: new Date().toISOString(),
       uptime: process.uptime(),
     });
   });
   ```

## 🔒 Security Configuration

### HTTPS Setup

1. **Frontend**: Automatically handled by Vercel/Netlify
2. **Server**: Configure SSL certificates

### CORS Configuration

```typescript
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
```

### Environment Security

- Never commit `.env` files
- Use platform-specific secret management
- Rotate secrets regularly

## 📊 Monitoring & Logging

### Application Monitoring

1. **Error Tracking**

   ```typescript
   // Add Sentry or similar
   import * as Sentry from '@sentry/node';

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
   });
   ```

2. **Performance Monitoring**
   ```typescript
   // Add performance metrics
   app.use((req, res, next) => {
     const start = Date.now();
     res.on('finish', () => {
       const duration = Date.now() - start;
       console.log(`${req.method} ${req.path} - ${duration}ms`);
     });
     next();
   });
   ```

### Health Monitoring

```bash
# Set up health check endpoints
curl https://your-server.railway.app/health
```

## 🚀 CI/CD Pipeline

The included GitHub Actions workflow automatically:

1. **Tests** code on push/PR
2. **Builds** applications
3. **Deploys** to production on main branch

### Required Secrets

Add these to your GitHub repository secrets:

```
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-org-id
VERCEL_PROJECT_ID=your-project-id
VITE_SIGNALING_URL=https://your-signaling-server.railway.app
```

## 🔄 Rollback Strategy

### Frontend Rollback

```bash
# Vercel
vercel --prod --force

# Netlify
netlify deploy --prod --dir=dist
```

### Server Rollback

```bash
# Railway
railway rollback

# Manual
git revert <commit-hash>
git push origin main
```

## 📈 Scaling Considerations

### Horizontal Scaling

1. **Load Balancing**: Use multiple signaling server instances
2. **Geographic Distribution**: Deploy servers in multiple regions
3. **Auto-scaling**: Configure based on connection count

### Performance Monitoring

- Monitor WebRTC connection success rates
- Track message delivery times
- Monitor file transfer speeds
- Watch server resource usage

## 🆘 Troubleshooting

### Common Issues

1. **CORS Errors**: Check FRONTEND_URL environment variable
2. **WebRTC Failures**: Verify STUN server accessibility
3. **Connection Issues**: Check firewall settings
4. **Build Failures**: Verify Node.js version compatibility

### Debug Commands

```bash
# Check server logs
railway logs

# Test signaling server
curl https://your-server.railway.app/health

# Check frontend build
pnpm build:frontend --debug
```

---

**🎉 Your P2P Chat application is now ready for production!**
