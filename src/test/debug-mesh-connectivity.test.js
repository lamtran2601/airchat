import { describe, it, expect, beforeEach, vi } from "vitest";
import { P2PApp } from "../lib/P2PApp.js";

// Mock socket.io-client
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connected: true,
    id: "mock-socket-id"
  }))
}));

// Mock WebRTC
global.RTCPeerConnection = vi.fn(() => ({
  createDataChannel: vi.fn(() => ({
    addEventListener: vi.fn(),
    close: vi.fn(),
    readyState: "open",
    send: vi.fn()
  })),
  setLocalDescription: vi.fn(),
  setRemoteDescription: vi.fn(),
  createOffer: vi.fn(() => Promise.resolve({ type: "offer", sdp: "mock-offer" })),
  createAnswer: vi.fn(() => Promise.resolve({ type: "answer", sdp: "mock-answer" })),
  addIceCandidate: vi.fn(),
  close: vi.fn(),
  connectionState: "connected",
  signalingState: "stable",
  iceConnectionState: "connected",
  getStats: vi.fn(() => Promise.resolve(new Map())),
  onconnectionstatechange: null,
  oniceconnectionstatechange: null,
  onsignalingstatechange: null,
  ondatachannel: null
}));

describe("Debug Mesh Connectivity Issues", () => {
  let app;

  beforeEach(async () => {
    const { io } = await import("socket.io-client");
    io.mockImplementation(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      connected: true,
      id: "test-peer"
    }));

    app = new P2PApp();
  });

  it("should analyze hash distribution for typical socket.io peer IDs", () => {
    // Simulate typical socket.io peer IDs (random strings)
    const typicalPeerIds = [
      "abc123def456",
      "xyz789ghi012", 
      "mno345pqr678",
      "stu901vwx234"
    ];

    console.log("\n=== Hash Distribution Analysis ===");
    
    const hashResults = typicalPeerIds.map(peerId => ({
      peerId,
      hash: app.hashPeerId(peerId)
    }));

    hashResults.forEach(result => {
      console.log(`Peer: ${result.peerId} → Hash: ${result.hash}`);
    });

    // Test all possible connection pairs
    console.log("\n=== Connection Initiation Matrix ===");
    for (let i = 0; i < typicalPeerIds.length; i++) {
      for (let j = i + 1; j < typicalPeerIds.length; j++) {
        const peerA = typicalPeerIds[i];
        const peerB = typicalPeerIds[j];
        
        const aInitiatesB = app.shouldInitiateConnection(peerA, peerB);
        const bInitiatesA = app.shouldInitiateConnection(peerB, peerA);
        
        console.log(`${peerA} → ${peerB}: ${aInitiatesB ? 'A initiates' : 'A waits'}`);
        console.log(`${peerB} → ${peerA}: ${bInitiatesA ? 'B initiates' : 'B waits'}`);
        
        // Verify exactly one initiates
        expect(aInitiatesB).not.toBe(bInitiatesA);
        console.log(`✓ Exactly one peer initiates\n`);
      }
    }
  });

  it("should test hash function with real socket.io IDs", () => {
    // These are examples of actual socket.io generated IDs
    const realSocketIds = [
      "QAhRXzbBmzgWIJIEAABD",
      "XYz9KmN3pQrStUvWxAbC", 
      "LmOpQrStUvWxYz123456",
      "AbCdEfGhIjKlMnOpQrSt"
    ];

    console.log("\n=== Real Socket.io ID Analysis ===");
    
    const connections = [];
    for (let i = 0; i < realSocketIds.length; i++) {
      for (let j = i + 1; j < realSocketIds.length; j++) {
        const peerA = realSocketIds[i];
        const peerB = realSocketIds[j];
        
        const aInitiates = app.shouldInitiateConnection(peerA, peerB);
        const initiator = aInitiates ? peerA : peerB;
        const responder = aInitiates ? peerB : peerA;
        
        connections.push({ initiator, responder });
        console.log(`${initiator} → ${responder}`);
      }
    }

    // Count how many connections each peer initiates
    const initiationCounts = {};
    realSocketIds.forEach(id => initiationCounts[id] = 0);
    
    connections.forEach(conn => {
      initiationCounts[conn.initiator]++;
    });

    console.log("\n=== Initiation Load Distribution ===");
    Object.entries(initiationCounts).forEach(([peerId, count]) => {
      console.log(`${peerId}: initiates ${count} connections`);
    });

    // Check if distribution is reasonably balanced
    const counts = Object.values(initiationCounts);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    const imbalance = maxCount - minCount;
    
    console.log(`\nLoad imbalance: ${imbalance} (max: ${maxCount}, min: ${minCount})`);
    
    // For 4 peers (6 total connections), ideal distribution is 1-2 per peer
    // Acceptable imbalance is ≤ 2
    if (imbalance > 2) {
      console.warn(`⚠️ High load imbalance detected: ${imbalance}`);
    }
  });

  it("should test connection timeout behavior", async () => {
    await app.connect();
    
    console.log("\n=== Connection Timeout Test ===");
    
    // Mock setTimeout to track timeout calls
    const originalSetTimeout = global.setTimeout;
    const timeoutCalls = [];
    
    global.setTimeout = vi.fn((callback, delay) => {
      timeoutCalls.push({ callback, delay });
      return originalSetTimeout(callback, delay);
    });

    // Test timeout setting
    app.setConnectionTimeout("test-peer");
    
    expect(timeoutCalls).toHaveLength(1);
    expect(timeoutCalls[0].delay).toBe(3000);
    
    console.log(`✓ Timeout set for 3000ms`);
    
    // Test timeout cleanup
    app.setConnectionTimeout("test-peer-2");
    expect(app.connectionTimeouts.size).toBe(2);
    
    // Simulate receiving offer (should clear timeout)
    app.signaling.sendAnswer = vi.fn();
    await app.handleOffer("test-peer", { type: "offer", sdp: "mock" });
    
    expect(app.connectionTimeouts.has("test-peer")).toBe(false);
    console.log(`✓ Timeout cleared when offer received`);
    
    global.setTimeout = originalSetTimeout;
  });

  it("should analyze potential race conditions", () => {
    console.log("\n=== Race Condition Analysis ===");
    
    // Simulate scenario where multiple peers join simultaneously
    const peers = ["peer-A", "peer-B", "peer-C", "peer-D"];
    
    // Check if any peer becomes a "super-initiator"
    const initiationMatrix = {};
    peers.forEach(p1 => {
      initiationMatrix[p1] = [];
      peers.forEach(p2 => {
        if (p1 !== p2) {
          const shouldInitiate = app.shouldInitiateConnection(p1, p2);
          if (shouldInitiate) {
            initiationMatrix[p1].push(p2);
          }
        }
      });
    });

    console.log("Initiation responsibilities:");
    Object.entries(initiationMatrix).forEach(([peer, targets]) => {
      console.log(`${peer} initiates to: [${targets.join(', ')}] (${targets.length} connections)`);
    });

    // Check for super-initiator (peer that initiates to everyone)
    const superInitiators = Object.entries(initiationMatrix)
      .filter(([peer, targets]) => targets.length === peers.length - 1);
    
    if (superInitiators.length > 0) {
      console.warn(`⚠️ Super-initiator detected: ${superInitiators.map(([peer]) => peer).join(', ')}`);
      console.warn("This will cause hub-and-spoke topology!");
    } else {
      console.log("✓ No super-initiators detected");
    }
  });

  it("should test improved hash function", () => {
    console.log("\n=== Testing Improved Hash Function ===");
    
    // Test with a better hash function
    const improvedHash = (peerId) => {
      let hash = 5381; // DJB2 hash algorithm
      for (let i = 0; i < peerId.length; i++) {
        hash = ((hash << 5) + hash) + peerId.charCodeAt(i);
      }
      return Math.abs(hash);
    };

    const testPeers = [
      "QAhRXzbBmzgWIJIEAABD",
      "XYz9KmN3pQrStUvWxAbC", 
      "LmOpQrStUvWxYz123456",
      "AbCdEfGhIjKlMnOpQrSt"
    ];

    console.log("Current hash vs Improved hash:");
    testPeers.forEach(peerId => {
      const currentHash = app.hashPeerId(peerId);
      const improvedHashValue = improvedHash(peerId);
      console.log(`${peerId}:`);
      console.log(`  Current: ${currentHash}`);
      console.log(`  Improved: ${improvedHashValue}`);
    });

    // Test distribution with improved hash
    const improvedInitiationCounts = {};
    testPeers.forEach(id => improvedInitiationCounts[id] = 0);
    
    for (let i = 0; i < testPeers.length; i++) {
      for (let j = i + 1; j < testPeers.length; j++) {
        const peerA = testPeers[i];
        const peerB = testPeers[j];
        
        const hashA = improvedHash(peerA);
        const hashB = improvedHash(peerB);
        
        const aInitiates = hashA < hashB || (hashA === hashB && peerA < peerB);
        
        if (aInitiates) {
          improvedInitiationCounts[peerA]++;
        } else {
          improvedInitiationCounts[peerB]++;
        }
      }
    }

    console.log("\nImproved hash distribution:");
    Object.entries(improvedInitiationCounts).forEach(([peerId, count]) => {
      console.log(`${peerId}: ${count} initiations`);
    });

    const improvedCounts = Object.values(improvedInitiationCounts);
    const improvedImbalance = Math.max(...improvedCounts) - Math.min(...improvedCounts);
    console.log(`Improved imbalance: ${improvedImbalance}`);
  });
});
