'use client';
import { Grid, Flex, Box, Text } from '@chakra-ui/react';
import { useNetworkStore } from '../../store/network.store';
import { glassCard, glassCardHover } from '../../lib/styles';

const METRICS = [
  {
    label: 'Active Nodes',
    getValue: (m: any) => m?.activeNodes ?? 0,
    sub: () => 'in network',
    color: '#818cf8',
    gradient: 'linear(to-br, #6366f1, #8b5cf6)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="7" r="3.5" stroke="white" strokeWidth="1.8" />
        <path
          d="M2 16c0-3.3 3.1-6 7-6s7 2.7 7 6"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: 'Total Messages',
    getValue: (m: any) => m?.totalMessages ?? 0,
    sub: (m: any) => `${m?.messagesPerSecond ?? 0}/sec`,
    color: '#c084fc',
    gradient: 'linear(to-br, #8b5cf6, #a78bfa)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M2 4h14a1 1 0 011 1v7a1 1 0 01-1 1h-5l-3 2v-2H2a1 1 0 01-1-1V5a1 1 0 011-1z"
          stroke="white"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Throughput',
    getValue: (m: any) => `${m?.messagesPerSecond ?? 0}/s`,
    sub: () => 'msg per sec',
    color: '#22d3ee',
    gradient: 'linear(to-br, #06b6d4, #22d3ee)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M2 9h14M11 4l5 5-5 5"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Lookup Success',
    getValue: (m: any) => `${m?.lookupSuccessRate ?? 100}%`,
    sub: (m: any) =>
      (m?.lookupSuccessRate ?? 100) >= 80 ? 'Healthy' : 'Degraded',
    color: '#34d399',
    gradient: 'linear(to-br, #10b981, #34d399)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="8" cy="8" r="5" stroke="white" strokeWidth="1.8" />
        <path
          d="M12 12l4 4"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M5.5 8l2 2 3-3"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Avg Hops',
    getValue: (m: any) => m?.averageHops ?? 0,
    sub: () => 'per lookup',
    color: '#fbbf24',
    gradient: 'linear(to-br, #f59e0b, #fbbf24)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M2 9h3l2-4 2 8 2-4h5"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Gossip Rounds',
    getValue: (m: any) => m?.gossipRounds ?? 0,
    sub: () => 'completed',
    color: '#f472b6',
    gradient: 'linear(to-br, #ec4899, #f472b6)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M16 9A7 7 0 112 9"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M16 9l-2-2.5M16 9l-2.5 2"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: 'Files Shared',
    getValue: (m: any) => m?.filesInNetwork ?? 0,
    sub: () => 'distributed',
    color: '#2dd4bf',
    gradient: 'linear(to-br, #14b8a6, #2dd4bf)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M4 2h6l4 4v10H4V2z"
          stroke="white"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M10 2v4h4" stroke="white" strokeWidth="1.8" />
      </svg>
    ),
  },
];

export function MetricsBar() {
  const snapshot = useNetworkStore((s) => s.snapshot);
  const m = snapshot?.metrics;

  return (
    <Grid templateColumns="repeat(7, 1fr)" gap={3}>
      {METRICS.map((metric) => (
        <Flex
          key={metric.label}
          {...glassCardHover}
          borderLeft={`3px solid ${metric.color}`}
          p={3}
          align="center"
          gap={3}
        >
          <Flex
            w={9}
            h={9}
            bgGradient={metric.gradient}
            borderRadius="10px"
            align="center"
            justify="center"
            flexShrink={0}
            boxShadow={`0 4px 12px ${metric.color}55`}
          >
            {metric.icon}
          </Flex>
          <Box minW={0}>
            <Text
              fontSize="9px"
              color="whiteAlpha.500"
              fontWeight={600}
              letterSpacing="0.06em"
              textTransform="uppercase"
              noOfLines={1}
            >
              {metric.label}
            </Text>
            <Text fontSize="lg" fontWeight={800} color="white" lineHeight={1.1}>
              {metric.getValue(m)}
            </Text>
            <Text fontSize="9px" color="whiteAlpha.400" mt={0.5}>
              {metric.sub(m)}
            </Text>
          </Box>
        </Flex>
      ))}
    </Grid>
  );
}
