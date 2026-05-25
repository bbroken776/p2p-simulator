import { Module } from '@nestjs/common';
import { NetworkGateway } from './network.gateway';
import { P2PModule } from '../p2p/p2p.module';

@Module({
  imports: [P2PModule],
  providers: [NetworkGateway],
})
export class GatewayModule {}
