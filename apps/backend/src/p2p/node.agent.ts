import { EventEmitter } from 'events';
import {
  P2PNode,
  NodeStatus,
  KBucket,
  P2PMessage,
  MessageType,
} from '@p2p-simulator/shared';

export class NodeAgent extends EventEmitter {
  public id: string;
  public status: NodeStatus = 'active';
  public peers: string[] = [];
  public files: string[] = [];
  public messageCount = 0;
  public gossipRound = 0;
  public joinedAt: number;
  public position: [number, number, number];
  public kBuckets: KBucket[] = [];

  private gossipInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(
    id: string,
    position: [number, number, number],
    private readonly sendMessage: (msg: P2PMessage) => void,
    private readonly getAllNodeIds: () => string[],
    private readonly gossipIntervalMs: number = 2000,
    private readonly fanout: number = 3,
  ) {
    super();
    this.id = id;
    this.position = position;
    this.joinedAt = Date.now();
    this.initKBuckets();
  }

  

  private initKBuckets(): void {
    for (let i = 0; i < 8; i++) {
      this.kBuckets.push({
        rangeStart: (i * 32).toString(16).padStart(2, '0'),
        rangeEnd: ((i + 1) * 32 - 1).toString(16).padStart(2, '0'),
        peers: [],
      });
    }
  }

  

  public xorDistance(a: string, b: string): number {
    const aVal = parseInt(a.substring(0, 8), 16);
    const bVal = parseInt(b.substring(0, 8), 16);
    return aVal ^ bVal;
  }

  public closestPeers(targetId: string, k = 3): string[] {
    return [...this.peers]
      .sort(
        (a, b) => this.xorDistance(a, targetId) - this.xorDistance(b, targetId),
      )
      .slice(0, k);
  }

  

  public addPeer(peerId: string): void {
    if (peerId === this.id || this.peers.includes(peerId)) return;
    this.peers.push(peerId);

    const dist = this.xorDistance(this.id, peerId);
    
    const bucketIndex = Math.min(Math.max(Math.floor((dist % 256) / 32), 0), 7);
    const bucket = this.kBuckets[bucketIndex];
    if (bucket && !bucket.peers.includes(peerId)) {
      bucket.peers.push(peerId);
      if (bucket.peers.length > 4) bucket.peers.shift();
    }

    
    if (this.status === 'idle') this.status = 'active';
  }

  public removePeer(peerId: string): void {
    this.peers = this.peers.filter((p) => p !== peerId);
    this.kBuckets.forEach((bucket) => {
      bucket.peers = bucket.peers.filter((p) => p !== peerId);
    });
  }

  

  public start(): void {
    this.gossipInterval = setInterval(
      () => this.runGossip(),
      this.gossipIntervalMs,
    );
    this.pingInterval = setInterval(
      () => this.runPing(),
      this.gossipIntervalMs * 3,
    );
  }

  public stop(): void {
    if (this.gossipInterval) clearInterval(this.gossipInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.status = 'churned';
  }

  private runGossip(): void {
    if (this.status === 'churned') return;
    this.gossipRound++;

    const allNodes = this.getAllNodeIds().filter((n) => n !== this.id);
    if (allNodes.length === 0) return;

    
    if (
      this.status === 'active' &&
      this.gossipRound > 5 &&
      this.peers.length < 2
    ) {
      this.status = 'idle';
    }

    
    if (this.peers.length < this.fanout) {
      const unknown = allNodes.filter((n) => !this.peers.includes(n));
      const toAdd = unknown
        .sort(() => Math.random() - 0.5)
        .slice(0, this.fanout);
      toAdd.forEach((p) => this.addPeer(p));
    }

    
    const targets = [...this.peers]
      .sort(() => Math.random() - 0.5)
      .slice(0, this.fanout);

    targets.forEach((targetId) => {
      const msg: P2PMessage = {
        id: `${this.id}-gossip-${Date.now()}`,
        type: 'GOSSIP',
        fromId: this.id,
        toId: targetId,
        payload: { peers: this.peers.slice(0, 10) },
        timestamp: Date.now(),
      };
      this.messageCount++;
      this.sendMessage(msg);
    });

    this.emit('gossip', { nodeId: this.id, round: this.gossipRound, targets });
  }

  private runPing(): void {
    if (this.status === 'churned' || this.peers.length === 0) return;
    const target = this.peers[Math.floor(Math.random() * this.peers.length)];
    const msg: P2PMessage = {
      id: `${this.id}-ping-${Date.now()}`,
      type: 'PING',
      fromId: this.id,
      toId: target,
      timestamp: Date.now(),
    };
    this.messageCount++;
    this.sendMessage(msg);
  }

  

  public receiveMessage(msg: P2PMessage): void {
    if (this.status === 'churned') return;
    this.messageCount++;

    switch (msg.type) {
      case 'GOSSIP': {
        const { peers } = msg.payload as { peers: string[] };
        this.addPeer(msg.fromId);
        peers?.forEach((p) => this.addPeer(p));
        this.emit('received', msg);
        break;
      }
      case 'PING': {
        const pong: P2PMessage = {
          id: `${this.id}-pong-${Date.now()}`,
          type: 'PONG',
          fromId: this.id,
          toId: msg.fromId,
          timestamp: Date.now(),
        };
        this.addPeer(msg.fromId);
        this.sendMessage(pong);
        this.emit('received', msg);
        break;
      }
      case 'FIND_NODE': {
        const { targetId } = msg.payload as { targetId: string };
        const closest = this.closestPeers(targetId);
        this.emit('find_node', { from: msg.fromId, targetId, closest });
        this.emit('received', msg);
        break;
      }
      case 'STORE': {
        const { fileId } = msg.payload as { fileId: string };
        if (!this.files.includes(fileId)) this.files.push(fileId);
        this.emit('stored', { fileId });
        this.emit('received', msg);
        break;
      }
      default:
        this.emit('received', msg);
    }
  }

  

  public toSnapshot(): P2PNode {
    return {
      id: this.id,
      shortId: this.id.substring(0, 6),
      status: this.status,
      position: this.position,
      peers: this.peers,
      kBuckets: this.kBuckets,
      files: this.files,
      messageCount: this.messageCount,
      gossipRound: this.gossipRound,
      uptimeMs: Date.now() - this.joinedAt,
      joinedAt: this.joinedAt,
    };
  }
}
