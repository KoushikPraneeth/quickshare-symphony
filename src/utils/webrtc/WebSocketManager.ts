import { toast } from '@/hooks/use-toast';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private messageHandlers: Map<string, (message: any) => void> = new Map();
  private connectionPromise: Promise<void> | null = null;
  private isConnecting = false;

  connect(url: string): Promise<void> {
    console.log('Attempting to connect to signaling server...');
    
    if (this.isConnecting) {
      console.log('Connection already in progress, returning existing promise');
      return this.connectionPromise!;
    }

    this.isConnecting = true;
    this.connectionPromise = new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          console.log('Connected to signaling server successfully');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
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
          this.handleConnectionError();
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.handleConnectionError();
          this.isConnecting = false;
          reject(new Error('WebSocket connection closed'));
        };

      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        this.handleConnectionError();
        this.isConnecting = false;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  private handleConnectionError() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.hostname}:8080`;
        this.connect(wsUrl).catch(error => {
          console.error('Reconnection attempt failed:', error);
        });
      }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000)); // Exponential backoff with max 10s
    } else {
      console.error('Max reconnection attempts reached');
      toast({
        title: "Connection Error",
        description: "Unable to connect to server. Please try again later.",
        variant: "destructive",
      });
    }
  }

  async waitForConnection(timeout = 10000): Promise<void> {
    if (!this.connectionPromise) {
      throw new Error('Connection not initiated');
    }

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), timeout);
    });

    return Promise.race([this.connectionPromise, timeoutPromise]);
  }

  async send(message: any): Promise<void> {
    try {
      await this.waitForConnection();
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not connected');
      }
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  addMessageHandler(type: string, handler: (message: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnecting = false;
    this.connectionPromise = null;
    this.reconnectAttempts = 0;
  }
}