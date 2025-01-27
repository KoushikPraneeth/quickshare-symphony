import { toast } from '@/components/ui/use-toast';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private messageHandlers: Map<string, (message: any) => void> = new Map();

  connect(url: string): Promise<void> {
    console.log('Attempting to connect to signaling server...');
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          console.log('Connected to signaling server successfully');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          const handler = this.messageHandlers.get(message.type);
          if (handler) {
            handler(message);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.handleConnectionError();
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.handleConnectionError();
          reject(new Error('WebSocket connection closed'));
        };

      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        this.handleConnectionError();
        reject(error);
      }
    });
  }

  private handleConnectionError() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.hostname}:8080`;
        this.connect(wsUrl);
      }, 2000 * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      toast({
        title: "Connection Error",
        description: "Unable to connect to server. Please try again later.",
        variant: "destructive",
      });
    }
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket is not connected');
    }
  }

  addMessageHandler(type: string, handler: (message: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}