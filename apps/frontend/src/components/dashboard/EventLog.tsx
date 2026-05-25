'use client';
import { useState, useRef } from 'react';
import { Flex, Box, Text, HStack, Badge, Button } from '@chakra-ui/react';
import { useNetworkStore } from '../../store/network.store';
import { NetworkEvent, NetworkEventType } from '@p2p-simulator/shared';
import { glassCard } from '../../lib/styles';

const SEVERITY: Record<string, { bg: string; color: string; dot: string }> = {
  info: { bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc', dot: '#818cf8' },
  success: { bg: 'rgba(16,185,129,0.15)', color: '#6ee7b7', dot: '#34d399' },
  warning: { bg: 'rgba(245,158,11,0.15)', color: '#fcd34d', dot: '#fbbf24' },
  danger: { bg: 'rgba(239,68,68,0.15)', color: '#fca5a5', dot: '#f87171' },
};

const TYPE_SHORT: Partial<Record<NetworkEventType, string>> = {
  NODE_JOINED: 'JOIN',
  NODE_LEFT: 'LEAVE',
  GOSSIP_ROUND: 'GOSSIP',
  LOOKUP_STARTED: 'LOOKUP',
  LOOKUP_HOP: 'HOP',
  LOOKUP_SUCCESS: 'FOUND',
  LOOKUP_FAILED: 'MISS',
  FILE_PUBLISHED: 'PUBLISH',
  FILE_RETRIEVED: 'FETCH',
  CHUNK_STORED: 'STORE',
  ATTACK_STARTED: 'ATTACK',
  ATTACK_HIT: 'HIT',
};

const FILTERS = ['ALL', 'NODE', 'GOSSIP', 'FILE', 'ATTACK'] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(type: string, f: Filter): boolean {
  if (f === 'ALL') return true;
  if (f === 'NODE') return type.startsWith('NODE');
  if (f === 'GOSSIP') return type === 'GOSSIP_ROUND';
  if (f === 'FILE')
    return [
      'FILE_PUBLISHED',
      'FILE_RETRIEVED',
      'CHUNK_STORED',
      'LOOKUP_STARTED',
      'LOOKUP_HOP',
      'LOOKUP_SUCCESS',
      'LOOKUP_FAILED',
    ].includes(type);
  if (f === 'ATTACK') return type.startsWith('ATTACK');
  return true;
}

function EventRow({ event }: { event: NetworkEvent }) {
  const s = SEVERITY[event.severity] || SEVERITY.info;
  const tag =
    TYPE_SHORT[event.type as NetworkEventType] ?? event.type.split('_')[0];
  const time = new Date(event.timestamp).toLocaleTimeString('en', {
    hour12: false,
  });

  return (
    <Flex
      h="45px"
      px={4}
      align="center"
      gap={3}
      borderBottom="1px solid rgba(255,255,255,0.04)"
      _hover={{ bg: 'rgba(255,255,255,0.04)' }}
      transition="background 0.15s"
      position="absolute"
      top={0}
      left={0}
      right={0}
    >
      <Box w={1.5} h={1.5} borderRadius="full" bg={s.dot} flexShrink={0} />
      <Text
        fontSize="10px"
        color="whiteAlpha.400"
        fontFamily="mono"
        flexShrink={0}
        w="52px"
      >
        {time}
      </Text>
      <Badge
        px={2}
        py={0.5}
        borderRadius="6px"
        fontSize="9px"
        fontWeight={700}
        letterSpacing="0.06em"
        bg={s.bg}
        color={s.color}
        flexShrink={0}
        w="52px"
        textAlign="center"
      >
        {tag}
      </Badge>
      <Text fontSize="xs" color="whiteAlpha.700" lineHeight={1.5} noOfLines={1}>
        {event.message}
      </Text>
    </Flex>
  );
}

export function EventLog() {
  const events = useNetworkStore((s) => s.events);
  const [filter, setFilter] = useState<Filter>('ALL');
  const filtered = events.filter((e) => matchesFilter(e.type, filter));

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const ROW_HEIGHT = 45;
  const containerHeight = containerRef.current?.clientHeight || 500;

  const overscan = 4;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - overscan);
  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + overscan * 2;
  const endIndex = Math.min(filtered.length, startIndex + visibleCount);
  
  const visibleEvents = filtered.slice(startIndex, endIndex);

  return (
    <Flex direction="column" flex={1} minH={0} {...glassCard} overflow="hidden">
      <Flex
        px={5}
        py={3.5}
        justify="space-between"
        align="center"
        borderBottom="1px solid rgba(255,255,255,0.08)"
        flexShrink={0}
      >
        <Box>
          <Text fontWeight={700} fontSize="sm" color="white">
            Event Log
          </Text>
          <Text fontSize="10px" color="whiteAlpha.400" mt={0.5}>
            {filtered.length} events
          </Text>
        </Box>
        <HStack spacing={1}>
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="xs"
              px={3}
              borderRadius="8px"
              fontSize="10px"
              fontWeight={700}
              letterSpacing="0.04em"
              onClick={() => setFilter(f)}
              bg={filter === f ? 'rgba(99,102,241,0.5)' : 'transparent'}
              color={filter === f ? 'white' : 'whiteAlpha.500'}
              border="1px solid"
              borderColor={
                filter === f ? 'rgba(99,102,241,0.6)' : 'transparent'
              }
              _hover={{
                bg:
                  filter === f
                    ? 'rgba(99,102,241,0.6)'
                    : 'rgba(255,255,255,0.06)',
                color: 'white',
              }}
              transition="all 0.15s"
            >
              {f}
            </Button>
          ))}
        </HStack>
      </Flex>
      <Box 
        flex={1} 
        overflowY="auto"
        ref={containerRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        {filtered.length === 0 ? (
          <Flex
            h="full"
            align="center"
            justify="center"
            direction="column"
            gap={2}
          >
            <Text fontSize="sm" color="whiteAlpha.300">
              No events yet
            </Text>
            <Text fontSize="xs" color="whiteAlpha.200">
              Waiting for network activity...
            </Text>
          </Flex>
        ) : (
          <Box position="relative" h={`${filtered.length * ROW_HEIGHT}px`}>
            {visibleEvents.map((e, idx) => {
              const actualIndex = startIndex + idx;
              return (
                <Box
                  key={e.id}
                  position="absolute"
                  top={`${actualIndex * ROW_HEIGHT}px`}
                  width="100%"
                >
                  <EventRow event={e} />
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Flex>
  );
}
