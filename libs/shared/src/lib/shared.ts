

export type NodeStatus = 'active' | 'idle' | 'churned' | 'attacker' | 'victim';

export interface KBucket {
  rangeStart: string;
  rangeEnd: string;
  peers: string[];
}

export interface P2PNode {
  id: string;
  shortId: string;
  status: NodeStatus;
  position: [number, number, number];
  peers: string[];
  kBuckets: KBucket[];
  files: string[];
  messageCount: number;
  gossipRound: number;
  uptimeMs: number;
  joinedAt: number;
}

export type MessageType =
  | 'GOSSIP'
  | 'FIND_NODE'
  | 'FIND_VALUE'
  | 'STORE'
  | 'PING'
  | 'PONG'
  | 'ATTACK';

export interface P2PMessage {
  id: string;
  type: MessageType;
  fromId: string;
  toId: string;
  payload?: unknown;
  timestamp: number;
}

export interface FileChunk {
  chunkId: string;
  fileId: string;
  fileName: string;
  index: number;
  total: number;
  data: string;
  responsibleNodeId: string;
}

export interface FileManifest {
  fileId: string;
  fileName: string;
  totalChunks: number;
  chunkIds: string[];
  publishedBy: string;
  publishedAt: number;
}

export type NetworkEventType =
  | 'NODE_JOINED'
  | 'NODE_LEFT'
  | 'GOSSIP_ROUND'
  | 'LOOKUP_STARTED'
  | 'LOOKUP_HOP'
  | 'LOOKUP_SUCCESS'
  | 'LOOKUP_FAILED'
  | 'FILE_PUBLISHED'
  | 'FILE_RETRIEVED'
  | 'CHUNK_STORED'
  | 'ATTACK_STARTED'
  | 'ATTACK_HIT';

export type EventSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface NetworkEvent {
  id: string;
  type: NetworkEventType;
  timestamp: number;
  message: string;
  payload: unknown;
  severity: EventSeverity;
}

export interface NetworkSnapshot {
  nodes: P2PNode[];
  edges: [string, string][];
  metrics: NetworkMetrics;
  timestamp: number;
}

export interface NetworkMetrics {
  activeNodes: number;
  totalMessages: number;
  messagesPerSecond: number;
  lookupSuccessRate: number;
  averageHops: number;
  churnRate: number;
  gossipRounds: number;
  filesInNetwork: number;
}

export type AttackType = 'SYBIL' | 'ECLIPSE';

export interface AttackConfig {
  type: AttackType;
  targetNodeId?: string;
  sybilCount?: number;
  targetFileId?: string;
}

export interface AddNodePayload {
  count?: number;
}

export interface PublishFilePayload {
  fileName: string;
  data: string;
  fromNodeId?: string;
}

export interface LookupPayload {
  fileId: string;
  fromNodeId?: string;
}

export interface SendMessagePayload {
  fromNodeId: string;
  toNodeId: string;
  type: MessageType;
  payload?: unknown;
}

export interface KillNodePayload {
  nodeId: string;
}

export const WS_EVENTS = {
  NETWORK_SNAPSHOT: 'network:snapshot',
  NETWORK_EVENT: 'network:event',
  NODE_UPDATE: 'node:update',
  METRICS_UPDATE: 'metrics:update',
  MESSAGE_FLOW: 'message:flow',
} as const;
