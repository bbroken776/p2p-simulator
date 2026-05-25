'use client';
import {
  useRef,
  useState,
  useMemo,
  useEffect,
  useCallback,
  memo,
  Suspense,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useNetworkStore } from '../../store/network.store';
import { P2PNode, NetworkEvent } from '@p2p-simulator/shared';
import { api } from '../../lib/api';

const NODE_CONFIG: Record<
  string,
  { color: string; emissive: string; glow: string }
> = {
  active: { color: '#818cf8', emissive: '#6366f1', glow: '#a5b4fc' },
  idle: { color: '#334155', emissive: '#1e293b', glow: '#475569' },
  churned: { color: '#1e293b', emissive: '#0f172a', glow: '#1e293b' },
  attacker: { color: '#f43f5e', emissive: '#e11d48', glow: '#fb7185' },
  victim: { color: '#f59e0b', emissive: '#d97706', glow: '#fcd34d' },
};

const PARTICLE_CONFIG = {
  GOSSIP: { color: '#34d399', speed: 0.6, size: 0.45 },
  FILE: { color: '#a78bfa', speed: 0.32, size: 0.65 },
  LOOKUP: { color: '#fbbf24', speed: 0.8, size: 0.4 },
  ATTACK: { color: '#f43f5e', speed: 1.1, size: 0.55 },
  DEFAULT: { color: '#334155', speed: 0.25, size: 0.3 },
};

const GLOW_DURATION = 2000;

const _sv = new THREE.Vector3();
const _col = new THREE.Color();
const _col2 = new THREE.Color();

interface GlowEntry {
  color: string;
  expiresAt: number;
  intensity: number;
}
const activeGlows = new Map<string, GlowEntry>();
function triggerGlow(id: string, color: string, intensity = 1) {
  activeGlows.set(id, {
    color,
    expiresAt: Date.now() + GLOW_DURATION,
    intensity,
  });
}

interface HopParticle {
  id: string;
  fromId: string;
  toId: string;
  type: keyof typeof PARTICLE_CONFIG;
  born: number;
  ttl: number;
}
const hopQueue: HopParticle[] = [];
let hopCounter = 0;

function pushHop(
  fromId: string,
  toId: string,
  type: keyof typeof PARTICLE_CONFIG,
  ttl = 700,
) {
  hopQueue.push({
    id: `h${hopCounter++}`,
    fromId,
    toId,
    type,
    born: Date.now(),
    ttl,
  });

  if (hopQueue.length > 80) hopQueue.splice(0, hopQueue.length - 80);
}

function reactToEvent(event: NetworkEvent, nodes: P2PNode[]) {
  const p = (event.payload ?? {}) as Record<string, any>;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  switch (event.type) {
    case 'GOSSIP_ROUND': {
      const node = nodeMap.get(p.nodeId);
      if (!node) break;
      triggerGlow(p.nodeId, '#34d399', 0.8);

      node.peers.slice(0, 3).forEach((peerId, i) => {
        setTimeout(() => {
          pushHop(p.nodeId, peerId, 'GOSSIP');
          triggerGlow(peerId, '#34d399', 0.4);
        }, i * 100);
      });
      break;
    }

    case 'FILE_PUBLISHED': {
      triggerGlow(p.nodeId, '#a78bfa', 1.5);
      const node = nodeMap.get(p.nodeId);
      node?.peers.slice(0, 5).forEach((peerId, i) => {
        setTimeout(() => pushHop(p.nodeId, peerId, 'FILE'), i * 180);
      });
      break;
    }

    case 'CHUNK_STORED': {
      if (p.fromNodeId && p.nodeId) pushHop(p.fromNodeId, p.nodeId, 'FILE');
      triggerGlow(p.nodeId, '#a78bfa', 1.0);
      break;
    }

    case 'LOOKUP_STARTED': {
      triggerGlow(p.nodeId, '#fbbf24', 1.2);
      break;
    }

    case 'LOOKUP_HOP': {
      if (p.fromNodeId && p.toNodeId) {
        pushHop(p.fromNodeId, p.toNodeId, 'LOOKUP');
        triggerGlow(p.fromNodeId, '#fbbf24', 0.7);
        triggerGlow(p.toNodeId, '#fbbf24', 1.0);
      }
      break;
    }

    case 'LOOKUP_SUCCESS': {
      triggerGlow(p.nodeId, '#34d399', 2.5);
      break;
    }

    case 'LOOKUP_FAILED': {
      triggerGlow(p.nodeId, '#ef4444', 2.0);
      break;
    }

    case 'NODE_JOINED': {
      triggerGlow(p.nodeId, '#818cf8', 2.5);
      break;
    }

    case 'NODE_LEFT': {
      triggerGlow(p.nodeId, '#475569', 1.5);
      break;
    }

    case 'ATTACK_STARTED': {
      const ids: string[] = p.attackerIds ?? [];
      ids.forEach((id, i) => {
        setTimeout(() => {
          triggerGlow(id, '#f43f5e', 2.0);
          const attacker = nodeMap.get(id);
          attacker?.peers.slice(0, 3).forEach((peerId, j) => {
            setTimeout(() => pushHop(id, peerId, 'ATTACK'), j * 60);
          });
        }, i * 120);
      });
      if (p.targetNodeId) triggerGlow(p.targetNodeId, '#f59e0b', 2.0);
      break;
    }

    case 'ATTACK_HIT': {
      if (p.fromNodeId && p.targetId) {
        pushHop(p.fromNodeId, p.targetId, 'ATTACK');
        triggerGlow(p.fromNodeId, '#f43f5e', 1.5);
        triggerGlow(p.targetId, '#f59e0b', 2.5);
      }
      break;
    }
  }
}

function EventWatcher() {
  const lastSeenId = useRef('');

  useEffect(() => {
    return useNetworkStore.subscribe(
      (s) => s.events,
      (events) => {
        if (!events.length) return;
        const latest = events[0];
        if (!latest || latest.id === lastSeenId.current) return;
        lastSeenId.current = latest.id;
        const { snapshot } = useNetworkStore.getState();
        reactToEvent(latest, snapshot?.nodes ?? []);
      },
    );
  }, []);

  return null;
}

const ConnectionTube = memo(function ConnectionTube({
  start,
  end,
  color,
  weight,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  weight: number;
}) {
  const lineObject = useMemo(() => {
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    const perp = new THREE.Vector3(-(end.z - start.z), 0, end.x - start.x)
      .normalize()
      .multiplyScalar(4 + weight * 6);
    mid.add(perp);
    const pts = new THREE.QuadraticBezierCurve3(start, mid, end).getPoints(20);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12 + weight * 0.28,
    });
    return new THREE.Line(geo, mat);
  }, [start.x, start.y, start.z, end.x, end.y, end.z, color, weight]);

  useFrame(({ clock }) => {
    const mat = lineObject.material as THREE.LineBasicMaterial;

    mat.opacity =
      (0.12 + weight * 0.28) *
      (0.8 + Math.sin(clock.elapsedTime * 1.2 + weight * 10) * 0.2);
  });

  return <primitive object={lineObject} />;
});

const STREAK_POINTS = 10;
const POOL_SIZE = 80;

function LiveHopParticles({ posMap }: { posMap: Map<string, THREE.Vector3> }) {
  const groupRef = useRef<THREE.Group>(null);

  const pool = useMemo(() => {
    return Array.from({ length: POOL_SIZE }, () => {
      const buf = new Float32Array(STREAK_POINTS * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(buf, 3));
      const mat = new THREE.LineBasicMaterial({
        transparent: true,
        opacity: 0,
        linewidth: 2,
      });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      return { line, mat };
    });
  }, []);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    pool.forEach(({ line }) => group.add(line));
    return () => pool.forEach(({ line }) => group.remove(line));
  }, [pool]);

  const hopToSlot = useRef(new Map<string, number>());
  const freeSlots = useRef<number[]>(
    Array.from({ length: POOL_SIZE }, (_, i) => POOL_SIZE - 1 - i),
  );

  useFrame(({ clock }) => {
    const now = Date.now();
    const t = clock.elapsedTime;

    for (let i = hopQueue.length - 1; i >= 0; i--) {
      const hop = hopQueue[i];
      if (now - hop.born > hop.ttl) {
        hopQueue.splice(i, 1);
        const slot = hopToSlot.current.get(hop.id);
        if (slot !== undefined) {
          pool[slot].line.visible = false;
          pool[slot].mat.opacity = 0;
          freeSlots.current.push(slot);
          hopToSlot.current.delete(hop.id);
        }
      }
    }

    for (let i = 0; i < hopQueue.length; i++) {
      const hop = hopQueue[i];
      if (!hopToSlot.current.has(hop.id) && freeSlots.current.length > 0) {
        hopToSlot.current.set(hop.id, freeSlots.current.pop()!);
      }
    }

    for (let i = 0; i < hopQueue.length; i++) {
      const hop = hopQueue[i];
      const slot = hopToSlot.current.get(hop.id);
      if (slot === undefined) continue;

      const baseA = posMap.get(hop.fromId);
      const baseB = posMap.get(hop.toId);
      const { line, mat } = pool[slot];

      if (!baseA || !baseB) {
        line.visible = false;
        continue;
      }

      const floatA = Math.sin(t * 0.7 + baseA.x * 0.5) * 1.4;
      const floatB = Math.sin(t * 0.7 + baseB.x * 0.5) * 1.4;

      const ax = baseA.x,
        ay = baseA.y + floatA,
        az = baseA.z;
      const bx = baseB.x,
        by = baseB.y + floatB,
        bz = baseB.z;

      const progress = Math.min((now - hop.born) / hop.ttl, 1);
      const cfg = PARTICLE_CONFIG[hop.type];

      const BOLT_LEN = 0.18;
      const headT = progress;
      const tailT = Math.max(0, progress - BOLT_LEN);

      const attr = line.geometry.attributes.position as THREE.BufferAttribute;
      const dx = bx - ax,
        dy = by - ay,
        dz = bz - az;

      for (let p = 0; p < STREAK_POINTS; p++) {
        const frac = p / (STREAK_POINTS - 1);
        const tPt = tailT + frac * (headT - tailT);
        attr.setXYZ(p, ax + dx * tPt, ay + dy * tPt, az + dz * tPt);
      }
      attr.needsUpdate = true;

      const fadeIn = Math.min(progress / 0.06, 1);
      const fadeOut = Math.min((1 - progress) / 0.15, 1);
      mat.opacity = fadeIn * fadeOut * 0.97;
      mat.color.set(cfg.color);
      line.visible = true;
    }
  });

  return <group ref={groupRef} />;
}

const NetworkNode = memo(function NetworkNode({
  node,
  isSelected,
  peerCount,
  onClick,
}: {
  node: P2PNode;
  isSelected: boolean;
  peerCount: number;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const cfg = NODE_CONFIG[node.status] || NODE_CONFIG.active;
  const isAlive = node.status !== 'churned';
  const isIdle = node.status === 'idle';

  const baseRadius = useMemo(() => {
    const base = node.status === 'attacker' ? 3.2 : 2.2;
    const peerBonus = Math.min(peerCount / 20, 1) * 1.2;
    return base + peerBonus;
  }, [node.status, peerCount]);

  const pos = useMemo(
    () =>
      new THREE.Vector3(
        node.position[0] * 2.2,
        node.position[1] * 2.2,
        node.position[2] * 2.2,
      ),
    [node.position[0], node.position[1], node.position[2]],
  );

  const emissiveC = useMemo(
    () => new THREE.Color(cfg.emissive),
    [cfg.emissive],
  );
  const glowC = useMemo(() => new THREE.Color(cfg.glow), [cfg.glow]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const now = Date.now();
    const entry = activeGlows.get(node.id);
    const glowing = !!entry && entry.expiresAt > now;
    const glowFrac = glowing ? (entry!.expiresAt - now) / GLOW_DURATION : 0;

    const floatAmp = isIdle ? 0.5 : isAlive ? 1.4 : 0;
    const floatSpeed = isIdle ? 0.35 : 0.7;
    const floatY = Math.sin(t * floatSpeed + pos.x * 0.5) * floatAmp;

    if (meshRef.current) {
      meshRef.current.position.y = floatY;

      const spinMult = node.status === 'attacker' ? 3 : isIdle ? 0.3 : 1;
      meshRef.current.rotation.x += 0.003 * spinMult;
      meshRef.current.rotation.y += 0.005 * spinMult;
      meshRef.current.rotation.z += 0.002 * spinMult;

      const idleDecay = isIdle ? 0.85 : 1;
      const churnDecay = node.status === 'churned' ? 0.3 : 1;
      const targetS =
        (isSelected ? 1.6 : hovered ? 1.3 : 1.0) * idleDecay * churnDecay;
      const pulse =
        isAlive && !isIdle ? 1 + Math.sin(t * 2.5 + pos.x) * 0.04 : 1;
      _sv.setScalar(targetS * pulse);
      meshRef.current.scale.lerp(_sv, 0.08);

      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (glowing && entry) {
        _col.set(entry.color);
        mat.emissive.lerp(_col, 0.4);
        mat.emissiveIntensity =
          (entry.intensity ?? 1) * (1.5 + Math.sin(t * 8) * 2.5 * glowFrac);
      } else {
        mat.emissive.lerp(emissiveC, 0.12);
        mat.emissiveIntensity = isSelected
          ? 2.5
          : hovered
            ? 1.8
            : isIdle
              ? 0.2
              : 1.0;
        if (!glowing && entry) activeGlows.delete(node.id);
      }
    }

    if (glowRef.current) {
      glowRef.current.position.y = floatY;
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      if (glowing && entry) {
        _col.set(entry.color);
        mat.color.lerp(_col, 0.35);
        mat.opacity = 0.06 + Math.sin(t * 6) * 0.14 * glowFrac;
        glowRef.current.scale.setScalar(
          1.4 + glowFrac * (entry.intensity ?? 1),
        );
      } else {
        mat.color.lerp(glowC, 0.08);
        mat.opacity = isSelected ? 0.14 : hovered ? 0.09 : isIdle ? 0.02 : 0.05;
        glowRef.current.scale.setScalar(
          (isSelected ? 2.2 : hovered ? 1.7 : 1.15) *
            (1 + Math.sin(t * 1.5) * 0.06),
        );
      }
    }

    if (ring1Ref.current && isAlive) {
      ring1Ref.current.position.y = floatY;
      const spinR = node.status === 'attacker' ? 0.025 : isIdle ? 0.003 : 0.009;
      ring1Ref.current.rotation.z += spinR;
      ring1Ref.current.rotation.x = Math.PI / 3 + Math.sin(t * 0.3) * 0.1;
      const mat = ring1Ref.current.material as THREE.MeshBasicMaterial;
      if (glowing && entry) {
        _col.set(entry.color);
        mat.color.lerp(_col, 0.3);
        mat.opacity = 0.25 + glowFrac * 0.55;
      } else {
        mat.color.lerp(glowC, 0.08);
        mat.opacity = isSelected ? 0.55 : hovered ? 0.28 : isIdle ? 0.04 : 0.14;
      }
    }

    if (ring2Ref.current && isAlive) {
      ring2Ref.current.position.y = floatY;
      ring2Ref.current.rotation.z -= node.status === 'attacker' ? 0.035 : 0.013;
      ring2Ref.current.rotation.x = -Math.PI / 4 + Math.cos(t * 0.4) * 0.1;
    }
  });

  const handleClick = useCallback(
    (e: any) => {
      e.stopPropagation();
      onClick();
    },
    [onClick],
  );
  const handlePointerOver = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);
  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = 'default';
  }, []);

  const showHud = hovered || isSelected;

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[baseRadius * 2.2, 12, 12]} />
        <meshBasicMaterial
          color={cfg.glow}
          transparent
          opacity={0.05}
          side={THREE.BackSide}
        />
      </mesh>

      {isAlive && (
        <>
          <mesh ref={ring1Ref}>
            <ringGeometry args={[baseRadius + 1.1, baseRadius + 1.4, 48]} />
            <meshBasicMaterial
              color={cfg.glow}
              transparent
              opacity={0.14}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh ref={ring2Ref}>
            <ringGeometry args={[baseRadius + 2.0, baseRadius + 2.15, 48]} />
            <meshBasicMaterial
              color={cfg.color}
              transparent
              opacity={0.06}
              side={THREE.DoubleSide}
            />
          </mesh>
          {node.status === 'attacker' && (
            <mesh>
              <ringGeometry args={[baseRadius + 3.2, baseRadius + 3.35, 48]} />
              <meshBasicMaterial
                color="#f43f5e"
                transparent
                opacity={0.08}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </>
      )}

      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <icosahedronGeometry
          args={[baseRadius, node.status === 'attacker' ? 2 : 1]}
        />
        <meshStandardMaterial
          color={cfg.color}
          emissive={cfg.emissive}
          emissiveIntensity={isIdle ? 0.2 : 1.0}
          metalness={node.status === 'attacker' ? 0.9 : 0.65}
          roughness={node.status === 'attacker' ? 0.05 : 0.15}
          transparent
          opacity={node.status === 'churned' ? 0.08 : isIdle ? 0.6 : 1}
        />
      </mesh>

      <Html position={[0, -(baseRadius + 2.8), 0]} center zIndexRange={[0, 10]}>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: cfg.glow,
            textShadow: `0 0 8px ${cfg.color}cc`,
            opacity: node.status === 'churned' ? 0.2 : showHud ? 1 : 0.55,
            transition: 'opacity 0.2s',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {node.shortId}
          {node.files.length > 0 && (
            <span style={{ color: '#a78bfa', marginLeft: 4 }}>
              ●{node.files.length}
            </span>
          )}
        </div>
      </Html>

      {showHud && (
        <Html position={[baseRadius + 4, baseRadius, 0]} zIndexRange={[10, 20]}>
          <div
            style={{
              background: 'rgba(10,13,28,0.95)',
              backdropFilter: 'blur(24px)',
              border: `1px solid rgba(255,255,255,0.07)`,
              borderLeft: `3px solid ${cfg.color}`,
              borderRadius: 13,
              padding: '12px 15px',
              minWidth: 200,
              fontFamily: 'monospace',
              fontSize: 11,
              pointerEvents: 'none',
              boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 24px ${cfg.color}18`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: cfg.color,
                  boxShadow: `0 0 8px ${cfg.glow}`,
                }}
              />
              <span
                style={{
                  color: cfg.glow,
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: 1,
                }}
              >
                {node.shortId.toUpperCase()}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  background: `${cfg.color}18`,
                  color: cfg.glow,
                  fontSize: 9,
                  padding: '2px 7px',
                  borderRadius: 99,
                  fontWeight: 700,
                  border: `1px solid ${cfg.color}30`,
                }}
              >
                {node.status.toUpperCase()}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '5px 18px',
              }}
            >
              {(
                [
                  ['Peers', node.peers.length],
                  ['Files', node.files.length],
                  ['Messages', node.messageCount],
                  ['Gossip #', node.gossipRound],
                  ['Uptime', `${Math.floor(node.uptimeMs / 1000)}s`],
                  [
                    'Buckets',
                    node.kBuckets.filter((b) => b.peers.length > 0).length,
                  ],
                ] as [string, string | number][]
              ).map(([k, v]) => (
                <div key={k}>
                  <div
                    style={{
                      color: 'rgba(255,255,255,0.25)',
                      fontSize: 9,
                      marginBottom: 1,
                    }}
                  >
                    {k}
                  </div>
                  <div
                    style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700 }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>
            {node.files.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div
                  style={{
                    color: 'rgba(255,255,255,0.22)',
                    fontSize: 9,
                    marginBottom: 4,
                  }}
                >
                  STORED FILES
                </div>
                {node.files.slice(0, 4).map((f) => (
                  <div
                    key={f}
                    style={{
                      background: 'rgba(167,139,250,0.1)',
                      border: '1px solid rgba(167,139,250,0.2)',
                      borderRadius: 5,
                      padding: '3px 7px',
                      fontSize: 10,
                      color: '#c4b5fd',
                      marginBottom: 3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
});

function Scene() {
  const snapshot = useNetworkStore((s) => s.snapshot);
  const selectedNode = useNetworkStore((s) => s.selectedNode);
  const setSelectedNode = useNetworkStore((s) => s.setSelectedNode);

  const nodes = useMemo(() => snapshot?.nodes ?? [], [snapshot]);
  const edges = useMemo(() => snapshot?.edges ?? [], [snapshot]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, P2PNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const posMap = useMemo(() => {
    const m = new Map<string, THREE.Vector3>();

    nodes.forEach((n) =>
      m.set(
        n.id,
        new THREE.Vector3(
          n.position[0] * 2.2,
          n.position[1] * 2.2,
          n.position[2] * 2.2,
        ),
      ),
    );
    return m;
  }, [nodes]);

  const dedupedEdges = useMemo(() => {
    const seen = new Set<string>();
    return edges.filter(([a, b]) => {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [edges]);

  const edgeWeights = useMemo(() => {
    const w = new Map<string, number>();
    dedupedEdges.forEach(([a, b]) => {
      const na = nodeMap.get(a);
      const nb = nodeMap.get(b);
      if (!na || !nb) {
        w.set(`${a}|${b}`, 0);
        return;
      }
      const shared = na.files.filter((f) => nb.files.includes(f)).length;
      const bothActive =
        (na.status === 'active' ? 1 : 0) + (nb.status === 'active' ? 1 : 0);
      w.set(`${a}|${b}`, Math.min(shared * 0.3 + bothActive * 0.35, 1));
    });
    return w;
  }, [dedupedEdges, nodeMap]);

  const visibleEdges = useMemo(() => {
    return dedupedEdges.slice(0, 120);
  }, [dedupedEdges]);

  const visibleTubes = useMemo(() => {
    if (!selectedNode) return [];
    return dedupedEdges.filter(
      ([a, b]) => a === selectedNode.id || b === selectedNode.id,
    );
  }, [selectedNode?.id, dedupedEdges]);

  return (
    <>
      <ambientLight intensity={0.15} color="#0f0c2e" />
      <directionalLight
        position={[50, 80, 30]}
        intensity={1.2}
        color="#818cf8"
      />
      <directionalLight
        position={[-50, 20, -40]}
        intensity={0.5}
        color="#6366f1"
      />
      <pointLight
        position={[0, 0, 0]}
        intensity={0.4}
        color="#a5b4fc"
        distance={300}
      />

      <fog attach="fog" args={['#06091a', 220, 420]} />
      <Stars
        radius={380}
        depth={70}
        count={2500}
        factor={3}
        saturation={0}
        fade
        speed={0.15}
      />

      <EventWatcher />

      {visibleEdges.map(([a, b]) => {
        const posA = posMap.get(a);
        const posB = posMap.get(b);
        if (!posA || !posB) return null;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const weight = edgeWeights.get(key) ?? 0;
        const isHighlighted = selectedNode?.id === a || selectedNode?.id === b;
        const na = nodeMap.get(a);
        const nb = nodeMap.get(b);
        const isAttackEdge =
          na?.status === 'attacker' || nb?.status === 'attacker';
        return (
          <ConnectionTube
            key={`e|${key}`}
            start={posA}
            end={posB}
            color={
              isAttackEdge ? '#f43f5e' : isHighlighted ? '#818cf8' : '#334155'
            }
            weight={
              isHighlighted
                ? Math.max(weight, 0.5)
                : isAttackEdge
                  ? 0.6
                  : weight * 0.4
            }
          />
        );
      })}

      <LiveHopParticles posMap={posMap} />

      {nodes.map((node) => (
        <NetworkNode
          key={node.id}
          node={node}
          isSelected={selectedNode?.id === node.id}
          peerCount={node.peers.length}
          onClick={() =>
            setSelectedNode(selectedNode?.id === node.id ? null : node)
          }
        />
      ))}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        autoRotate
        autoRotateSpeed={0.2}
        minDistance={20}
        maxDistance={400}
        makeDefault
      />
    </>
  );
}

function NodeDetailPanel() {
  const node = useNetworkStore((s) => s.selectedNode);
  const setSelectedNode = useNetworkStore((s) => s.setSelectedNode);
  if (!node) return null;
  const cfg = NODE_CONFIG[node.status] || NODE_CONFIG.active;

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        width: 280,
        background: 'rgba(8,10,24,0.92)',
        backdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderTop: `3px solid ${cfg.color}`,
        borderRadius: 16,
        overflow: 'hidden',
        fontFamily: 'monospace',
        boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 32px ${cfg.color}12`,
      }}
    >
      <div
        style={{
          padding: '13px 17px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: `${cfg.color}0a`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: `${cfg.color}18`,
              border: `1px solid ${cfg.color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: cfg.color,
              }}
            />
          </div>
          <div>
            <div
              style={{
                color: cfg.glow,
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: 1,
              }}
            >
              {node.shortId.toUpperCase()}
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.25)',
                fontSize: 10,
                textTransform: 'capitalize',
                marginTop: 1,
              }}
            >
              {node.status} · {node.peers.length} peers
            </div>
          </div>
        </div>
        <button
          onClick={() => setSelectedNode(null)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.10)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          padding: '14px 17px',
          display: 'flex',
          flexDirection: 'column',
          gap: 13,
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.18)',
            wordBreak: 'break-all',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 7,
            padding: '5px 9px',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {node.id}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 7,
          }}
        >
          {[
            { label: 'Peers', value: node.peers.length, color: '#818cf8' },
            { label: 'Files', value: node.files.length, color: '#a78bfa' },
            { label: 'Msgs', value: node.messageCount, color: '#fbbf24' },
            { label: 'Gossip', value: node.gossipRound, color: '#34d399' },
            {
              label: 'Uptime',
              value: `${Math.floor(node.uptimeMs / 1000)}s`,
              color: '#22d3ee',
            },
            {
              label: 'Buckets',
              value: node.kBuckets.filter((b) => b.peers.length > 0).length,
              color: '#f472b6',
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 9,
                padding: '8px 7px',
                textAlign: 'center',
              }}
            >
              <div
                style={{ color, fontWeight: 800, fontSize: 15, lineHeight: 1 }}
              >
                {value}
              </div>
              <div
                style={{
                  color: 'rgba(255,255,255,0.25)',
                  fontSize: 9,
                  marginTop: 3,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        <div>
          <div
            style={{
              color: 'rgba(255,255,255,0.22)',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            K-Buckets
          </div>
          {node.kBuckets.map((b, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 5,
              }}
            >
              <span
                style={{
                  color: 'rgba(255,255,255,0.2)',
                  fontSize: 9,
                  width: 48,
                  flexShrink: 0,
                }}
              >
                {b.rangeStart}–{b.rangeEnd}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 3,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 99,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: 99,
                    width: `${Math.min((b.peers.length / 4) * 100, 100)}%`,
                    background: `linear-gradient(90deg, ${cfg.color}, ${cfg.glow})`,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              <span
                style={{
                  color: 'rgba(255,255,255,0.25)',
                  fontSize: 9,
                  width: 10,
                  textAlign: 'right',
                }}
              >
                {b.peers.length}
              </span>
            </div>
          ))}
        </div>

        {node.files.length > 0 && (
          <div>
            <div
              style={{
                color: 'rgba(255,255,255,0.22)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 7,
              }}
            >
              Stored Files
            </div>
            {node.files.slice(0, 6).map((f) => (
              <div
                key={f}
                style={{
                  background: 'rgba(167,139,250,0.08)',
                  border: '1px solid rgba(167,139,250,0.18)',
                  borderRadius: 6,
                  padding: '4px 9px',
                  fontSize: 10,
                  color: '#c4b5fd',
                  marginBottom: 3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {f}
              </div>
            ))}
          </div>
        )}

        {node.status === 'active' && (
          <button
            onClick={() => {
              api.killNode(node.id);
              setSelectedNode(null);
            }}
            style={{
              width: '100%',
              padding: '9px',
              background: 'rgba(244,63,94,0.08)',
              border: '1px solid rgba(244,63,94,0.25)',
              borderRadius: 10,
              color: '#fda4af',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'monospace',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(244,63,94,0.18)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(244,63,94,0.08)';
            }}
          >
            ✕ Kill This Node
          </button>
        )}
      </div>
    </div>
  );
}

function Legend() {
  const entries = [
    { color: '#34d399', label: 'Gossip ripple' },
    { color: '#a78bfa', label: 'File transfer' },
    { color: '#fbbf24', label: 'Lookup hop' },
    { color: '#f43f5e', label: 'Attack vector' },
    { color: '#818cf8', label: 'Active node' },
    { color: '#334155', label: 'Idle node' },
    { color: '#f43f5e', label: 'Attacker node' },
    { color: '#f59e0b', label: 'Victim node' },
  ];
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 10,
        background: 'rgba(8,10,24,0.88)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 13,
        padding: '13px 15px',
        fontFamily: 'monospace',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        minWidth: 158,
      }}
    >
      <div
        style={{
          color: 'rgba(255,255,255,0.2)',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Visual Guide
      </div>
      {entries.map(({ color, label }) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 5px ${color}88`,
              flexShrink: 0,
            }}
          />
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>
            {label}
          </span>
        </div>
      ))}
      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.15)',
          fontSize: 9,
          letterSpacing: 1,
        }}
      >
        Drag · Scroll · Click node
      </div>
    </div>
  );
}

export function NetworkMap3D() {
  return (
    <div
      style={{
        width: '100%',
        height: 'calc(100vh - 57px)',
        position: 'relative',
      }}
    >
      <Canvas
        camera={{ position: [0, 55, 210], fov: 52 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={Math.min(
          typeof window !== 'undefined' ? window.devicePixelRatio : 1,
          1.5,
        )}
        style={{
          background:
            'radial-gradient(ellipse at 35% 25%, #1a1740 0%, #0c0f1e 50%, #06091a 100%)',
        }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <NodeDetailPanel />
      <Legend />
    </div>
  );
}
