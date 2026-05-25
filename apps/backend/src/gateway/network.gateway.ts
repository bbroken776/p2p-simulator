import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { WS_EVENTS } from '@p2p-simulator/shared';
import type {
  NetworkSnapshot,
  NetworkEvent,
} from '@p2p-simulator/shared';
import { P2PService } from '../p2p/p2p.service';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
    ],
    credentials: true,
  },
  namespace: '/',
})
export class NetworkGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly p2pService: P2PService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    
    client.emit(WS_EVENTS.NETWORK_SNAPSHOT, this.p2pService.getSnapshot());
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @OnEvent('network.snapshot')
  handleSnapshot(snapshot: NetworkSnapshot) {
    this.server.emit(WS_EVENTS.NETWORK_SNAPSHOT, snapshot);
  }

  @OnEvent('network.event')
  handleNetworkEvent(event: NetworkEvent) {
    this.server.emit(WS_EVENTS.NETWORK_EVENT, event);
  }

  @SubscribeMessage('ping')
  handlePing(): string {
    return 'pong';
  }
}
