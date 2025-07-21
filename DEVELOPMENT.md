# Development Guide

This guide explains how to work with the P2P Chat monorepo for parallel development.

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development environment (builds packages + runs apps)
pnpm dev

# Clean all build outputs
pnpm clean
```

## Monorepo Structure

```
├── packages/           # Shared packages
│   ├── types/         # TypeScript type definitions
│   ├── p2p-core/      # Core P2P functionality
│   └── ui-components/ # Reusable UI components
├── apps/              # Applications
│   ├── frontend/      # React frontend app
│   └── signaling-server/ # WebSocket signaling server
└── docs/              # Documentation
```

## Parallel Development Workflows

### 1. Package Development

Work on individual packages independently:

```bash
# Work on types package
pnpm --filter @p2p/types dev

# Work on core package
pnpm --filter @p2p/core dev

# Work on UI components
pnpm --filter @p2p/ui dev

# Build specific package
pnpm --filter @p2p/core build
```

### 2. Application Development

Work on individual applications:

```bash
# Frontend development
pnpm --filter frontend dev

# Signaling server development
pnpm --filter signaling-server dev

# Build specific app
pnpm --filter frontend build
```

### 3. Cross-Package Development

When working on features that span multiple packages:

```bash
# Build packages first
pnpm build:packages

# Then start app development
pnpm --filter frontend dev
```

### 4. Full Development Environment

Start everything for full-stack development:

```bash
# Builds packages and starts all apps
pnpm dev
```

This will:

1. Build all packages
2. Start frontend on http://localhost:3000
3. Start signaling server on http://localhost:4000

## Build System

### Package Dependencies

- `@p2p/types` - Base types (no dependencies)
- `@p2p/core` - Core functionality (depends on types)
- `@p2p/ui` - UI components (depends on types)
- `frontend` - React app (depends on all packages)
- `signaling-server` - WebSocket server (independent)

### Build Order

Packages are built in dependency order automatically:

1. `@p2p/types`
2. `@p2p/core` and `@p2p/ui` (parallel)
3. Applications (parallel)

## Development Commands

### Root Level Commands

```bash
pnpm build              # Build everything
pnpm build:packages     # Build only packages
pnpm build:apps         # Build only applications
pnpm dev                # Development mode
pnpm dev:packages       # Watch mode for packages
pnpm dev:apps           # Development mode for apps
pnpm clean              # Clean all build outputs
pnpm clean:src          # Remove compiled files from src directories
pnpm test               # Run all tests
pnpm lint               # Lint all code
pnpm type-check         # Type check all code
```

### Package-Specific Commands

```bash
# Types package
pnpm --filter @p2p/types build
pnpm --filter @p2p/types dev
pnpm --filter @p2p/types clean

# Core package
pnpm --filter @p2p/core build
pnpm --filter @p2p/core dev
pnpm --filter @p2p/core test

# UI components
pnpm --filter @p2p/ui build
pnpm --filter @p2p/ui dev
pnpm --filter @p2p/ui lint
```

### Application-Specific Commands

```bash
# Frontend
pnpm --filter frontend dev
pnpm --filter frontend build
pnpm --filter frontend test
pnpm --filter frontend preview

# Signaling server
pnpm --filter signaling-server dev
pnpm --filter signaling-server build
pnpm --filter signaling-server start
```

## Best Practices

### 1. Package Development

- Always run `pnpm build:packages` after making changes to packages
- Use `pnpm --filter <package> dev` for watch mode during development
- Test package changes by building dependent packages/apps

### 2. Type Safety

- Changes to `@p2p/types` require rebuilding all dependent packages
- Use `pnpm type-check` to verify type correctness across the monorepo
- The build system ensures type compatibility between packages

### 3. Clean Builds

- Use `pnpm clean` before important builds or when troubleshooting
- The system prevents compiled files in `src/` directories
- Build outputs are only in `dist/` directories

### 4. Testing

- Run tests at package level: `pnpm --filter <package> test`
- Run all tests: `pnpm test`
- Tests run against built packages, so build first if needed

## Troubleshooting

### Build Issues

```bash
# Clean everything and rebuild
pnpm clean && pnpm build

# Check for compiled files in src directories
pnpm clean:src

# Verify package structure
pnpm --filter <package> build
```

### Development Issues

```bash
# Restart development with clean build
pnpm clean && pnpm dev

# Check specific package
pnpm --filter <package> type-check
```

### Port Conflicts

- Frontend: Default port 3000, auto-increments if busy
- Signaling server: Default port 4000
- Configure ports in respective `.env` files if needed

## Environment Variables

### Frontend (.env)

```
VITE_SIGNALING_URL=http://localhost:4000
```

### Signaling Server (.env)

```
PORT=4000
FRONTEND_URL=http://localhost:3000
```

## IDE Setup

### VS Code

Recommended extensions:

- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Auto Import - ES6, TS, JSX, TSX

### TypeScript

Each package has its own `tsconfig.json` with proper path mappings.
The root `tsconfig.json` provides workspace-wide settings.
