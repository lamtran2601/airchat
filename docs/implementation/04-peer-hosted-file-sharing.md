# Peer-Hosted File Sharing Design

## Overview

This document outlines a direct peer-to-peer file transfer system that eliminates server involvement in file sharing, enabling efficient, scalable, and private file transfers between users while supporting advanced features like resumable transfers, file indexing, and distributed storage.

## Current File Transfer Analysis

### Existing Capabilities
- Basic file transfer framework exists in documentation
- WebRTC data channels support binary data transfer
- Chunked transfer with progress tracking implemented

### Current Limitations
1. **No file persistence**: Files not stored for offline users
2. **No file discovery**: No way to browse or search shared files
3. **Single-source transfers**: Files only available from original sender
4. **No resume capability**: Failed transfers must restart completely
5. **Limited scalability**: Large files burden single peer

## Peer-Hosted File Sharing Architecture

### 1. File Transfer Protocol

#### Enhanced File Message Structure
```javascript
const fileTransferProtocol = {
  // File offer/discovery
  FILE_OFFER: {
    type: "file_offer",
    fileId: "file_abc123",
    metadata: {
      name: "document.pdf",
      size: 1048576,
      mimeType: "application/pdf",
      hash: "sha256:...",
      thumbnail: "data:image/jpeg;base64,...",
      description: "Project documentation",
      tags: ["project", "documentation"],
      created: 1640995200000,
      modified: 1640995200000
    },
    availability: {
      sources: ["peer-alice-123", "peer-bob-456"],
      replicas: 2,
      lastSeen: 1640995200000
    },
    transfer: {
      chunkSize: 16384,
      totalChunks: 64,
      compression: "gzip",
      encryption: "aes-256"
    }
  },

  // File request/acceptance
  FILE_REQUEST: {
    type: "file_request",
    fileId: "file_abc123",
    requesterId: "peer-charlie-789",
    chunks: [0, 1, 2], // Specific chunks requested
    priority: "normal", // "low", "normal", "high"
    bandwidth: 1000000  // Available bandwidth (bytes/sec)
  },

  // Chunk transfer
  FILE_CHUNK: {
    type: "file_chunk",
    fileId: "file_abc123",
    chunkIndex: 0,
    chunkHash: "sha256:...",
    data: ArrayBuffer, // Binary chunk data
    isLast: false
  },

  // Transfer control
  FILE_PAUSE: { type: "file_pause", fileId: "file_abc123" },
  FILE_RESUME: { type: "file_resume", fileId: "file_abc123" },
  FILE_CANCEL: { type: "file_cancel", fileId: "file_abc123" },
  FILE_COMPLETE: { type: "file_complete", fileId: "file_abc123" }
};
```

#### Multi-Source File Transfer
```javascript
class MultiSourceFileTransfer {
  constructor() {
    this.activeTransfers = new Map(); // fileId -> transferState
    this.chunkSources = new Map(); // fileId -> Map(chunkIndex -> sources[])
    this.downloadStrategy = new AdaptiveDownloadStrategy();
  }

  async downloadFile(fileId, sources) {
    const transfer = {
      fileId,
      sources: new Set(sources),
      chunks: new Map(), // chunkIndex -> { data, hash, verified }
      totalChunks: 0,
      downloadedChunks: 0,
      failedChunks: new Set(),
      activeSources: new Map(), // sourceId -> connection
      bandwidth: new Map(), // sourceId -> bandwidth
      startTime: Date.now()
    };

    this.activeTransfers.set(fileId, transfer);

    try {
      // Get file metadata from any source
      const metadata = await this.getFileMetadata(fileId, sources);
      transfer.metadata = metadata;
      transfer.totalChunks = metadata.transfer.totalChunks;

      // Establish connections to sources
      await this.connectToSources(transfer);

      // Start parallel chunk downloads
      await this.downloadChunksParallel(transfer);

      // Verify and assemble file
      const fileData = await this.assembleFile(transfer);
      
      this.activeTransfers.delete(fileId);
      return fileData;

    } catch (error) {
      this.activeTransfers.delete(fileId);
      throw error;
    }
  }

  async downloadChunksParallel(transfer) {
    const { fileId, totalChunks, activeSources } = transfer;
    const downloadPromises = [];

    // Distribute chunks across sources
    const chunkAssignments = this.downloadStrategy.assignChunks(
      totalChunks, 
      activeSources
    );

    for (const [sourceId, chunks] of chunkAssignments) {
      downloadPromises.push(
        this.downloadChunksFromSource(transfer, sourceId, chunks)
      );
    }

    await Promise.allSettled(downloadPromises);

    // Handle failed chunks
    if (transfer.failedChunks.size > 0) {
      await this.retryFailedChunks(transfer);
    }
  }

  async downloadChunksFromSource(transfer, sourceId, chunkIndexes) {
    const connection = transfer.activeSources.get(sourceId);
    
    for (const chunkIndex of chunkIndexes) {
      try {
        const chunk = await this.requestChunk(
          connection, 
          transfer.fileId, 
          chunkIndex
        );
        
        // Verify chunk integrity
        if (await this.verifyChunk(chunk)) {
          transfer.chunks.set(chunkIndex, chunk);
          transfer.downloadedChunks++;
          this.emit('chunk-downloaded', { 
            fileId: transfer.fileId, 
            progress: transfer.downloadedChunks / transfer.totalChunks 
          });
        } else {
          transfer.failedChunks.add(chunkIndex);
        }
      } catch (error) {
        transfer.failedChunks.add(chunkIndex);
      }
    }
  }
}
```

### 2. Distributed File Storage

#### Peer File Index
```javascript
class PeerFileIndex {
  constructor() {
    this.localFiles = new Map(); // fileId -> fileInfo
    this.sharedFiles = new Map(); // fileId -> shareInfo
    this.remoteFiles = new Map(); // fileId -> remoteFileInfo
    this.fileStorage = new FileStorage();
  }

  async shareFile(file, options = {}) {
    const fileId = await this.generateFileId(file);
    const fileInfo = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      hash: await this.calculateFileHash(file),
      chunks: await this.createChunks(file),
      metadata: {
        description: options.description || "",
        tags: options.tags || [],
        created: Date.now(),
        permissions: options.permissions || "contacts"
      },
      availability: {
        local: true,
        replicas: 0,
        sources: [this.peerId]
      }
    };

    // Store file locally
    await this.fileStorage.storeFile(fileId, file);
    this.localFiles.set(fileId, fileInfo);

    // Announce to network if public
    if (options.announce !== false) {
      await this.announceFile(fileInfo);
    }

    return fileId;
  }

  async announceFile(fileInfo) {
    const announcement = {
      type: "file_announcement",
      fileId: fileInfo.id,
      metadata: fileInfo.metadata,
      availability: fileInfo.availability,
      peerId: this.peerId
    };

    // Broadcast to connected peers
    await this.broadcastToNetwork(announcement);

    // Store in distributed index
    await this.storeInDistributedIndex(fileInfo);
  }

  async searchFiles(query, options = {}) {
    const results = new Map();

    // Search local files
    const localResults = this.searchLocalFiles(query);
    this.mergeResults(results, localResults);

    // Search remote indexes
    if (options.includeRemote !== false) {
      const remoteResults = await this.searchRemoteIndexes(query);
      this.mergeResults(results, remoteResults);
    }

    return this.rankSearchResults(results, query);
  }
}
```

#### File Replication System
```javascript
class FileReplicationSystem {
  constructor() {
    this.replicationPolicy = {
      minReplicas: 2,
      maxReplicas: 5,
      replicationFactor: 0.1, // 10% of connected peers
      priorityFiles: new Set() // High-priority files
    };
    this.replicationQueue = new PriorityQueue();
  }

  async replicateFile(fileId, targetReplicas) {
    const fileInfo = await this.getFileInfo(fileId);
    if (!fileInfo) throw new Error("File not found");

    const currentReplicas = fileInfo.availability.sources.length;
    const neededReplicas = Math.max(0, targetReplicas - currentReplicas);

    if (neededReplicas === 0) return;

    // Select replication targets
    const targets = await this.selectReplicationTargets(
      fileId, 
      neededReplicas
    );

    // Start replication to targets
    const replicationPromises = targets.map(targetPeer =>
      this.replicateToTarget(fileId, targetPeer)
    );

    const results = await Promise.allSettled(replicationPromises);
    
    // Update file availability
    const successfulReplicas = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    await this.updateFileAvailability(fileId, successfulReplicas);
    
    return successfulReplicas;
  }

  async selectReplicationTargets(fileId, count) {
    const connectedPeers = this.getConnectedPeers();
    const fileInfo = await this.getFileInfo(fileId);
    const existingSources = new Set(fileInfo.availability.sources);

    // Filter out existing sources
    const candidates = connectedPeers.filter(peer => 
      !existingSources.has(peer.id)
    );

    // Score candidates based on:
    // - Available storage space
    // - Connection reliability
    // - Geographic distribution
    // - Load balancing
    const scoredCandidates = candidates.map(peer => ({
      peer,
      score: this.calculateReplicationScore(peer, fileInfo)
    }));

    // Select top candidates
    scoredCandidates.sort((a, b) => b.score - a.score);
    return scoredCandidates.slice(0, count).map(c => c.peer);
  }
}
```

### 3. Resumable and Adaptive Transfers

#### Transfer State Management
```javascript
class TransferStateManager {
  constructor() {
    this.transferStates = new Map(); // transferId -> state
    this.persistentStorage = new PersistentStorage();
  }

  async saveTransferState(transferId, state) {
    // Save to memory
    this.transferStates.set(transferId, state);

    // Persist to storage for resume capability
    await this.persistentStorage.saveTransferState(transferId, {
      fileId: state.fileId,
      totalChunks: state.totalChunks,
      downloadedChunks: Array.from(state.chunks.keys()),
      sources: Array.from(state.sources),
      metadata: state.metadata,
      timestamp: Date.now()
    });
  }

  async resumeTransfer(transferId) {
    // Load from persistent storage
    const savedState = await this.persistentStorage.loadTransferState(transferId);
    if (!savedState) throw new Error("Transfer state not found");

    // Reconstruct transfer state
    const transfer = {
      fileId: savedState.fileId,
      totalChunks: savedState.totalChunks,
      chunks: new Map(),
      downloadedChunks: savedState.downloadedChunks.length,
      sources: new Set(savedState.sources),
      metadata: savedState.metadata,
      resumed: true
    };

    // Load existing chunks
    for (const chunkIndex of savedState.downloadedChunks) {
      const chunkData = await this.loadChunk(savedState.fileId, chunkIndex);
      if (chunkData) {
        transfer.chunks.set(chunkIndex, chunkData);
      }
    }

    this.transferStates.set(transferId, transfer);
    return transfer;
  }
}
```

#### Adaptive Bandwidth Management
```javascript
class AdaptiveBandwidthManager {
  constructor() {
    this.bandwidthHistory = new Map(); // sourceId -> measurements[]
    this.congestionControl = new CongestionControl();
    this.qualityOfService = new QoSManager();
  }

  async optimizeTransfer(transfer) {
    const sources = Array.from(transfer.activeSources.keys());
    
    // Measure current bandwidth for each source
    const measurements = await Promise.all(
      sources.map(sourceId => this.measureBandwidth(sourceId))
    );

    // Update bandwidth history
    sources.forEach((sourceId, index) => {
      this.updateBandwidthHistory(sourceId, measurements[index]);
    });

    // Adjust chunk assignments based on performance
    const newAssignments = this.calculateOptimalAssignments(
      transfer, 
      measurements
    );

    // Apply new assignments
    await this.redistributeChunks(transfer, newAssignments);
  }

  calculateOptimalAssignments(transfer, bandwidthMeasurements) {
    const totalBandwidth = bandwidthMeasurements.reduce((sum, bw) => sum + bw, 0);
    const remainingChunks = transfer.totalChunks - transfer.downloadedChunks;
    
    const assignments = new Map();
    
    bandwidthMeasurements.forEach((bandwidth, index) => {
      const sourceId = Array.from(transfer.activeSources.keys())[index];
      const proportion = bandwidth / totalBandwidth;
      const assignedChunks = Math.floor(remainingChunks * proportion);
      
      assignments.set(sourceId, assignedChunks);
    });

    return assignments;
  }
}
```

### 4. File Discovery and Browsing

#### Distributed File Catalog
```javascript
class DistributedFileCatalog {
  constructor() {
    this.localCatalog = new Map(); // category -> files[]
    this.remoteCatalogs = new Map(); // peerId -> catalog
    this.catalogSync = new CatalogSynchronizer();
  }

  async browseFiles(category, options = {}) {
    const results = [];

    // Get local files
    const localFiles = this.localCatalog.get(category) || [];
    results.push(...localFiles);

    // Query remote catalogs
    if (options.includeRemote !== false) {
      const remoteFiles = await this.queryRemoteCatalogs(category);
      results.push(...remoteFiles);
    }

    // Apply filters and sorting
    return this.filterAndSortFiles(results, options);
  }

  async publishFileCatalog() {
    const catalog = {
      peerId: this.peerId,
      categories: {},
      lastUpdated: Date.now(),
      totalFiles: 0
    };

    // Build category index
    for (const [category, files] of this.localCatalog) {
      catalog.categories[category] = files.map(file => ({
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type,
        tags: file.metadata.tags,
        created: file.metadata.created,
        description: file.metadata.description
      }));
      catalog.totalFiles += files.length;
    }

    // Broadcast catalog to network
    await this.broadcastCatalog(catalog);
    
    // Store in distributed index
    await this.storeInDistributedIndex(catalog);
  }
}
```

### 5. Security and Privacy

#### Encrypted File Sharing
```javascript
class EncryptedFileSharing {
  constructor() {
    this.keyManager = new FileKeyManager();
    this.encryptionAlgorithm = "AES-256-GCM";
  }

  async shareEncryptedFile(file, recipients, options = {}) {
    // Generate file encryption key
    const fileKey = await this.keyManager.generateFileKey();
    
    // Encrypt file
    const encryptedFile = await this.encryptFile(file, fileKey);
    
    // Share file normally
    const fileId = await this.shareFile(encryptedFile, options);
    
    // Distribute keys to recipients
    for (const recipient of recipients) {
      await this.shareFileKey(fileId, fileKey, recipient);
    }

    return fileId;
  }

  async shareFileKey(fileId, fileKey, recipientPeerId) {
    // Encrypt file key with recipient's public key
    const recipientPublicKey = await this.getRecipientPublicKey(recipientPeerId);
    const encryptedKey = await this.encryptForRecipient(fileKey, recipientPublicKey);
    
    // Send encrypted key
    await this.sendMessage(recipientPeerId, {
      type: "file_key_share",
      fileId,
      encryptedKey,
      algorithm: this.encryptionAlgorithm
    });
  }
}
```

## Implementation Benefits

### 1. Zero Server Bandwidth Usage
- **Direct peer transfers** eliminate server file relay
- **Distributed storage** removes server storage requirements
- **Peer-hosted indexes** reduce server database load

### 2. Enhanced Performance and Scalability
- **Multi-source downloads** increase transfer speeds
- **Automatic replication** improves availability
- **Adaptive bandwidth** optimizes network usage

### 3. Advanced Features
- **Resumable transfers** handle network interruptions
- **File discovery** enables content browsing
- **Encrypted sharing** protects sensitive files

### 4. Reliability and Redundancy
- **Multiple replicas** prevent data loss
- **Distributed indexes** eliminate single points of failure
- **Graceful degradation** maintains functionality during peer departures

This peer-hosted file sharing system provides enterprise-grade file transfer capabilities while completely eliminating server dependencies for file storage and transfer.
