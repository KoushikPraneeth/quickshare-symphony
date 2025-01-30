import { toast } from '@/hooks/use-toast';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private messageHandlers = new Map<string, (message: any) => void>();
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly connectionTimeout = 10000; // 10 seconds

  async connect(url: string): Promise<void> {
    if (this.isConnected) {
      return;
    }

    console.log('Connecting to WebSocket server:', url);
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        
        const timeoutId = setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, this.connectionTimeout);

        this.ws.onopen = () => {
          console.log('WebSocket connection established');
          this.isConnected = true;
          clearTimeout(timeoutId);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
              handler(message);
            }
          } catch (error) {
            console.error('Error processing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnected = false;
          clearTimeout(timeoutId);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.isConnected = false;
          this.handleReconnect();
        };

      } catch (error) {
        console.error('Error creating WebSocket:', error);
        reject(error);
      }
    });
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${backoffTime}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      
      try {
        await this.connect(this.ws?.url || '');
        this.reconnectAttempts = 0;
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    } else {
      console.error('Max reconnection attempts reached');
      toast({
        title: "Connection Error",
        description: "Unable to maintain connection to server. Please try again later.",
        variant: "destructive",
      });
    }
  }

  addMessageHandler(type: string, handler: (message: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  async send(message: any): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.messageHandlers.clear();
  }
}