'use client';
import { useEffect } from 'react';
import NextLink from 'next/link';
import {
  Flex,
  Box,
  HStack,
  Text,
  Badge,
  Link,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { useNetworkStore } from '../store/network.store';
import { MetricsBar } from '../components/dashboard/MetricsBar';
import { EventLog } from '../components/dashboard/EventLog';
import { ControlPanel } from '../components/dashboard/ControlPanel';
import { glassNav } from '../lib/styles';

function P2PIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="2.5" fill="white" />
      <circle cx="3" cy="5" r="2" fill="white" opacity="0.85" />
      <circle cx="17" cy="5" r="2" fill="white" opacity="0.85" />
      <circle cx="3" cy="15" r="2" fill="white" opacity="0.85" />
      <circle cx="17" cy="15" r="2" fill="white" opacity="0.85" />
      <line
        x1="10"
        y1="10"
        x2="3"
        y2="5"
        stroke="white"
        strokeWidth="1.2"
        opacity="0.6"
      />
      <line
        x1="10"
        y1="10"
        x2="17"
        y2="5"
        stroke="white"
        strokeWidth="1.2"
        opacity="0.6"
      />
      <line
        x1="10"
        y1="10"
        x2="3"
        y2="15"
        stroke="white"
        strokeWidth="1.2"
        opacity="0.6"
      />
      <line
        x1="10"
        y1="10"
        x2="17"
        y2="15"
        stroke="white"
        strokeWidth="1.2"
        opacity="0.6"
      />
      <line
        x1="3"
        y1="5"
        x2="17"
        y2="5"
        stroke="white"
        strokeWidth="0.8"
        opacity="0.3"
      />
      <line
        x1="3"
        y1="15"
        x2="17"
        y2="15"
        stroke="white"
        strokeWidth="0.8"
        opacity="0.3"
      />
      <line
        x1="3"
        y1="5"
        x2="3"
        y2="15"
        stroke="white"
        strokeWidth="0.8"
        opacity="0.3"
      />
      <line
        x1="17"
        y1="5"
        x2="17"
        y2="15"
        stroke="white"
        strokeWidth="0.8"
        opacity="0.3"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const initSocket = useNetworkStore((s) => s.initSocket);
  const isConnected = useNetworkStore((s) => s.isConnected);
  useEffect(() => {
    initSocket();
  }, [initSocket]);

  return (
    <Flex direction="column" h="100vh" overflow="hidden">
      {}
      <Flex
        as="header"
        px={6}
        py={3}
        align="center"
        justify="space-between"
        flexShrink={0}
        zIndex={10}
        {...glassNav}
      >
        <HStack spacing={3}>
          <Flex
            w={9}
            h={9}
            bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
            borderRadius="12px"
            align="center"
            justify="center"
            boxShadow="0 4px 16px rgba(99,102,241,0.5)"
          >
            <P2PIcon />
          </Flex>
          <Box>
            <Text
              fontWeight={800}
              fontSize="sm"
              letterSpacing="0.1em"
              bgGradient="linear(to-r, #a5b4fc, #e879f9)"
              bgClip="text"
              lineHeight={1.2}
            >
              P2P-SIMULATOR
            </Text>
            <Text fontSize="10px" color="whiteAlpha.500" letterSpacing="0.04em">
              Kademlia DHT · Gossip Protocol
            </Text>
          </Box>
          <Badge
            ml={2}
            px={3}
            py={1}
            borderRadius="full"
            fontSize="10px"
            fontWeight={700}
            letterSpacing="0.06em"
            bg={isConnected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}
            color={isConnected ? 'green.300' : 'red.300'}
            border="1px solid"
            borderColor={
              isConnected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'
            }
            display="flex"
            alignItems="center"
            gap={1.5}
          >
            <Box
              as="span"
              w={1.5}
              h={1.5}
              borderRadius="full"
              display="inline-block"
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
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </Badge>
        </HStack>

        <Link
          as={NextLink}
          href="/network"
          px={4}
          py={2}
          borderRadius="10px"
          fontSize="xs"
          fontWeight={700}
          letterSpacing="0.04em"
          color="white"
          bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
          boxShadow="0 4px 16px rgba(99,102,241,0.4)"
          _hover={{
            boxShadow: '0 6px 24px rgba(99,102,241,0.6)',
            transform: 'translateY(-1px)',
            textDecoration: 'none',
          }}
          transition="all 0.2s"
          display="flex"
          alignItems="center"
          gap={2}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2" fill="white" opacity="0.9" />
            <circle cx="1" cy="3" r="1.3" fill="white" opacity="0.7" />
            <circle cx="13" cy="3" r="1.3" fill="white" opacity="0.7" />
            <circle cx="1" cy="11" r="1.3" fill="white" opacity="0.7" />
            <circle cx="13" cy="11" r="1.3" fill="white" opacity="0.7" />
            <line x1="7" y1="7" x2="1" y2="3" stroke="white" strokeWidth="1" />
            <line x1="7" y1="7" x2="13" y2="3" stroke="white" strokeWidth="1" />
            <line x1="7" y1="7" x2="1" y2="11" stroke="white" strokeWidth="1" />
            <line
              x1="7"
              y1="7"
              x2="13"
              y2="11"
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          3D Network Map
        </Link>
      </Flex>

      {}
      <Flex
        direction="column"
        flex={1}
        minH={0}
        px={5}
        py={4}
        gap={4}
        overflow="hidden"
      >
        <Box flexShrink={0}>
          <MetricsBar />
        </Box>
        <Grid
          flex={1}
          minH={0}
          templateColumns={{ base: '1fr', md: '1fr 340px' }}
          gap={4}
          overflow="hidden"
        >
          <GridItem overflow="hidden" display="flex" flexDir="column">
            <EventLog />
          </GridItem>
          <GridItem overflow="hidden" display="flex" flexDir="column">
            <ControlPanel />
          </GridItem>
        </Grid>
      </Flex>
    </Flex>
  );
}
