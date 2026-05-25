import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { P2PService } from '../p2p/p2p.service';
import type {
  AddNodePayload,
  PublishFilePayload,
  LookupPayload,
  AttackConfig,
  KillNodePayload,
} from '@p2p-simulator/shared';

@Controller()
export class ApiController {
  constructor(private readonly p2pService: P2PService) {}

  

  @Get('snapshot')
  getSnapshot() {
    return this.p2pService.getSnapshot();
  }

  @Get('metrics')
  getMetrics() {
    return this.p2pService.getMetrics();
  }

  @Get('events')
  getEvents(@Query('limit') limit?: string) {
    return this.p2pService.getEvents(limit ? parseInt(limit) : 100);
  }

  

  @Post('nodes')
  addNode(@Body() body: AddNodePayload) {
    const count = body.count || 1;
    const nodes = [];
    for (let i = 0; i < count; i++) {
      nodes.push(this.p2pService.spawnNode());
    }
    return { added: count, nodes: nodes.map((n) => n.toSnapshot()) };
  }

  @Delete('nodes/:id')
  killNode(@Param('id') id: string) {
    try {
      this.p2pService.killNode(id);
      return { killed: id };
    } catch {
      throw new NotFoundException(`Node ${id} not found`);
    }
  }

  

  @Get('files')
  getFiles() {
    return this.p2pService.getAllFiles();
  }

  @Post('files')
  publishFile(@Body() body: PublishFilePayload) {
    const manifest = this.p2pService.publishFile(
      body.fileName,
      body.data,
      body.fromNodeId,
    );
    return manifest;
  }

  @Post('files/lookup')
  lookupFile(@Body() body: LookupPayload) {
    const success = this.p2pService.lookupFile(body.fileId, body.fromNodeId);
    return { success, fileId: body.fileId };
  }

  

  @Post('attacks')
  launchAttack(@Body() body: AttackConfig) {
    this.p2pService.launchAttack(body);
    return { launched: body.type };
  }
}
