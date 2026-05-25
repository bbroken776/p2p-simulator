'use client';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import NextLink from 'next/link';
import { Flex, Box, Text, HStack, Badge, Link } from '@chakra-ui/react';
import { useNetworkStore } from '../../store/network.store';

const NetworkMap3D = dynamic(
  () =>
    import('../../components/network/NetworkMap3D').then((m) => m.NetworkMap3D),
  { ssr: false, loading: () => <Loader /> },
);

function Loader() {
  return (
    <Flex
      flex={1}
      align="center"
      justify="center"
      direction="column"
      gap={4}
      bg="gray.950"
    >
      <Box
        w={12}
        h={12}
        border="2px solid"
        borderColor="brand.500"
        borderTopColor="transparent"
        borderRadius="full"
        sx={{
          animation: 'spin 0.8s linear infinite',
          '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
        }}
      />
      <Text
        color="brand.300"
        fontSize="xs"
        fontFamily="mono"
        letterSpacing="widest"
      >
        INITIALIZING NETWORK MAP
      </Text>
    </Flex>
  );
}

export default function NetworkPage() {
  const initSocket = useNetworkStore((s) => s.initSocket);
  const isConnected = useNetworkStore((s) => s.isConnected);
  const snapshot = useNetworkStore((s) => s.snapshot);

  useEffect(() => {
    initSocket();
  }, [initSocket]);

  const stats = [
    {
      label: 'NODES',
      value: snapshot?.metrics.activeNodes ?? 0,
      color: 'brand.300',
    },
    { label: 'EDGES', value: snapshot?.edges.length ?? 0, color: 'purple.300' },
    {
      label: 'GOSSIP',
      value: snapshot?.metrics.gossipRounds ?? 0,
      color: 'green.300',
    },
    {
      label: 'MSG/S',
      value: snapshot?.metrics.messagesPerSecond ?? 0,
      color: 'yellow.300',
    },
  ];

  return (
    <Flex direction="column" h="100vh" overflow="hidden" bg="gray.950">
      {}
      <Flex
        as="header"
        px={6}
        py={3}
        align="center"
        justify="space-between"
        bg="rgba(15,23,42,0.85)"
        backdropFilter="blur(20px)"
        borderBottom="1px solid rgba(255,255,255,0.06)"
        boxShadow="0 1px 24px rgba(0,0,0,0.3)"
        flexShrink={0}
        zIndex={10}
      >
        <HStack spacing={4}>
          <Link
            as={NextLink}
            href="/"
            display="flex"
            alignItems="center"
            gap={1.5}
            color="gray.400"
            _hover={{ color: 'white' }}
            fontSize="xs"
            fontWeight={600}
            transition="color 0.15s"
            textDecoration="none"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M9 2L4 7l5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Dashboard
          </Link>
          <Box w="1px" h={4} bg="whiteAlpha.200" />
          <HStack spacing={2}>
            <Box
              w={2}
              h={2}
              borderRadius="full"
              bg={isConnected ? 'green.400' : 'red.400'}
              sx={
                isConnected
                  ? {
                      animation: 'pulse 2s ease-in-out infinite',
                      '@keyframes pulse': {
                        '0%,100%': { opacity: 1 },
                        '50%': { opacity: 0.4 },
                      },
                    }
                  : {}
              }
            />
            <Text
              fontSize="xs"
              fontWeight={800}
              color="white"
              letterSpacing="0.12em"
              fontFamily="mono"
            >
              3D NETWORK MAP
            </Text>
          </HStack>
        </HStack>

        <HStack spacing={6}>
          {stats.map(({ label, value, color }) => (
            <Box key={label} textAlign="center">
              <Text
                fontSize="sm"
                fontWeight={800}
                color={color}
                fontFamily="mono"
              >
                {value}
              </Text>
              <Text fontSize="8px" color="whiteAlpha.400" letterSpacing="wider">
                {label}
              </Text>
            </Box>
          ))}
          <Box w="1px" h={8} bg="whiteAlpha.100" />
          <Text
            fontSize="9px"
            color="whiteAlpha.300"
            fontFamily="mono"
            letterSpacing="wider"
          >
            DRAG · SCROLL · CLICK
          </Text>
        </HStack>
      </Flex>

      {}
      <Box flex={1} position="relative">
        <NetworkMap3D />
      </Box>
    </Flex>
  );
}
