import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  NetworkSnapshot,
  NetworkEvent,
  P2PNode,
  WS_EVENTS,
} from '@p2p-simulator/shared';
import { getSocket } from '../lib/socket';

interface NetworkStore {
  snapshot: NetworkSnapshot | null;
  events: NetworkEvent[];
  selectedNode: P2PNode | null;
  isConnected: boolean;
  setSnapshot: (s: NetworkSnapshot) => void;
  addEvent: (e: NetworkEvent) => void;
  setSelectedNode: (n: P2PNode | null) => void;
  setConnected: (v: boolean) => void;
  initSocket: () => void;
}

let _socketInitialized = false;


let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSnapshot: NetworkSnapshot | null = null;


let eventQueue: NetworkEvent[] = [];
let eventTimer: ReturnType<typeof setTimeout> | null = null;

export const useNetworkStore = create<NetworkStore>()(
  subscribeWithSelector((set) => ({
    snapshot: null,
    events: [],
    selectedNode: null,
    isConnected: false,

    setSnapshot: (snapshot) => set({ snapshot }),
    addEvent: (event) =>
      set((s) => ({ events: [event, ...s.events].slice(0, 50000) })),
    setSelectedNode: (selectedNode) => set({ selectedNode }),
    setConnected: (isConnected) => set({ isConnected }),

    initSocket: () => {
      
      if (_socketInitialized) return;
      _socketInitialized = true;

      const socket = getSocket();

      socket.on('connect', () => set({ isConnected: true }));
      socket.on('disconnect', () => set({ isConnected: false }));
      socket.on('connect_error', () => set({ isConnected: false }));

      
      socket.on(WS_EVENTS.NETWORK_SNAPSHOT, (data: NetworkSnapshot) => {
        pendingSnapshot = data;
        if (!snapshotTimer) {
          snapshotTimer = setTimeout(() => {
            if (pendingSnapshot) set({ snapshot: pendingSnapshot });
            pendingSnapshot = null;
            snapshotTimer = null;
          }, 200);
        }
      });

      
      socket.on(WS_EVENTS.NETWORK_EVENT, (event: NetworkEvent) => {
        eventQueue.push(event);
        if (!eventTimer) {
          eventTimer = setTimeout(() => {
            const batch = eventQueue.splice(0);
            eventTimer = null;
            if (batch.length === 0) return;
            set((state) => {
              const merged = [...batch, ...state.events];
              const seen = new Set<string>();
              return {
                events: merged
                  .filter((e) => {
                    if (seen.has(e.id)) return false;
                    seen.add(e.id);
                    return true;
                  })
                  .slice(0, 50000),
              };
            });
          }, 50);
        }
      });
    },
  })),
);
