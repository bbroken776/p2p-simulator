import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { P2PModule } from '../p2p/p2p.module';
import { GatewayModule } from '../gateway/gateway.module';
import { ApiModule } from '../api/api.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    P2PModule,
    GatewayModule,
    ApiModule,
  ],
})
export class AppModule {}
