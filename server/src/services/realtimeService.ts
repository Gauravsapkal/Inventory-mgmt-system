import { Response } from 'express';

export type RealtimeEventType = 
  | 'stock_updated' 
  | 'sale_created' 
  | 'product_created' 
  | 'product_updated' 
  | 'product_deleted' 
  | 'purchase_created'
  | 'purchase_updated'
  | 'heartbeat';

interface SSEClient {
  id: string;
  res: Response;
  userId?: string;
}

class RealtimeService {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Send heartbeat every 25 seconds to keep connection alive on cloud proxies (Render/Cloudflare)
    this.heartbeatInterval = setInterval(() => {
      this.broadcast('heartbeat', { timestamp: new Date().toISOString() });
    }, 25000);
  }

  public registerClient(id: string, res: Response, userId?: string): void {
    this.clients.set(id, { id, res, userId });
    console.log(`📡 SSE client registered [${id}]. Total active clients: ${this.clients.size}`);

    // Send initial handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id, timestamp: new Date().toISOString() })}\n\n`);

    res.on('close', () => {
      this.clients.delete(id);
      console.log(`🔌 SSE client disconnected [${id}]. Remaining clients: ${this.clients.size}`);
    });
  }

  public broadcast(event: RealtimeEventType, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(payload);
      } catch (err) {
        console.warn(`Failed to push SSE event to client ${id}`);
        this.clients.delete(id);
      }
    }
  }

  public getActiveClientCount(): number {
    return this.clients.size;
  }
}

export const realtimeService = new RealtimeService();
