import { RETRY_CONFIG } from './WebRTCConfig';
import { toast } from 'sonner';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private messageHandlers = new Map<string, (message: any) => void>();
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private retryCount = 0;
  private clientId: string | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  async connect(url: string): Promise<void> {
    console.log(`Attempting to connect to WebSocket at ${url}`);
    
    if (this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    if (this.connectionPromise) {
      console.log('Connection in progress, returning existing promise');
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        const connectionTimeout = setTimeout(() => {
          if (!this.isConnected) {
            console.log('Connection timeout');
            if (this.ws) {
              this.ws.close();
            }
            reject(new Error('Connection timeout'));
          }
        }, RETRY_CONFIG.connectionTimeout);

        this.ws.onopen = () => {
          console.log('WebSocket connected successfully');
          this.isConnected = true;
          clearTimeout(connectionTimeout);
          this.retryCount = 0;
          toast.success('Connected to signaling server');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('Received WebSocket message:', message);
            
            if (message.type === 'connection') {
              this.clientId = message.clientId;
              console.log('Received client ID:', this.clientId);
            }
            
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
          clearTimeout(connectionTimeout);
          this.handleError(error, reject);
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          clearTimeout(connectionTimeout);
          this.handleClose(url, reject);
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  private handleError(error: Event, reject: (reason?: any) => void) {
    this.isConnected = false;
    if (this.ws) {
      this.ws.close();
    }
    reject(error);
  }

  private async handleClose(url: string, reject: (reason?: any) => void) {
    this.isConnected = false;
    this.clientId = null;
    
    if (this.retryCount >= RETRY_CONFIG.maxRetries) {
      console.log('Max retry attempts reached');
      this.retryCount = 0;
      this.connectionPromise = null;
      reject(new Error('Max retry attempts reached'));
      return;
    }

    this.retryCount++;
    const delay = RETRY_CONFIG.retryDelay * Math.pow(2, this.retryCount - 1);
    console.log(`Retrying connection (${this.retryCount}/${RETRY_CONFIG.maxRetries}) in ${delay}ms...`);

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect(url);
      } catch (error) {
        console.error('Reconnection attempt failed:', error);
        reject(error);
      }
    }, delay);
  }

  addMessageHandler(type: string, handler: (message: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  async send(message: any): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket is not connected');
    }
    
    const messageWithId = {
      ...message,
      clientId: this.clientId
    };
    
    this.ws.send(JSON.stringify(messageWithId));
  }

  close(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.retryCount = 0;
    this.connectionPromise = null;
    this.messageHandlers.clear();
    this.clientId = null;
  }

  isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  getClientId(): string | null {
    return this.clientId;
  }
}