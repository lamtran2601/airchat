# Distributed Contact Discovery Design

## Overview

This document outlines a peer-assisted contact discovery system where peers help other peers find contacts, reducing server dependencies while maintaining privacy and enabling rich discovery features beyond simple room-based connections.

## Current Contact Discovery Limitations

### Existing System
- **Room-based only**: Users must know exact room IDs
- **No contact persistence**: No way to save or find previous contacts
- **No discovery features**: No browsing or searching capabilities
- **Server dependency**: All discovery requires server coordination

### Problems to Solve
1. **Bootstrap problem**: How do new users find anyone?
2. **Privacy concerns**: How to discover without exposing all users?
3. **Scalability**: How to avoid overwhelming any single peer?
4. **Reliability**: How to ensure discovery works when peers leave?

## Distributed Contact Discovery Architecture

### 1. Multi-Layer Discovery System

#### Layer 1: Local Contact Cache
```javascript
class LocalContactCache {
  constructor() {
    this.contacts = new Map(); // contactId -> contactInfo
    this.recentContacts = new LRUCache(100);
    this.favoriteContacts = new Set();
    this.blockedContacts = new Set();
  }

  addContact(contactInfo) {
    this.contacts.set(contactInfo.peerId, {
      ...contactInfo,
      lastSeen: Date.now(),
      addedAt: Date.now(),
      connectionHistory: []
    });
  }

  searchContacts(query) {
    const results = [];
    for (const [peerId, contact] of this.contacts) {
      if (this.matchesQuery(contact, query)) {
        results.push(contact);
      }
    }
    return this.rankResults(results, query);
  }
}
```

#### Layer 2: Peer Network Discovery
```javascript
class PeerNetworkDiscovery {
  constructor() {
    this.discoveryPeers = new Map(); // peerId -> capabilities
    this.discoveryRequests = new Map(); // requestId -> request
    this.sharedContacts = new Map(); // Contacts willing to be discovered
  }

  async discoverContacts(query, options = {}) {
    const results = new Map();
    
    // Query multiple discovery peers in parallel
    const discoveryPromises = [];
    
    for (const [peerId, capabilities] of this.discoveryPeers) {
      if (capabilities.contactDiscovery) {
        discoveryPromises.push(
          this.queryDiscoveryPeer(peerId, query, options)
        );
      }
    }

    // Collect results from all peers
    const responses = await Promise.allSettled(discoveryPromises);
    
    for (const response of responses) {
      if (response.status === 'fulfilled') {
        this.mergeDiscoveryResults(results, response.value);
      }
    }

    return this.rankAndFilterResults(results, query, options);
  }
}
```

#### Layer 3: Distributed Hash Table (DHT)
```javascript
class ContactDHT {
  constructor(peerId) {
    this.peerId = peerId;
    this.routingTable = new Map(); // Hash range -> responsible peers
    this.localData = new Map(); // Data we're responsible for
    this.replicationFactor = 3; // Number of replicas
  }

  async storeContact(contactInfo) {
    const hash = this.hashContact(contactInfo);
    const responsiblePeers = this.findResponsiblePeers(hash);
    
    const storePromises = responsiblePeers.map(peerId => 
      this.storeAtPeer(peerId, hash, contactInfo)
    );

    // Require majority success
    const results = await Promise.allSettled(storePromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    return successCount >= Math.ceil(responsiblePeers.length / 2);
  }

  async findContact(contactId) {
    const hash = this.hashContactId(contactId);
    const responsiblePeers = this.findResponsiblePeers(hash);
    
    // Query peers until we get a result
    for (const peerId of responsiblePeers) {
      try {
        const result = await this.queryPeer(peerId, hash);
        if (result) return result;
      } catch (error) {
        continue; // Try next peer
      }
    }
    
    return null;
  }
}
```

### 2. Privacy-Preserving Discovery

#### Opt-in Contact Sharing
```javascript
class PrivacyController {
  constructor() {
    this.sharingPreferences = {
      discoverableByAll: false,
      discoverableByContacts: true,
      discoverableByFriends: true,
      shareWithDiscoveryPeers: false,
      allowContactSharing: true
    };
    
    this.privacyLevels = {
      PUBLIC: "public",           // Discoverable by anyone
      CONTACTS: "contacts",       // Discoverable by existing contacts
      FRIENDS: "friends",         // Discoverable by friends only
      PRIVATE: "private"          // Not discoverable
    };
  }

  canShareContact(contactInfo, requesterInfo) {
    const contact = this.getContact(contactInfo.peerId);
    if (!contact) return false;

    switch (contact.privacyLevel) {
      case this.privacyLevels.PUBLIC:
        return true;
        
      case this.privacyLevels.CONTACTS:
        return this.isExistingContact(requesterInfo.peerId);
        
      case this.privacyLevels.FRIENDS:
        return this.isFriend(requesterInfo.peerId);
        
      case this.privacyLevels.PRIVATE:
      default:
        return false;
    }
  }

  createDiscoveryProfile() {
    return {
      peerId: this.peerId,
      displayName: this.getDisplayName(),
      avatar: this.getAvatar(),
      interests: this.getPublicInterests(),
      location: this.getGeneralLocation(), // City/region only
      lastActive: this.getLastActiveTime(),
      privacyLevel: this.sharingPreferences.discoverableByAll ? 
        this.privacyLevels.PUBLIC : this.privacyLevels.CONTACTS
    };
  }
}
```

#### Anonymous Discovery Queries
```javascript
class AnonymousDiscovery {
  constructor() {
    this.queryCache = new Map(); // Prevent query correlation
    this.mixingPeers = new Set(); // Peers that provide query mixing
  }

  async anonymousQuery(query, options = {}) {
    // Use query mixing to prevent correlation
    const mixedQuery = await this.mixQuery(query);
    
    // Route through mixing peers
    const mixingPeer = this.selectMixingPeer();
    
    return await this.sendMixedQuery(mixingPeer, mixedQuery, options);
  }

  async mixQuery(originalQuery) {
    // Add noise queries to prevent analysis
    const noiseQueries = this.generateNoiseQueries(originalQuery);
    
    return {
      queries: [originalQuery, ...noiseQueries],
      timestamp: Date.now(),
      mixingId: this.generateMixingId()
    };
  }
}
```

### 3. Discovery Methods and Protocols

#### Proximity-Based Discovery
```javascript
class ProximityDiscovery {
  constructor() {
    this.networkScanner = new NetworkScanner();
    this.bluetoothScanner = new BluetoothScanner();
    this.webrtcScanner = new WebRTCScanner();
  }

  async discoverNearbyPeers() {
    const discoveries = await Promise.allSettled([
      this.networkScanner.scan(),      // Local network scanning
      this.bluetoothScanner.scan(),    // Bluetooth discovery
      this.webrtcScanner.scan()        // WebRTC-based discovery
    ]);

    const nearbyPeers = [];
    for (const discovery of discoveries) {
      if (discovery.status === 'fulfilled') {
        nearbyPeers.push(...discovery.value);
      }
    }

    return this.filterAndRankNearbyPeers(nearbyPeers);
  }
}

class NetworkScanner {
  async scan() {
    // Scan local network for P2P messenger instances
    const localNetwork = this.getLocalNetworkRange();
    const scanPromises = [];

    for (const ip of localNetwork) {
      scanPromises.push(this.checkPeerAtIP(ip));
    }

    const results = await Promise.allSettled(scanPromises);
    return results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);
  }

  async checkPeerAtIP(ip) {
    try {
      // Try to connect to P2P messenger on standard ports
      const response = await this.pingPeer(ip);
      return response.peerInfo;
    } catch (error) {
      return null;
    }
  }
}
```

#### Interest-Based Discovery
```javascript
class InterestBasedDiscovery {
  constructor() {
    this.interestGraph = new Map(); // interest -> peers
    this.peerInterests = new Map(); // peerId -> interests
  }

  async findPeersByInterest(interests, options = {}) {
    const candidates = new Set();
    
    // Find peers with matching interests
    for (const interest of interests) {
      const peers = this.interestGraph.get(interest) || [];
      peers.forEach(peer => candidates.add(peer));
    }

    // Score peers by interest overlap
    const scoredPeers = [];
    for (const peerId of candidates) {
      const peerInterests = this.peerInterests.get(peerId) || [];
      const score = this.calculateInterestScore(interests, peerInterests);
      
      if (score > options.minScore || 0.3) {
        scoredPeers.push({ peerId, score, interests: peerInterests });
      }
    }

    return scoredPeers.sort((a, b) => b.score - a.score);
  }

  calculateInterestScore(queryInterests, peerInterests) {
    const intersection = queryInterests.filter(i => 
      peerInterests.includes(i)
    );
    const union = new Set([...queryInterests, ...peerInterests]);
    
    return intersection.length / union.size; // Jaccard similarity
  }
}
```

### 4. Discovery Coordination and Load Balancing

#### Discovery Peer Selection
```javascript
class DiscoveryCoordinator {
  constructor() {
    this.discoveryPeers = new Map();
    this.loadBalancer = new DiscoveryLoadBalancer();
    this.healthMonitor = new PeerHealthMonitor();
  }

  async selectDiscoveryPeers(query, count = 3) {
    // Get healthy discovery peers
    const healthyPeers = this.healthMonitor.getHealthyPeers();
    
    // Filter by capability and load
    const capablePeers = healthyPeers.filter(peer => 
      peer.capabilities.contactDiscovery &&
      peer.load < 0.8 // Not overloaded
    );

    // Select diverse peers for redundancy
    return this.loadBalancer.selectDiversePeers(capablePeers, count);
  }

  async distributeDiscoveryLoad() {
    const allPeers = Array.from(this.discoveryPeers.values());
    const overloadedPeers = allPeers.filter(peer => peer.load > 0.9);
    
    for (const peer of overloadedPeers) {
      await this.redistributeLoad(peer);
    }
  }
}
```

#### Caching and Replication
```javascript
class DiscoveryCache {
  constructor() {
    this.queryCache = new LRUCache(1000);
    this.contactCache = new LRUCache(5000);
    this.replicationManager = new ReplicationManager();
  }

  async cacheDiscoveryResult(query, results) {
    const cacheKey = this.hashQuery(query);
    const cacheEntry = {
      results,
      timestamp: Date.now(),
      ttl: 300000 // 5 minutes
    };

    this.queryCache.set(cacheKey, cacheEntry);
    
    // Replicate popular queries
    if (this.isPopularQuery(query)) {
      await this.replicationManager.replicateQuery(query, results);
    }
  }

  getCachedResult(query) {
    const cacheKey = this.hashQuery(query);
    const entry = this.queryCache.get(cacheKey);
    
    if (entry && (Date.now() - entry.timestamp) < entry.ttl) {
      return entry.results;
    }
    
    return null;
  }
}
```

### 5. Bootstrap and Fallback Mechanisms

#### Bootstrap Discovery
```javascript
class BootstrapDiscovery {
  constructor() {
    this.bootstrapPeers = [
      // Well-known bootstrap peers
      "bootstrap1.p2pmessenger.com",
      "bootstrap2.p2pmessenger.com"
    ];
    this.traditionalServer = new TraditionalServerDiscovery();
  }

  async bootstrapNetwork() {
    // Try bootstrap peers first
    for (const bootstrapPeer of this.bootstrapPeers) {
      try {
        const peers = await this.connectToBootstrap(bootstrapPeer);
        if (peers.length > 0) {
          return peers;
        }
      } catch (error) {
        continue; // Try next bootstrap peer
      }
    }

    // Fallback to traditional server
    return await this.traditionalServer.discoverPeers();
  }
}
```

## Implementation Benefits

### 1. Reduced Server Dependencies
- **Distributed contact storage** across peer network
- **Peer-assisted discovery** reduces server queries
- **Local caching** minimizes network requests

### 2. Enhanced Discovery Features
- **Rich search capabilities** beyond room IDs
- **Interest-based matching** for relevant connections
- **Proximity discovery** for local connections

### 3. Privacy and Security
- **Opt-in sharing** with granular privacy controls
- **Anonymous queries** prevent tracking
- **Encrypted contact data** protects sensitive information

### 4. Scalability and Reliability
- **Distributed load** across multiple peers
- **Redundant storage** prevents data loss
- **Graceful degradation** with fallback mechanisms

This distributed contact discovery system provides rich discovery features while maintaining privacy and reducing server dependencies through peer cooperation.
