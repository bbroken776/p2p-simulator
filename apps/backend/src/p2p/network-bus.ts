import { EventEmitter } from 'events';
import { P2PMessage } from '@p2p-simulator/shared';

export class NetworkBus extends EventEmitter {
  private queue: P2PMessage[] = [];

  public send(msg: P2PMessage): void {
    
    const delay = 10 + Math.random() * 70;
    setTimeout(() => {
      this.queue.push(msg);
      
      if (this.queue.length > 500) this.queue.shift();
      this.emit('message', msg);
    }, delay);
  }

  public onMessage(handler: (msg: P2PMessage) => void): void {
    this.on('message', handler);
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public flush(): void {
    this.queue = [];
  }
}
