// Simple script to analyze hash distribution issues
import { P2PApp } from "../lib/P2PApp.js";

// Mock minimal setup
const mockApp = new P2PApp();

// Test with realistic socket.io peer IDs
const testPeers = [
  "QAhRXzbBmzgWIJIEAABD", // Real socket.io ID from your error
  "XYz9KmN3pQrStUvWxAbC",
  "LmOpQrStUvWxYz123456",
  "AbCdEfGhIjKlMnOpQrSt",
];

console.log("=== HASH DISTRIBUTION ANALYSIS ===\n");

// Analyze current hash function
console.log("Current Hash Values:");
testPeers.forEach((peerId) => {
  const hash = mockApp.hashPeerId(peerId);
  console.log(`${peerId} → ${hash}`);
});

console.log("\n=== CONNECTION INITIATION MATRIX ===\n");

// Test all possible connection pairs
const connections = [];
const initiationCounts = {};
testPeers.forEach((id) => (initiationCounts[id] = 0));

for (let i = 0; i < testPeers.length; i++) {
  for (let j = i + 1; j < testPeers.length; j++) {
    const peerA = testPeers[i];
    const peerB = testPeers[j];

    const aInitiates = mockApp.shouldInitiateConnection(peerA, peerB);
    const initiator = aInitiates ? peerA : peerB;
    const responder = aInitiates ? peerB : peerA;

    connections.push({ initiator, responder });
    initiationCounts[initiator]++;

    console.log(`${initiator} → ${responder}`);
  }
}

console.log("\n=== LOAD DISTRIBUTION ===\n");
Object.entries(initiationCounts).forEach(([peerId, count]) => {
  console.log(`${peerId}: initiates ${count} connections`);
});

const counts = Object.values(initiationCounts);
const maxCount = Math.max(...counts);
const minCount = Math.min(...counts);
const imbalance = maxCount - minCount;

console.log(
  `\nLoad imbalance: ${imbalance} (max: ${maxCount}, min: ${minCount})`
);

if (imbalance > 2) {
  console.log(
    "❌ HIGH IMBALANCE DETECTED - This causes hub-and-spoke topology!"
  );
} else {
  console.log("✅ Acceptable load distribution");
}

// Check for super-initiators
const superInitiators = Object.entries(initiationCounts).filter(
  ([peer, count]) => count === testPeers.length - 1
);

if (superInitiators.length > 0) {
  console.log(
    `\n❌ SUPER-INITIATOR DETECTED: ${superInitiators
      .map(([peer]) => peer)
      .join(", ")}`
  );
  console.log(
    "This peer will become a hub, causing the exact problem you're experiencing!"
  );
}

console.log("\n=== IMPROVED HASH FUNCTION TEST ===\n");

// Test with DJB2 hash algorithm (better distribution)
const improvedHash = (peerId) => {
  let hash = 5381;
  for (let i = 0; i < peerId.length; i++) {
    hash = (hash << 5) + hash + peerId.charCodeAt(i);
  }
  return Math.abs(hash);
};

console.log("Improved Hash Values:");
testPeers.forEach((peerId) => {
  const currentHash = mockApp.hashPeerId(peerId);
  const improvedHashValue = improvedHash(peerId);
  console.log(`${peerId}:`);
  console.log(`  Current:  ${currentHash}`);
  console.log(`  Improved: ${improvedHashValue}`);
});

// Test improved distribution
const improvedInitiationCounts = {};
testPeers.forEach((id) => (improvedInitiationCounts[id] = 0));

console.log("\nImproved Connection Matrix:");
for (let i = 0; i < testPeers.length; i++) {
  for (let j = i + 1; j < testPeers.length; j++) {
    const peerA = testPeers[i];
    const peerB = testPeers[j];

    const hashA = improvedHash(peerA);
    const hashB = improvedHash(peerB);

    const aInitiates = hashA < hashB || (hashA === hashB && peerA < peerB);
    const initiator = aInitiates ? peerA : peerB;
    const responder = aInitiates ? peerB : peerA;

    improvedInitiationCounts[initiator]++;
    console.log(`${initiator} → ${responder}`);
  }
}

console.log("\nImproved Load Distribution:");
Object.entries(improvedInitiationCounts).forEach(([peerId, count]) => {
  console.log(`${peerId}: initiates ${count} connections`);
});

const improvedCounts = Object.values(improvedInitiationCounts);
const improvedImbalance =
  Math.max(...improvedCounts) - Math.min(...improvedCounts);
console.log(`\nImproved imbalance: ${improvedImbalance}`);

if (improvedImbalance < imbalance) {
  console.log("✅ IMPROVED HASH FUNCTION PROVIDES BETTER DISTRIBUTION!");
} else {
  console.log("⚠️ Improved hash function doesn't help much");
}

console.log("\n=== RECOMMENDATIONS ===\n");

if (imbalance > 2) {
  console.log(
    "1. 🔧 CRITICAL: Replace current hash function with improved version"
  );
  console.log("2. 🔧 Add connection retry mechanism for failed attempts");
  console.log("3. 🔧 Implement periodic mesh validation and repair");
}

if (superInitiators.length > 0) {
  console.log(
    "4. 🔧 URGENT: Current hash creates super-initiators - this is the root cause!"
  );
}

console.log("5. 🔧 Consider using peer ID comparison as tiebreaker");
console.log("6. 🔧 Add connection state debugging logs");
console.log("7. 🔧 Implement mesh topology validation");

console.log("\n=== TESTING CORRECTED BALANCED ALGORITHM ===\n");

// Test the new balanced algorithm
const newInitiationCounts = {};
testPeers.forEach((id) => (newInitiationCounts[id] = 0));

console.log("New Balanced Connection Matrix:");
for (let i = 0; i < testPeers.length; i++) {
  for (let j = i + 1; j < testPeers.length; j++) {
    const peerA = testPeers[i];
    const peerB = testPeers[j];

    // Use the new algorithm
    const aInitiates = mockApp.shouldInitiateConnection(peerA, peerB);
    const initiator = aInitiates ? peerA : peerB;
    const responder = aInitiates ? peerB : peerA;

    newInitiationCounts[initiator]++;
    console.log(`${initiator} → ${responder}`);
  }
}

console.log("\nNew Balanced Load Distribution:");
Object.entries(newInitiationCounts).forEach(([peerId, count]) => {
  console.log(`${peerId}: initiates ${count} connections`);
});

const newCounts = Object.values(newInitiationCounts);
const newImbalance = Math.max(...newCounts) - Math.min(...newCounts);
console.log(`\nNew algorithm imbalance: ${newImbalance}`);

if (newImbalance <= 1) {
  console.log(
    "✅ EXCELLENT! New algorithm provides perfect/near-perfect balance!"
  );
} else if (newImbalance < imbalance) {
  console.log("✅ GOOD! New algorithm is better than current one");
} else {
  console.log("❌ New algorithm doesn't improve the situation");
}

// Check for super-initiators in new algorithm
const newSuperInitiators = Object.entries(newInitiationCounts).filter(
  ([peer, count]) => count === testPeers.length - 1
);

if (newSuperInitiators.length === 0) {
  console.log("✅ NO SUPER-INITIATORS! Problem solved!");
} else {
  console.log(
    `❌ Still has super-initiators: ${newSuperInitiators
      .map(([peer]) => peer)
      .join(", ")}`
  );
}
