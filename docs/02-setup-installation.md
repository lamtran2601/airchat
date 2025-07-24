# 02 - Setup and Installation Guide

## 🚀 Complete Setup Instructions

### **Prerequisites**

Before setting up P2P Messenger, ensure you have the following installed:

#### **Required Software**
- **Node.js 18+** - JavaScript runtime
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify: `node --version` (should show v18.0.0 or higher)
- **npm or pnpm** - Package manager
  - npm comes with Node.js
  - For pnpm: `npm install -g pnpm`
- **Modern Web Browser** - With WebRTC support
  - Chrome 56+, Firefox 51+, Safari 11+, Edge 79+

#### **Development Tools (Optional)**
- **Git** - Version control
- **VS Code** - Recommended editor with extensions:
  - ES7+ React/Redux/React-Native snippets
  - Prettier - Code formatter
  - ESLint - JavaScript linter

### **📥 Installation Steps**

#### **Step 1: Clone the Repository**
```bash
# Clone the repository
git clone <repository-url>
cd p2p-messenger

# Or download and extract ZIP file
```

#### **Step 2: Install Dependencies**
```bash
# Using npm
npm install

# Using pnpm (recommended for faster installs)
pnpm install
```

#### **Step 3: Verify Installation**
```bash
# Check if all dependencies are installed
npm list --depth=0

# Should show packages like:
# ├── react@19.1.0
# ├── socket.io@4.8.1
# ├── vite@6.3.5
# └── ... (other dependencies)
```

### **🏃‍♂️ Quick Start**

#### **Option 1: Start Everything at Once (Recommended)**
```bash
# Start both signaling server and React app
npm run dev:full

# This will start:
# - Signaling server on http://localhost:4000
# - React development server on http://localhost:3000
```

#### **Option 2: Start Components Separately**
```bash
# Terminal 1: Start the signaling server
npm run server

# Terminal 2: Start the React development server
npm run dev
```

### **🌐 Accessing the Application**

1. **Open your browser** and navigate to `http://localhost:3000`
2. **Open a second browser tab/window** to `http://localhost:3000` (for testing P2P)
3. **Join the same room** in both tabs to establish P2P connection
4. **Start messaging** between the two instances

### **🔧 Configuration Options**

#### **Environment Variables**
Create a `.env` file in the project root for custom configuration:

```bash
# .env file
PORT=4000                    # Signaling server port
VITE_SIGNALING_URL=http://localhost:4000  # Frontend signaling URL
```

#### **Server Configuration**
Edit `server/index.js` for server customization:

```javascript
// Custom port
const PORT = process.env.PORT || 4000;

// Custom CORS settings
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://yourdomain.com"],
    methods: ["GET", "POST"]
  }
});
```

#### **Frontend Configuration**
Edit `src/App.jsx` for frontend customization:

```javascript
// Custom signaling server URL
const [p2pApp] = useState(
  () => new P2PApp({
    signalingServer: "http://localhost:4000", // Change this URL
  })
);
```

### **📱 Browser Compatibility**

#### **Supported Browsers**
| Browser | Minimum Version | WebRTC Support | Notes |
|---------|----------------|----------------|-------|
| Chrome | 56+ | ✅ Full | Recommended |
| Firefox | 51+ | ✅ Full | Excellent |
| Safari | 11+ | ✅ Full | Good |
| Edge | 79+ | ✅ Full | Good |

#### **Required Browser Features**
- **WebRTC** - Peer-to-peer communication
- **WebSocket** - Signaling server connection
- **ES2020+** - Modern JavaScript features
- **File API** - File transfer capabilities

### **🔍 Troubleshooting**

#### **Common Issues**

**1. Port Already in Use**
```bash
# Error: EADDRINUSE: address already in use :::4000
# Solution: Kill process using the port
lsof -ti:4000 | xargs kill -9

# Or use different port
PORT=4001 npm run server
```

**2. WebRTC Connection Failed**
```bash
# Check browser console for errors
# Common causes:
# - Firewall blocking WebRTC
# - Browser doesn't support WebRTC
# - Network restrictions (corporate networks)
```

**3. Signaling Server Connection Failed**
```bash
# Check if server is running
curl http://localhost:4000

# Check browser network tab for WebSocket errors
# Verify CORS settings in server/index.js
```

**4. File Transfer Not Working**
```bash
# Check browser console for file-related errors
# Verify file size limits (default: no limit, but browser memory limited)
# Check WebRTC data channel status
```

#### **Debug Mode**
Enable debug logging by opening browser console and running:
```javascript
// Enable verbose logging
localStorage.setItem('debug', 'p2p:*');
// Refresh page to see debug logs
```

### **🧪 Testing the Installation**

#### **Basic Functionality Test**
1. **Start the application**: `npm run dev:full`
2. **Open two browser tabs** to `http://localhost:3000`
3. **Join same room** (e.g., "test123") in both tabs
4. **Send messages** between tabs
5. **Test file transfer** by selecting a small file

#### **Multi-Peer Test**
1. **Open 3+ browser tabs** to the application
2. **Join same room** in all tabs
3. **Verify mesh connections** (each peer connects to all others)
4. **Test group messaging** and file sharing

#### **Network Test**
1. **Test on different devices** on same network
2. **Use actual IP address** instead of localhost
3. **Test file transfer** between different devices

### **🔧 Development Setup**

#### **Additional Development Tools**
```bash
# Install development dependencies (already included)
npm install --save-dev

# Install global tools (optional)
npm install -g concurrently  # For running multiple commands
```

#### **IDE Configuration**
**VS Code Settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  }
}
```

#### **Git Hooks Setup** (Optional)
```bash
# Install husky for git hooks
npm install --save-dev husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run test:unit"
```

### **📦 Production Build**

#### **Build for Production**
```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

#### **Deploy Static Files**
The `dist/` folder contains all static files for deployment to:
- **Netlify** - Drag and drop deployment
- **Vercel** - Git-based deployment
- **GitHub Pages** - Static hosting
- **Any static hosting service**

### **🔄 Update Instructions**

#### **Updating Dependencies**
```bash
# Check for outdated packages
npm outdated

# Update all dependencies
npm update

# Update specific package
npm install package-name@latest
```

#### **Updating the Application**
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Restart application
npm run dev:full
```

### **📞 Getting Help**

If you encounter issues:

1. **Check the console** for error messages
2. **Review this documentation** for common solutions
3. **Check existing issues** in the project repository
4. **Create a new issue** with:
   - Operating system and version
   - Browser and version
   - Node.js version
   - Error messages and console logs
   - Steps to reproduce the issue

### **🎯 Next Steps**

After successful installation:
- **Read the [User Guide](./05-user-guide.md)** to learn how to use the application
- **Check the [Development Guide](./06-development-guide.md)** for contributing
- **Review the [Architecture Guide](./03-architecture-guide.md)** to understand the system
