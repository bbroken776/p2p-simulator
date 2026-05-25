# P2P Network Simulator — Project Documentation

> **Version:** 1.0.0  
> **Stack:** NX Monorepo · NestJS · Next.js 14 · React Three Fiber · Socket.IO · Zustand · Chakra UI  
> **Author:** Filipe Guedes  
> **Last Updated:** May 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Purpose & Goals](#2-purpose--goals)
3. [Architecture](#3-architecture)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Tech Stack & Dependencies](#5-tech-stack--dependencies)
6. [Core Concepts](#6-core-concepts)
7. [Data Models](#7-data-models)
8. [API Reference](#8-api-reference)
9. [WebSocket Events](#9-websocket-events)
10. [Frontend Pages & Components](#10-frontend-pages--components)
11. [Use Cases](#11-use-cases)
12. [Node Lifecycle](#12-node-lifecycle)
13. [File Distribution Flow](#13-file-distribution-flow)
14. [Attack Simulations](#14-attack-simulations)
15. [Known Issues & Backlog](#15-known-issues--backlog)
16. [Development Setup](#16-development-setup)
17. [Environment Variables](#17-environment-variables)
18. [Glossary](#18-glossary)

---

## 1. Project Overview

**P2P Network Simulator** is a full-stack, real-time visualisation and simulation platform for
peer-to-peer (P2P) distributed networks. It simulates a **Kademlia-based DHT (Distributed Hash
Table)** combined with a **Gossip Protocol**, rendered as an interactive **3D network graph**
in the browser.

The simulator lets you observe, manipulate, and attack a live P2P network — all without any
real infrastructure. It is equal parts educational tool, research sandbox, and visual demo.

### What it does at a glance

- Spawns a configurable number of virtual P2P nodes, each with a unique 64-bit ID
- Nodes self-organise into a Kademlia DHT topology using XOR-distance routing
- Gossip rounds propagate metadata (file availability, peer lists) across the network automatically
- Files can be published (chunked + stored across multiple nodes) and looked up via DHT routing
- An attack module lets you inject Sybil nodes or launch Eclipse attacks against specific victims
- Everything is visualised in real-time as an animated 3D particle system in the browser

---

## 2. Purpose & Goals

### Primary Purpose

To provide an **interactive, educational visualisation** of how P2P protocols actually work under
the hood — specifically:

- How Kademlia DHT routes lookups in O(log n) hops
- How Gossip protocols propagate information through a network over time
- How files are chunked and distributed across multiple nodes
- How network attacks (Sybil, Eclipse) degrade network integrity

### Secondary Goals

- Serve as a **portfolio / demo project** showcasing full-stack engineering with advanced 3D UI
- Provide a **debugging/research tool** where network topology and behaviour can be controlled
  precisely and observed visually in real time
- Demonstrate **WebSocket-driven state synchronisation** between a NestJS backend and a
  Next.js frontend at low latency

### Non-Goals

- This is NOT a production P2P system — nodes are in-memory objects, not real machines
- This is NOT a blockchain or cryptocurrency simulator
- This does NOT simulate actual network latency or packet loss at the TCP layer

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Next.js)                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ NetworkMap3D │  │ ControlPanel │  │  EventLog / Metrics  │  │
│  │  (R3F / 3D)  │  │  (REST API)  │  │  (WebSocket store)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────▼──────────────────────┘              │
│                    Zustand Store                                 │
│              (snapshot · events · selectedNode)                 │
│                    │              │                             │
│              Socket.IO        fetch REST                        │
└─────────────┬──────┘──────────────┼─────────────────────────────┘
              │  WebSocket          │  HTTP
              ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (NestJS :3001)                      │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ SimulatorService│  │ NodesController│ │ FilesController   │  │
│  │ (tick loop)     │  │ POST/DELETE   │ │ POST /files       │  │
│  │ - gossip rounds │  │ /api/nodes    │ │ POST /files/lookup│  │
│  │ - DHT routing   │  └──────────────┘  └───────────────────┘  │
│  │ - file chunking │                                            │
│  └────────┬────────┘  ┌──────────────┐  ┌───────────────────┐  │
│           │           │AttacksController│ │NetworkGateway     │  │
│           │           │ POST /attacks │  │ (Socket.IO)       │  │
│           └───────────►              ├──► emits snapshot     │  │
│                       └──────────────┘  │ emits events       │  │
│                                         └───────────────────  │  │
└─────────────────────────────────────────────────────────────────┘
```

### Data flow summary

1. **Backend tick loop** runs every ~1000ms, advancing gossip rounds and node state
2. After each tick, `NetworkGateway` broadcasts `network:snapshot` to all WebSocket clients
3. Backend also emits `network:event` for discrete events (file published, node joined, etc.)
4. **Frontend Zustand store** receives both — snapshot replaces state, events are prepended to a
   rolling 200-item log
5. **NetworkMap3D** reads the store and renders the 3D scene — nodes, edges, particles
6. **ControlPanel** issues REST calls to mutate state (add/kill nodes, publish files, attacks)

---

## 4. Monorepo Structure

```
p2p-simulator/                        ← NX monorepo root
├── apps/
│   ├── frontend/                     ← Next.js 14 app (App Router)
│   │   ├── app/
│   │   │   ├── layout.tsx            ← Root layout, ThemeProvider
│   │   │   ├── page.tsx              ← Dashboard redirect
│   │   │   └── network/
│   │   │       └── page.tsx          ← Main simulator page
│   │   ├── components/
│   │   │   ├── network/
│   │   │   │   ├── NetworkMap3D.tsx  ← 3D visualisation (R3F)
│   │   │   │   ├── ControlPanel.tsx  ← Node/file/attack controls
│   │   │   │   ├── EventLog.tsx      ← Real-time event feed
│   │   │   │   └── MetricsBar.tsx    ← Top stats bar
│   │   │   └── ThemeProviderWrapper.tsx
│   │   ├── store/
│   │   │   └── network.store.ts      ← Zustand global state
│   │   ├── lib/
│   │   │   ├── api.ts                ← REST client (typed fetch wrapper)
│   │   │   └── socket.ts             ← Socket.IO singleton
│   │   └── .env.local                ← NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_WS_URL
│   │
│   └── backend/                      ← NestJS app
│       └── src/
│           ├── main.ts               ← Bootstrap, CORS config, port 3001
│           ├── app.module.ts
│           ├── simulator/
│           │   └── simulator.service.ts  ← Core simulation engine
│           ├── nodes/
│           │   └── nodes.controller.ts   ← POST/DELETE /api/nodes
│           ├── files/
│           │   └── files.controller.ts   ← POST /api/files, /api/files/lookup
│           ├── attacks/
│           │   └── attacks.controller.ts ← POST /api/attacks
│           ├── gateway/
│           │   └── network.gateway.ts    ← Socket.IO WebSocket gateway
│           └── snapshot/
│               └── snapshot.controller.ts ← GET /api/snapshot, /metrics, /events
│
└── packages/
    └── shared/                       ← @p2p-simulator/shared
        └── src/
            ├── types.ts              ← P2PNode, NetworkSnapshot, NetworkEvent, etc.
            └── constants.ts          ← WS_EVENTS, STATUS values
```

---

## 5. Tech Stack & Dependencies

### Frontend (`apps/frontend`)

| Package              | Version | Purpose                                        |
| -------------------- | ------- | ---------------------------------------------- |
| `next`               | 14.x    | React framework, App Router, SSR               |
| `react`              | 18.x    | UI library                                     |
| `@chakra-ui/react`   | 2.x     | Component library (dark theme)                 |
| `@react-three/fiber` | 8.x     | React renderer for Three.js                    |
| `@react-three/drei`  | 9.x     | R3F helpers: OrbitControls, Stars, Html, Trail |
| `three`              | 0.x     | WebGL 3D engine                                |
| `zustand`            | 4.x     | Global state management                        |
| `socket.io-client`   | 4.x     | WebSocket client                               |

### Backend (`apps/backend`)

| Package                      | Version | Purpose                              |
| ---------------------------- | ------- | ------------------------------------ |
| `@nestjs/core`               | 10.x    | NestJS framework                     |
| `@nestjs/websockets`         | 10.x    | WebSocket module                     |
| `@nestjs/platform-socket.io` | 10.x    | Socket.IO adapter                    |
| `socket.io`                  | 4.x     | WebSocket server                     |
| `uuid`                       | 9.x     | Random UUID generation for event IDs |

### Shared (`packages/shared`)

| Export            | Description                                  |
| ----------------- | -------------------------------------------- |
| `P2PNode`         | Node data shape                              |
| `NetworkSnapshot` | Full network state (nodes + edges + metrics) |
| `NetworkEvent`    | Single event (type + payload + severity)     |
| `NetworkMetrics`  | Aggregated stats                             |
| `WS_EVENTS`       | WebSocket event name constants               |

### Tooling

| Tool       | Purpose                                          |
| ---------- | ------------------------------------------------ |
| NX         | Monorepo task runner, build cache, project graph |
| TypeScript | Strict typing across all packages                |
| ESLint     | Linting                                          |
| Prettier   | Formatting                                       |

---

## 6. Core Concepts

### 6.1 Kademlia DHT

Kademlia is a distributed hash table where each node has a 64-bit ID and data is routed using
**XOR distance** — the numeric difference between two node IDs interpreted as a distance metric.

- Each node maintains a **routing table** split into **k-buckets**, one per bit-prefix range
- To find a file, a node queries the k closest known nodes and iteratively homes in
- Lookup converges in **O(log n)** hops where n is the number of nodes
- In this simulator, k-buckets are divided into 8 ranges (00–1f, 20–3f, ..., e0–ff)

### 6.2 Gossip Protocol

Gossip (also called epidemic protocol) spreads information the way a rumour spreads — each node
periodically tells a random subset of its peers what it knows.

- Every gossip tick, each node increments its `gossipRound` counter
- The node "tells" a few peers about its known files and peer list
- Over several rounds, all nodes converge on a consistent view of the network
- This is how file availability propagates after a file is published

### 6.3 File Chunking & Distribution

When a file is published:

1. The file content is base64-encoded by the client before sending
2. The backend splits it into one or more chunks
3. Each chunk gets a content-addressed ID (hash of content)
4. The chunk is stored on the k nodes closest to the chunk ID in the DHT keyspace
5. A lookup resolves by routing to those k-closest nodes and retrieving the chunk

### 6.4 Node Statuses

| Status     | Meaning                                                    |
| ---------- | ---------------------------------------------------------- |
| `active`   | Healthy, participating node                                |
| `idle`     | Connected but low activity (few messages, older join time) |
| `churned`  | Gracefully left the network (ghost node, fading out)       |
| `attacker` | Injected malicious Sybil node                              |
| `victim`   | Node being targeted by an Eclipse attack                   |

---

## 7. Data Models

### `P2PNode`

```typescript
interface P2PNode {
  id: string; // 16-char hex, e.g. "ef06f385ea1e476f"
  shortId: string; // First 6 chars for display, e.g. "ef06f3"
  status: 'active' | 'idle' | 'churned' | 'attacker' | 'victim';
  position: [number, number, number]; // 3D coordinates for visualisation
  peers: string[]; // List of peer node IDs
  kBuckets: KBucket[]; // Routing table
  files: string[]; // File/chunk IDs stored on this node
  messageCount: number; // Total messages processed
  gossipRound: number; // Current gossip round number
  uptimeMs: number; // Milliseconds since node joined
  joinedAt: number; // Unix timestamp of join
}

interface KBucket {
  rangeStart: string; // Hex range start, e.g. "00"
  rangeEnd: string; // Hex range end, e.g. "1f"
  peers: string[]; // Peer IDs in this XOR distance range
}
```

### `NetworkSnapshot`

```typescript
interface NetworkSnapshot {
  nodes: P2PNode[];
  edges: [string, string][]; // Peer connections as [nodeIdA, nodeIdB] pairs
  metrics: NetworkMetrics;
}
```

### `NetworkMetrics`

```typescript
interface NetworkMetrics {
  activeNodes: number;
  totalMessages: number;
  messagesPerSecond: number;
  lookupSuccessRate: number; // 0–100 percentage
  averageHops: number; // Average DHT hops per lookup
  gossipRounds: number; // Total completed gossip rounds
  filesInNetwork: number; // Distinct files stored across all nodes
}
```

### `NetworkEvent`

```typescript
interface NetworkEvent {
  id: string; // UUID
  type: NetworkEventType; // See event types below
  timestamp: number; // Unix ms
  message: string; // Human-readable description
  payload: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'success';
}

type NetworkEventType =
  | 'GOSSIP_ROUND'
  | 'FILE_PUBLISHED'
  | 'CHUNK_STORED'
  | 'LOOKUP_STARTED'
  | 'LOOKUP_HOP'
  | 'LOOKUP_SUCCESS'
  | 'LOOKUP_FAILED'
  | 'NODE_JOINED'
  | 'NODE_LEFT'
  | 'ATTACK_STARTED'
  | 'ATTACK_HIT';
```

---

## 8. API Reference

Base URL: `http://localhost:3001/api`

### Snapshot & Metrics

| Method | Path                | Description                                |
| ------ | ------------------- | ------------------------------------------ |
| `GET`  | `/snapshot`         | Full network state (nodes, edges, metrics) |
| `GET`  | `/metrics`          | Metrics only                               |
| `GET`  | `/events?limit=100` | Last N events                              |
| `GET`  | `/files`            | All files currently stored in the network  |

### Node Management

| Method   | Path         | Body                | Description                           |
| -------- | ------------ | ------------------- | ------------------------------------- |
| `POST`   | `/nodes`     | `{ count: number }` | Add N new nodes to the network        |
| `DELETE` | `/nodes/:id` | —                   | Kill a node by its full 64-bit hex ID |

### File Operations

| Method | Path            | Body                              | Description                                       |
| ------ | --------------- | --------------------------------- | ------------------------------------------------- |
| `POST` | `/files`        | `{ fileName, data, fromNodeId? }` | Publish a file. `data` must be **base64-encoded** |
| `POST` | `/files/lookup` | `{ fileId, fromNodeId? }`         | Lookup a file by its ID or name                   |

### Attacks

| Method | Path       | Body                                   | Description             |
| ------ | ---------- | -------------------------------------- | ----------------------- |
| `POST` | `/attacks` | `{ type, sybilCount?, targetNodeId? }` | Launch a network attack |

#### Attack types

| type      | Required extra fields | Description                                         |
| --------- | --------------------- | --------------------------------------------------- |
| `SYBIL`   | `sybilCount` (1–20)   | Inject N fake attacker nodes into the network       |
| `ECLIPSE` | `targetNodeId`        | Surround a target node with attackers, isolating it |

---

## 9. WebSocket Events

Socket.IO namespace: `/` (default)  
Connection URL: `http://localhost:3001`

### Server → Client

| Event name         | Payload type      | Frequency | Description                                 |
| ------------------ | ----------------- | --------- | ------------------------------------------- |
| `network:snapshot` | `NetworkSnapshot` | ~1/sec    | Full network state replacement              |
| `network:event`    | `NetworkEvent`    | Variable  | Discrete event (gossip, file, attack, etc.) |

### Currently emitted event types

| Type             | Payload fields                                    | Triggered by                            |
| ---------------- | ------------------------------------------------- | --------------------------------------- |
| `GOSSIP_ROUND`   | `nodeId, round`                                   | Each node completing a gossip tick      |
| `FILE_PUBLISHED` | `nodeId, fileName, fileId, chunkCount`            | Successful file publish                 |
| `CHUNK_STORED`   | `nodeId, fromNodeId, fileId, chunkId`             | Each chunk stored on a peer             |
| `LOOKUP_STARTED` | `nodeId, fileId`                                  | Client triggers a lookup                |
| `LOOKUP_HOP`     | `fromNodeId, toNodeId, fileId`                    | Each DHT routing hop                    |
| `LOOKUP_SUCCESS` | `nodeId, fileId`                                  | File found                              |
| `LOOKUP_FAILED`  | `nodeId, fileId`                                  | File not found after exhausting routing |
| `NODE_JOINED`    | `nodeId`                                          | New node added via API                  |
| `NODE_LEFT`      | `nodeId`                                          | Node killed via API                     |
| `ATTACK_STARTED` | `attackType, attackerIds[], targetNodeId?, count` | Attack launched                         |
| `ATTACK_HIT`     | `fromNodeId, targetId`                            | Attacker connects to victim             |

> ⚠️ **Note:** As of May 2026, only `GOSSIP_ROUND` is emitted by the backend.
> All other event types need to be added to `simulator.service.ts`. See Known Issues.

---

## 10. Frontend Pages & Components

### `/network` — Main Simulator Page

The single main view. Layout is a full-viewport dashboard with:

```
┌───────────────────────────── MetricsBar ─────────────────────────────┐
│ Connection · Active Nodes · Messages · Msg/s · Lookup% · Hops · ...  │
├──────────────────────────────────────────────────────────────────────┤
│                                              │                        │
│            NetworkMap3D                      │    ControlPanel        │
│         (3D interactive graph)               │   (REST controls)      │
│                                              │                        │
│  - Nodes as glowing icosahedra               │  - Add / Kill nodes    │
│  - Edges as bezier curves                    │  - Publish file        │
│  - Particles for live traffic                │  - Lookup file         │
│  - Click node → detail panel                 │  - Sybil / Eclipse     │
│                                              │                        │
├──────────────────────────────────────────────┤                        │
│              EventLog                        │                        │
│  (scrolling real-time event feed)            │                        │
└──────────────────────────────────────────────┴────────────────────────┘
```

### `NetworkMap3D`

The 3D scene built with React Three Fiber. Key sub-components:

| Component          | Purpose                                                       |
| ------------------ | ------------------------------------------------------------- |
| `Scene`            | Root R3F scene — lights, fog, stars, renders all children     |
| `NetworkNode`      | Single node mesh (icosahedron + glow + rings + HUD label)     |
| `ConnectionTube`   | Bezier edge between two peer nodes                            |
| `LiveHopParticles` | Imperative particle pool — renders event-driven hop particles |
| `EventWatcher`     | Zustand subscriber — calls `reactToEvent()` on new events     |
| `NodeDetailPanel`  | Overlay panel shown when a node is clicked                    |
| `Legend`           | Bottom-left colour guide                                      |

#### 3D Visual Language

| Visual                          | Meaning                                |
| ------------------------------- | -------------------------------------- |
| Indigo icosahedron              | Active node                            |
| Slate icosahedron               | Idle node (smaller, dimmer)            |
| Near-invisible mesh             | Churned (dead) node                    |
| Red icosahedron (spinning fast) | Attacker node                          |
| Amber icosahedron               | Victim node (Eclipse target)           |
| Purple particle                 | File transfer hop                      |
| Green particle                  | Gossip propagation                     |
| Yellow particle                 | DHT lookup hop                         |
| Red particle                    | Attack vector                          |
| Edge brightness                 | Scales with shared files between nodes |
| Node size                       | Scales with peer count                 |
| Glow flash                      | Triggered by real WebSocket events     |

### `ControlPanel`

REST-driven control surface. All actions call `apps/frontend/lib/api.ts` functions.

| Control        | API call                                          | Notes                              |
| -------------- | ------------------------------------------------- | ---------------------------------- |
| Add Node       | `POST /nodes { count: 1 }`                        | Spawns one new node                |
| Kill Random    | `DELETE /nodes/:id`                               | Kills a random active node         |
| Publish File   | `POST /files`                                     | Data is base64-encoded client-side |
| Lookup File    | `POST /files/lookup`                              | Resolves file via DHT routing      |
| Sybil Attack   | `POST /attacks { type: "SYBIL" }`                 | Injects fake nodes                 |
| Eclipse Attack | `POST /attacks { type: "ECLIPSE", targetNodeId }` | Isolates a target                  |

### `EventLog`

Scrollable feed of `NetworkEvent` objects from the Zustand store.  
Filterable by: ALL · NODE · FILE · GOSSIP.  
Shows: event type · timestamp · message · JSON payload (expandable).

### `MetricsBar`

8-card stat strip auto-updating from `snapshot.metrics`:

- Connection status · Active nodes · Total messages · Messages/sec
- Lookup success rate · Average hops · Gossip rounds · Files in network

---

## 11. Use Cases

### UC-1: Observe Gossip Propagation

**Actor:** Developer / researcher  
**Goal:** Watch how information spreads through the network over time  
**Steps:**

1. Open `/network` — observe nodes pulsing with green particles on gossip ticks
2. Watch the `gossipRound` counter in each node's HUD increment
3. Click a node → see its current gossip round vs peers
4. Observe that all nodes in the same cluster converge to the same round number within ~1–2 seconds

**Expected:** Green particles ripple outward from each node every ~1 second, reaching peers with
a visible staggered delay

---

### UC-2: Publish a File and Watch Distribution

**Actor:** Developer  
**Goal:** Publish a file and observe chunked DHT distribution  
**Steps:**

1. In ControlPanel → "Publish File" section
2. Enter filename: `document.txt`
3. Enter content: `Hello, P2P world!`
4. Click "↑ Publish to Network"
5. Watch purple particles fly from the publisher node to its peers
6. Check EventLog for `FILE_PUBLISHED` and `CHUNK_STORED` events
7. Click any node that received the file → see it appear under "Stored Files" in the HUD

**Expected:** Publisher node glows purple, particles travel to 3–5 peer nodes, those nodes'
file count badges increment, metrics bar "Files in Network" counter increases

---

### UC-3: Perform a DHT Lookup

**Actor:** Developer  
**Goal:** Resolve a previously published file through DHT routing  
**Pre-condition:** A file has been published (UC-2)  
**Steps:**

1. In ControlPanel → "File Lookup" section
2. Enter the filename or file ID from a previous publish
3. Click "⌕ Lookup in DHT"
4. Watch yellow particles trace the lookup path hop-by-hop
5. When found — the target node flashes bright green
6. When not found — the originating node flashes red
7. Check MetricsBar for updated "Avg Hops" and "Lookup Success" rate

**Expected:** Yellow particles travel across 1–4 hops converging on the node storing the
chunk, EventLog shows `LOOKUP_HOP` entries, final `LOOKUP_SUCCESS` or `LOOKUP_FAILED`

---

### UC-4: Add Nodes and Watch Self-Organisation

**Actor:** Developer  
**Goal:** Observe how new nodes integrate into the DHT  
**Steps:**

1. Click "Add Node" in ControlPanel
2. New node appears in the 3D map with a bright indigo flash
3. EventLog shows `NODE_JOINED`
4. Watch the node's k-buckets populate as it discovers peers
5. Within 2–3 gossip rounds it should have a full peer list

**Expected:** New node spawns at a random 3D position, flashes purple/indigo on arrival,
gradually accumulates peers shown by the ring animation becoming more active

---

### UC-5: Kill a Node and Observe Churn

**Actor:** Developer  
**Goal:** Simulate node churn — a node leaving the network  
**Steps:**

1. Click any active node in the 3D view
2. NodeDetailPanel opens on the right
3. Click "✕ Kill This Node"
4. Node transitions to `churned` status — mesh fades to near-invisible
5. Its peers detect the disconnection on the next gossip round
6. EventLog shows `NODE_LEFT`

**Expected:** Node visually fades out, edges to it disappear or dim significantly, peers
remove it from their k-buckets over the next few gossip rounds

---

### UC-6: Launch a Sybil Attack

**Actor:** Security researcher  
**Goal:** Flood the network with fake nodes to observe impact on DHT integrity  
**Steps:**

1. In ControlPanel → "⚠ Attack Simulation"
2. Set Sybil Count to 5
3. Click "Sybil Attack"
4. Watch 5 red nodes appear in the 3D map, spinning aggressively
5. Red particles shoot from attacker nodes to their peers
6. EventLog shows `ATTACK_STARTED` with `attackerIds[]`
7. Monitor MetricsBar — lookup success rate may degrade

**Expected:** 5 red icosahedra appear, each fires red attack particles at peers, honest nodes
begin routing through attacker nodes unknowingly, overall DHT coherence degrades

---

### UC-7: Launch an Eclipse Attack

**Actor:** Security researcher  
**Goal:** Isolate a specific node by surrounding it with attackers  
**Steps:**

1. In ControlPanel → "⚠ Attack Simulation"
2. In the Eclipse section, select a target node from the dropdown
3. Click "Eclipse Attack"
4. Watch the target node turn amber (victim status)
5. Attacker nodes appear as red and cluster around the victim
6. Red particles stream from attackers to the victim
7. The victim node's k-buckets fill with attacker IDs
8. The victim can no longer route lookups to honest nodes

**Expected:** Target turns amber, surrounded by red nodes, its peer list becomes dominated by
attackers, `ATTACK_HIT` events appear in EventLog for each connection established

---

### UC-8: Inspect a Node's Routing Table

**Actor:** Developer / student  
**Goal:** Understand how Kademlia k-buckets work by inspecting a real node  
**Steps:**

1. Click any node in the 3D view
2. NodeDetailPanel opens showing 8 k-bucket rows
3. Each row shows a hex range (00–1f, 20–3f, etc.) and a bar showing peer fill level
4. Buckets closer to the node's own ID prefix tend to have more peers
5. Compare two nodes — their routing tables have different distributions

**Expected:** K-bucket bar chart shows uneven fill levels consistent with Kademlia's
proximity-biased routing table construction

---

## 12. Node Lifecycle

```
          addNode API call
                │
                ▼
          ┌──────────┐
          │  active  │◄──── joins DHT, builds k-buckets, participates in gossip
          └──────────┘
               │  │
    inactivity │  │ killNode API call / crash simulation
               ▼  ▼
          ┌──────────┐
          │   idle   │  ← still connected, low message rate
          └──────────┘
               │
               │ further inactivity / explicit kill
               ▼
          ┌──────────┐
          │ churned  │  ← ghost node, peers deregister it over next gossip rounds
          └──────────┘
               │
               ▼
          (removed from snapshot after TTL)


Attack paths:
  addNode (attacker) ──► attacker  (Sybil injection)
  active             ──► victim    (Eclipse target selected)
```

---

## 13. File Distribution Flow

```
Client
  │
  │  POST /api/files { fileName, data: base64 }
  ▼
FilesController
  │
  │  SimulatorService.publishFile(fileName, data)
  ▼
  1. Decode base64 → raw content
  2. Split into chunks (currently: 1 chunk per file for simplicity)
  3. Generate chunkId = hash(content)
  4. Find k-closest nodes to chunkId using XOR distance
  5. Store chunkId on each of those nodes
  6. Emit FILE_PUBLISHED event
  7. For each storing node → emit CHUNK_STORED event
  │
  ▼
NetworkGateway broadcasts events to all WebSocket clients
  │
  ▼
Frontend: EventWatcher receives FILE_PUBLISHED
  → triggerGlow(publisherNode, purple)
  → pushHop(publisher → each peer, 'FILE') with 180ms stagger

Later: POST /api/files/lookup { fileId }
  │
  ▼
  1. Start at requesting node
  2. Find closest known node to fileId
  3. Ask that node → repeat (iterative routing)
  4. Emit LOOKUP_HOP for each step
  5. If found → emit LOOKUP_SUCCESS
  6. If exhausted → emit LOOKUP_FAILED
```

---

## 14. Attack Simulations

### Sybil Attack

A Sybil attack floods the network with fake identities controlled by one adversary.

**Simulation behaviour:**

- `sybilCount` new nodes are created with `status: 'attacker'`
- They are assigned random IDs spread across the keyspace to maximise DHT coverage
- They connect to honest nodes as peers, inserting themselves into routing tables
- Over subsequent gossip rounds, honest nodes begin routing through attackers
- Lookups may return false negatives (attacker claims file doesn't exist) or be silently dropped

**Visual:** Red icosahedra spinning at 3× speed, red particles shooting at peers

### Eclipse Attack

An Eclipse attack surrounds a single target node with attacker peers, cutting it off from the
honest network.

**Simulation behaviour:**

- `targetNodeId` node's status becomes `victim`
- A cluster of attacker nodes are created with IDs close to the target in XOR space
- They establish peer connections with the victim, filling its k-buckets
- The victim's outgoing lookups and gossip now only reach attacker-controlled nodes
- The victim is effectively isolated from the honest network

**Visual:** Target turns amber, surrounded by red nodes, `ATTACK_HIT` particles stream inward

---

## 15. Known Issues & Backlog

### Critical (All Fixed)

| #   | Issue                                                | Affected               | Status                                                         |
| --- | ---------------------------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| 1   | Backend only emits `GOSSIP_ROUND` events             | All features           | **Fixed:** Added emit calls for `CHUNK_STORED` and `ATTACK_HIT`. |
| 2   | `DELETE /nodes/:id` returns 500 for non-active nodes | Kill node from 3D view | **Fixed:** Added guard in `node.agent.ts` to prevent crashing during removal. |
| 3   | `LiveHopParticles` does not render properly          | NetworkMap3D           | **Fixed:** Completely rewrote the imperative particle pool for accurate 3D bolt rendering. |
| 4   | `EventLog` lags when thousands of events accumulate  | EventLog               | **Fixed:** Implemented virtual scrolling and increased history cap to 50,000. |

### Medium (All Fixed)

| #   | Issue                                                                       | Affected             | Status                                            |
| --- | --------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------- |
| 5   | `useNetworkStore(s => s.snapshot?.nodes ?? [])` — new array ref each render | NetworkMap3D         | **Fixed:** Using `useMemo` wrapping. |
| 6   | `<line>` JSX resolves to SVG `SVGLineElement`, not `THREE.Line`             | ConnectionTube       | **Fixed:** Rewritten to use `<primitive object={lineObject}>`. |
| 7   | CORS hardcoded to `localhost:4200`                                          | All browser requests | **Fixed:** Updated `enableCors` origins in `main.ts` to `3000`. |
| 8   | Initial bright flash before dark mode is applied                            | Entire App           | **Fixed:** Set `initialColorMode: 'dark'` in `theme.ts`. |

### Low / Enhancement

| #   | Issue                                                            | Enhancement                                                     |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| 6   | No persistence — all state is in-memory, lost on backend restart | Add optional Redis snapshot store                               |
| 7   | No real file chunking — every file is 1 chunk                    | Implement actual chunking with configurable chunk size          |
| 8   | Node positions are random at spawn — no spatial DHT layout       | Arrange nodes by XOR distance for topologically accurate layout |
| 9   | EventLog has no ATTACK filter tab                                | Add ATTACK filter alongside NODE / FILE / GOSSIP                |
| 10  | No time-travel / replay of events                                | Record event history and allow scrubbing                        |

---

## 16. Development Setup

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9 (or pnpm/yarn)
- NX CLI: `npm install -g nx`

### Install

```bash
git clone <repo>
cd p2p-simulator
npm install
```

### Run both apps

```bash
# Start backend (port 3001)
npx nx serve backend

# Start frontend (port 3000) — in a new terminal
npx nx serve frontend
```

### Run individually

```bash
# Backend only
cd apps/backend && npm run start:dev

# Frontend only
cd apps/frontend && npm run dev
```

### Build for production

```bash
npx nx build backend
npx nx build frontend
```

---

## 17. Environment Variables

### `apps/frontend/.env.local`

```env
# Backend REST API base URL (no trailing slash)
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001

# Socket.IO connection URL
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

### `apps/backend` (optional `.env`)

```env
# Port the NestJS server listens on
PORT=3001

# Simulation tick interval in ms (default: 1000)
TICK_INTERVAL_MS=1000

# Initial number of nodes to spawn
INITIAL_NODE_COUNT=15

# CORS allowed origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

## 18. Glossary

| Term                  | Definition                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **DHT**               | Distributed Hash Table — a decentralised key-value store where responsibility for keys is distributed across nodes |
| **Kademlia**          | A specific DHT algorithm using XOR metric for distance, O(log n) lookup                                            |
| **XOR distance**      | Distance between two node IDs = bitwise XOR of their 64-bit IDs                                                    |
| **k-bucket**          | A slot in a Kademlia routing table holding up to k peers in a specific XOR distance range                          |
| **Gossip protocol**   | Epidemic information propagation — each node tells a subset of peers what it knows                                 |
| **Churn**             | Nodes joining and leaving the network over time                                                                    |
| **Sybil attack**      | An attacker creates many fake identities (Sybil nodes) to gain disproportionate influence                          |
| **Eclipse attack**    | An attacker surrounds a victim node with malicious peers, cutting it off from honest nodes                         |
| **Chunk**             | A fixed-size fragment of a file, content-addressed by its hash                                                     |
| **Content-addressed** | A storage scheme where the address of data is derived from its content (e.g. SHA hash)                             |
| **Snapshot**          | A point-in-time copy of the full network state broadcast over WebSocket every ~1 second                            |
| **Gossip round**      | One iteration of the gossip tick for a given node                                                                  |
| **R3F**               | React Three Fiber — a React renderer for Three.js (WebGL)                                                          |
| **NX**                | A smart build system and monorepo tool                                                                             |
| **Zustand**           | A lightweight React state management library using hooks                                                           |
| **Socket.IO**         | A WebSocket library with auto-reconnect, rooms, and event namespacing                                              |

---

_Generated May 2026 — Filipe Guedes_
