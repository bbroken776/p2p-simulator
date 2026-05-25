import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { P2PModule } from '../p2p/p2p.module';

@Module({
  imports: [P2PModule],
  controllers: [ApiController],
})
export class ApiModule {}
