import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  P2PNode,
  NetworkSnapshot,
  NetworkMetrics,
  NetworkEvent,
  AttackConfig,
  FileManifest,
  P2PMessage,
} from '@p2p-simulator/shared';
import { NodeAgent } from './node.agent';
import { NetworkBus } from './network-bus';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class P2PService implements OnModuleInit, OnModuleDestroy {
  private nodes = new Map<string, NodeAgent>();
  private bus = new NetworkBus();
  private files = new Map<string, FileManifest>();
  private events: NetworkEvent[] = [];

  private totalMessages = 0;
  private totalLookups = 0;
  private successfulLookups = 0;
  private totalHops = 0;
  private gossipRounds = 0;
  private snapshotInterval!: NodeJS.Timeout;
  private messageFlowBuffer: P2PMessage[] = [];
  
  private messagesThisTick = 0;
  private lastMessagesPerSecond = 0;

  constructor(private readonly eventEmitter: EventEmitter2) {}

  onModuleInit() {
    const initialCount = parseInt(process.env.INITIAL_NODE_COUNT || '12');
    for (let i = 0; i < initialCount; i++) this.spawnNode();

    this.bus.onMessage((msg) => {
      this.totalMessages++;
      this.messagesThisTick++;
      this.messageFlowBuffer.push(msg);
      const target = this.nodes.get(msg.toId);
      if (target) target.receiveMessage(msg);
    });

    this.snapshotInterval = setInterval(() => {
      this.lastMessagesPerSecond = this.messagesThisTick;
      this.messagesThisTick = 0;
      this.eventEmitter.emit('network.snapshot', this.getSnapshot());
      this.messageFlowBuffer = [];
    }, 1000);
  }

  onModuleDestroy() {
    clearInterval(this.snapshotInterval);
    this.nodes.forEach((n) => n.stop());
  }

  public spawnNode(isAttacker = false): NodeAgent {
    const id = uuidv4().replace(/-/g, '').substring(0, 16);
    const position: [number, number, number] = [
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 100,
    ];

    const agent = new NodeAgent(
      id,
      position,
      (msg) => this.bus.send(msg),
      () => Array.from(this.nodes.keys()),
      parseInt(process.env.GOSSIP_INTERVAL_MS || '2000'),
      parseInt(process.env.GOSSIP_FANOUT || '3'),
    );

    if (isAttacker) agent.status = 'attacker';

    const existing = Array.from(this.nodes.keys())
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    existing.forEach((peerId) => agent.addPeer(peerId));

    agent.on('gossip', ({ round }) => {
      this.gossipRounds++;
      this.emitEvent({
        id: uuidv4(),
        type: 'GOSSIP_ROUND',
        timestamp: Date.now(),
        message: `Node ${agent.id.substring(0, 6)} completed gossip round #${round}`,
        payload: { nodeId: agent.id, round },
        severity: 'info',
      });
    });

    this.nodes.set(id, agent);
    agent.start();

    this.emitEvent({
      id: uuidv4(),
      type: 'NODE_JOINED',
      timestamp: Date.now(),
      message: `Node ${id.substring(0, 6)} joined the network`,
      payload: { nodeId: id, isAttacker },
      severity: isAttacker ? 'danger' : 'success',
    });

    return agent;
  }

  public killNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    node.stop();
    
    this.nodes.forEach((n) => n.removePeer(nodeId));
    this.nodes.delete(nodeId);

    this.emitEvent({
      id: uuidv4(),
      type: 'NODE_LEFT',
      timestamp: Date.now(),
      message: `Node ${nodeId.substring(0, 6)} left the network (churn)`,
      payload: { nodeId },
      severity: 'warning',
    });
  }

  public publishFile(
    fileName: string,
    data: string,
    fromNodeId?: string,
  ): FileManifest {
    const fileId = uuidv4().replace(/-/g, '').substring(0, 16);
    const nodeIds = Array.from(this.nodes.keys());
    const origin =
      fromNodeId || nodeIds[Math.floor(Math.random() * nodeIds.length)];
    const replicationFactor = parseInt(process.env.REPLICATION_FACTOR || '3');

    const originNode = this.nodes.get(origin);
    const responsible = originNode
      ? originNode.closestPeers(fileId, replicationFactor)
      : nodeIds.slice(0, replicationFactor);

    responsible.forEach((nodeId) => {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.files.push(fileId);
        this.bus.send({
          id: uuidv4(),
          type: 'STORE',
          fromId: origin,
          toId: nodeId,
          payload: { fileId, fileName },
          timestamp: Date.now(),
        });
        
        this.emitEvent({
          id: uuidv4(),
          type: 'CHUNK_STORED',
          timestamp: Date.now(),
          message: `Chunk of "${fileName}" stored on node ${nodeId.substring(0, 6)}`,
          payload: { nodeId, fromNodeId: origin, fileId, chunkId: fileId },
          severity: 'info',
        });
      }
    });

    const manifest: FileManifest = {
      fileId,
      fileName,
      totalChunks: 1,
      chunkIds: [fileId],
      publishedBy: origin,
      publishedAt: Date.now(),
    };

    this.files.set(fileId, manifest);

    this.emitEvent({
      id: uuidv4(),
      type: 'FILE_PUBLISHED',
      timestamp: Date.now(),
      message: `File "${fileName}" published to network (id: ${fileId.substring(0, 8)})`,
      payload: { fileId, fileName, storedOn: responsible },
      severity: 'success',
    });

    return manifest;
  }

  public lookupFile(fileId: string, fromNodeId?: string): boolean {
    const nodeIds = Array.from(this.nodes.keys());
    const startId =
      fromNodeId || nodeIds[Math.floor(Math.random() * nodeIds.length)];
    let hops = 0;
    let current = this.nodes.get(startId);
    const visited = new Set<string>();

    this.totalLookups++;

    this.emitEvent({
      id: uuidv4(),
      type: 'LOOKUP_STARTED',
      timestamp: Date.now(),
      message: `Lookup for file ${fileId.substring(0, 8)} started from node ${startId.substring(0, 6)}`,
      payload: { fileId, fromNodeId: startId },
      severity: 'info',
    });

    while (current && hops < 20) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      hops++;

      if (current.files.includes(fileId)) {
        this.successfulLookups++;
        this.totalHops += hops;

        this.emitEvent({
          id: uuidv4(),
          type: 'LOOKUP_SUCCESS',
          timestamp: Date.now(),
          message: `File ${fileId.substring(0, 8)} found at node ${current.id.substring(0, 6)} in ${hops} hops`,
          payload: { fileId, foundAt: current.id, hops },
          severity: 'success',
        });
        return true;
      }

      const next = current.closestPeers(fileId, 1)[0];

      this.emitEvent({
        id: uuidv4(),
        type: 'LOOKUP_HOP',
        timestamp: Date.now(),
        message: `Lookup hop ${hops}: visiting node ${current.id.substring(0, 6)}`,
        payload: {
          fileId,
          fromNodeId: current.id,
          toNodeId: next ?? current.id,
          hop: hops,
        },
        severity: 'info',
      });

      current = next ? this.nodes.get(next) : undefined;
    }

    this.emitEvent({
      id: uuidv4(),
      type: 'LOOKUP_FAILED',
      timestamp: Date.now(),
      message: `Lookup for file ${fileId.substring(0, 8)} failed after ${hops} hops`,
      payload: { fileId, hops },
      severity: 'danger',
    });

    return false;
  }

  public launchAttack(config: AttackConfig): void {
    this.emitEvent({
      id: uuidv4(),
      type: 'ATTACK_STARTED',
      timestamp: Date.now(),
      message: `${config.type} attack launched`,
      payload: config,
      severity: 'danger',
    });

    if (config.type === 'SYBIL') {
      const count = config.sybilCount || 5;
      const attackerIds: string[] = [];
      for (let i = 0; i < count; i++) {
        const attacker = this.spawnNode(true);
        attackerIds.push(attacker.id);
        
        attacker.peers.forEach((peerId) => {
          this.emitEvent({
            id: uuidv4(),
            type: 'ATTACK_HIT',
            timestamp: Date.now(),
            message: `Sybil node ${attacker.id.substring(0, 6)} connected to peer ${peerId.substring(0, 6)}`,
            payload: { fromNodeId: attacker.id, targetId: peerId },
            severity: 'danger',
          });
        });
      }
    }

    if (config.type === 'ECLIPSE' && config.targetNodeId) {
      const target = this.nodes.get(config.targetNodeId);
      if (!target) return;

      for (let i = 0; i < 6; i++) {
        const attacker = this.spawnNode(true);
        target.addPeer(attacker.id);
        attacker.addPeer(target.id);
        target.status = 'victim';

        this.emitEvent({
          id: uuidv4(),
          type: 'ATTACK_HIT',
          timestamp: Date.now(),
          message: `Eclipse attacker ${attacker.id.substring(0, 6)} connected to victim ${target.id.substring(0, 6)}`,
          payload: { fromNodeId: attacker.id, targetId: target.id },
          severity: 'danger',
        });
      }
    }
  }

  public getSnapshot(): NetworkSnapshot {
    const nodes = Array.from(this.nodes.values()).map((n) => n.toSnapshot());
    const edges: [string, string][] = [];

    this.nodes.forEach((node) => {
      node.peers.forEach((peerId) => {
        if (this.nodes.has(peerId)) {
          edges.push([node.id, peerId]);
        }
      });
    });

    return {
      nodes,
      edges,
      metrics: this.getMetrics(),
      timestamp: Date.now(),
    };
  }

  public getMetrics(): NetworkMetrics {
    const allNodes = Array.from(this.nodes.values());
    const activeNodes = allNodes.filter((n) => n.status !== 'churned').length;
    const churnedNodes = allNodes.filter((n) => n.status === 'churned').length;

    return {
      activeNodes,
      totalMessages: this.totalMessages,
      messagesPerSecond: this.lastMessagesPerSecond,
      lookupSuccessRate:
        this.totalLookups === 0
          ? 100
          : Math.round((this.successfulLookups / this.totalLookups) * 100),
      averageHops:
        this.totalLookups === 0
          ? 0
          : Math.round(this.totalHops / Math.max(1, this.successfulLookups)),
      churnRate:
        allNodes.length === 0
          ? 0
          : Math.round((churnedNodes / allNodes.length) * 100),
      gossipRounds: this.gossipRounds,
      filesInNetwork: this.files.size,
    };
  }

  public getEvents(limit = 100): NetworkEvent[] {
    
    return this.events.slice(-limit).reverse();
  }

  public getAllFiles(): FileManifest[] {
    return Array.from(this.files.values());
  }

  public getMessageFlow(): P2PMessage[] {
    return this.messageFlowBuffer;
  }

  private emitEvent(event: NetworkEvent): void {
    this.events.push(event);
    if (this.events.length > 1000) this.events.shift();
    this.eventEmitter.emit('network.event', event);
  }
}
