'use client';
import { useState } from 'react';
import {
  Flex,
  Box,
  Text,
  Button,
  Input,
  Textarea,
  Select,
  HStack,
  Divider,
  Badge,
  Code,
} from '@chakra-ui/react';
import { useNetworkStore } from '../../store/network.store';
import { api } from '../../lib/api';
import { glassCard } from '../../lib/styles';

function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      fontSize="9px"
      fontWeight={700}
      color="whiteAlpha.400"
      letterSpacing="0.12em"
      textTransform="uppercase"
      mb={2.5}
    >
      {children}
    </Text>
  );
}

function FeedbackBar({
  msg,
  type,
}: {
  msg: string;
  type: 'success' | 'error';
}) {
  return (
    <Flex
      px={3}
      py={2}
      borderRadius="10px"
      align="flex-start"
      gap={2}
      bg={type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}
      border="1px solid"
      borderColor={
        type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'
      }
    >
      <Box
        w={1.5}
        h={1.5}
        borderRadius="full"
        mt="5px"
        flexShrink={0}
        bg={type === 'success' ? 'green.400' : 'red.400'}
      />
      <Text
        fontSize="xs"
        color={type === 'success' ? 'green.300' : 'red.300'}
        lineHeight={1.5}
        wordBreak="break-word"
      >
        {msg}
      </Text>
    </Flex>
  );
}

const gf = { variant: 'glass' as const, size: 'sm' as const };

export function ControlPanel() {
  const snapshot = useNetworkStore((s) => s.snapshot);
  const isConnected = useNetworkStore((s) => s.isConnected);

  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [sybilCount, setSybilCount] = useState(5);
  const [eclipseTarget, setEclipseTarget] = useState('');
  const [loading, setLoading] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  const nodes = snapshot?.nodes ?? [];
  const activeNodes = nodes.filter((n) => n.status === 'active');

  const showFeedback = (type: 'success' | 'error', msg: string, ttl = 4000) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), ttl);
  };

  const wrap = async (
    key: string,
    fn: () => Promise<unknown>,
    successMsg?: string,
  ): Promise<boolean> => {
    setLoading(key);
    setFeedback(null);
    try {
      await fn();
      if (successMsg) showFeedback('success', successMsg);
      return true;
    } catch (e: any) {
      
      showFeedback('error', e?.message ?? 'Request failed', 6000);
      console.error(`[ControlPanel] ${key} failed:`, e);
      return false;
    } finally {
      setLoading('');
    }
  };

  const gradBtn = (from: string, to: string, shadow: string) => ({
    bg: `linear-gradient(135deg, ${from}, ${to})`,
    color: 'white',
    boxShadow: `0 4px 12px ${shadow}`,
    _hover: {
      boxShadow: `0 6px 20px ${shadow}`,
      transform: 'translateY(-1px)',
      opacity: 0.92,
      textDecoration: 'none',
    },
    _active: { transform: 'translateY(0px)' },
    transition: 'all 0.2s',
    fontSize: 'xs',
    fontWeight: 700,
  });

  const handleAddNode = () =>
    wrap('addNode', () => api.addNode(1), 'Node added to network');

  const handleKillRandom = () => {
    if (activeNodes.length === 0) {
      showFeedback('error', 'No active nodes to kill');
      return;
    }
    const node = activeNodes[Math.floor(Math.random() * activeNodes.length)];
    wrap(
      'killNode',
      () => api.killNode(node.id),
      `Node ${node.shortId} removed`,
    );
  };

  const handlePublish = async () => {
    if (!fileName.trim()) {
      showFeedback('error', 'File name is required');
      return;
    }
    const ok = await wrap(
      'publish',
      () => api.publishFile(fileName.trim(), fileData),
      `"${fileName.trim()}" published to network`,
    );
    if (ok) {
      setFileName('');
      setFileData('');
    }
  };

  const handleLookup = () => {
    if (!lookupId.trim()) {
      showFeedback('error', 'Enter a file ID or name');
      return;
    }
    wrap('lookup', () => api.lookupFile(lookupId.trim()), 'Lookup initiated');
  };

  const handleSybil = () =>
    wrap(
      'sybil',
      () => api.launchAttack('SYBIL', undefined, sybilCount),
      `Sybil: ${sybilCount} malicious nodes injected`,
    );

  const handleEclipse = () => {
    if (!eclipseTarget) {
      showFeedback('error', 'Select a target node first');
      return;
    }
    wrap(
      'eclipse',
      () => api.launchAttack('ECLIPSE', eclipseTarget),
      'Eclipse attack launched',
    );
  };

  return (
    <Flex direction="column" flex={1} minH={0} {...glassCard} overflow="hidden">
      {}
      <Flex
        px={5}
        py={3.5}
        borderBottom="1px solid rgba(255,255,255,0.08)"
        justify="space-between"
        align="center"
        flexShrink={0}
      >
        <Box>
          <Text fontWeight={700} fontSize="sm" color="white">
            Control Panel
          </Text>
          <Text fontSize="10px" color="whiteAlpha.400" mt={0.5}>
            Real-time network control
          </Text>
        </Box>
        <HStack spacing={1.5}>
          <Badge
            fontSize="9px"
            px={2}
            py={0.5}
            borderRadius="full"
            bg="rgba(99,102,241,0.15)"
            color="brand.300"
            border="1px solid rgba(99,102,241,0.25)"
          >
            {activeNodes.length} active
          </Badge>
          <Badge
            fontSize="9px"
            px={2}
            py={0.5}
            borderRadius="full"
            bg={isConnected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}
            color={isConnected ? 'green.300' : 'red.300'}
            border={`1px solid ${isConnected ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`}
          >
            {isConnected ? '● live' : '○ offline'}
          </Badge>
        </HStack>
      </Flex>

      {}
      <Box flex={1} overflowY="auto" px={5} py={4}>
        <Flex direction="column" gap={5}>
          {feedback && <FeedbackBar {...feedback} />}

          {}
          <Box>
            <SectionTitle>Node Management</SectionTitle>
            <HStack spacing={2}>
              <Button
                flex={1}
                size="sm"
                isLoading={loading === 'addNode'}
                onClick={handleAddNode}
                {...gradBtn('#6366f1', '#8b5cf6', 'rgba(99,102,241,0.35)')}
              >
                + Add Node
              </Button>
              <Button
                flex={1}
                size="sm"
                variant="outline"
                fontWeight={700}
                fontSize="xs"
                borderColor="rgba(239,68,68,0.3)"
                color="red.300"
                _hover={{
                  bg: 'rgba(239,68,68,0.1)',
                  borderColor: 'rgba(239,68,68,0.5)',
                }}
                isLoading={loading === 'killNode'}
                onClick={handleKillRandom}
              >
                ✕ Kill Random
              </Button>
            </HStack>
          </Box>

          <Divider borderColor="rgba(255,255,255,0.07)" />

          {}
          <Box>
            <SectionTitle>Publish File</SectionTitle>
            <Flex direction="column" gap={2}>
              <Input
                {...gf}
                placeholder="filename.txt"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePublish()}
              />
              <Textarea
                {...gf}
                placeholder="File contents (optional)..."
                value={fileData}
                onChange={(e) => setFileData(e.target.value)}
                rows={3}
                resize="none"
              />
              <Button
                size="sm"
                isLoading={loading === 'publish'}
                onClick={handlePublish}
                {...gradBtn('#10b981', '#34d399', 'rgba(16,185,129,0.35)')}
              >
                ↑ Publish to Network
              </Button>
            </Flex>
          </Box>

          <Divider borderColor="rgba(255,255,255,0.07)" />

          {}
          <Box>
            <SectionTitle>File Lookup</SectionTitle>
            <Flex direction="column" gap={2}>
              <Input
                {...gf}
                placeholder="File ID or name..."
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              />
              <Button
                size="sm"
                isLoading={loading === 'lookup'}
                onClick={handleLookup}
                {...gradBtn('#8b5cf6', '#a78bfa', 'rgba(139,92,246,0.35)')}
              >
                ⌕ Lookup in DHT
              </Button>
            </Flex>
          </Box>

          <Divider borderColor="rgba(255,255,255,0.07)" />

          {}
          <Box>
            <SectionTitle>⚠ Attack Simulation</SectionTitle>
            <Flex
              mb={3}
              px={3}
              py={2}
              borderRadius="10px"
              bg="rgba(239,68,68,0.07)"
              border="1px solid rgba(239,68,68,0.18)"
            >
              <Text fontSize="10px" color="red.300" lineHeight={1.5}>
                Sybil floods with fake nodes. Eclipse isolates a target by
                surrounding it.
              </Text>
            </Flex>
            <Flex direction="column" gap={2}>
              <HStack spacing={2} align="center">
                <Text
                  fontSize="xs"
                  color="whiteAlpha.500"
                  flexShrink={0}
                  w="58px"
                >
                  Sybil nodes:
                </Text>
                <Input
                  variant="glass"
                  size="sm"
                  type="number"
                  min={1}
                  max={20}
                  w="64px"
                  value={sybilCount}
                  onChange={(e) =>
                    setSybilCount(
                      Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
                    )
                  }
                />
                <Button
                  flex={1}
                  size="sm"
                  isLoading={loading === 'sybil'}
                  onClick={handleSybil}
                  {...gradBtn('#ef4444', '#f87171', 'rgba(239,68,68,0.35)')}
                >
                  Sybil Attack
                </Button>
              </HStack>

              <Select
                variant="glass"
                size="sm"
                placeholder="Select Eclipse target..."
                value={eclipseTarget}
                onChange={(e) => setEclipseTarget(e.target.value)}
                sx={{ option: { background: '#1e1b4b', color: 'white' } }}
              >
                {activeNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.shortId} — {n.peers.length} peers
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                isDisabled={!eclipseTarget}
                isLoading={loading === 'eclipse'}
                onClick={handleEclipse}
                {...gradBtn('#f59e0b', '#fbbf24', 'rgba(245,158,11,0.35)')}
              >
                Eclipse Attack
              </Button>
            </Flex>
          </Box>
        </Flex>
      </Box>
    </Flex>
  );
}
