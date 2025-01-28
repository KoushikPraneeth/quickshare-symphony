import { toast } from '@/hooks/use-toast';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private messageHandlers: Map<string, (message: any) => void> = new Map();
  private connectionPromise: Promise<void> | null = null;
  private isConnecting = false;
  private currentUrl: string = '';
  private connectionTimeout = 10000; // 10 seconds

  async connect(url: string): Promise<void> {
    console.log('Attempting to connect to signaling server...');
    
    if (this.isConnecting) {
      console.log('Connection already in progress, returning existing promise');
      return this.connectionPromise!;
    }

    this.currentUrl = url;
    this.isConnecting = true;
    this.connectionPromise = new Promise<void>((resolve, reject) => {
      try {
        console.log('Connecting to WebSocket URL:', url);
        this.ws = new WebSocket(url);
        
        const timeoutId = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, this.connectionTimeout);

        this.ws.onopen = () => {
          console.log('Connected to signaling server successfully');
          clearTimeout(timeoutId);
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'connection-success') {
              console.log('Received connection success confirmation');
            } else {
              const handler = this.messageHandlers.get(message.type);
              if (handler) {
                handler(message);
              }
            }
          } catch (error) {
            console.error('Error processing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          clearTimeout(timeoutId);
          this.handleConnectionError();
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          clearTimeout(timeoutId);
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

  private handleConnectionError(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${backoffTime}ms...`);
      
      setTimeout(() => {
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        this.connect(this.currentUrl).catch(error => {
          console.error('Reconnection attempt failed:', error);
        });
      }, backoffTime);
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
    const startTime = Date.now();
    
    while ((!this.ws || this.ws.readyState !== WebSocket.OPEN) && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Connection timeout');
    }
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
    this.messageHandlers.clear();
  }
}