export class WebSocketManager {
  private ws: WebSocket | null = null;
  private messageHandlers = new Map<string, (message: any) => void>();
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private readonly maxRetries = 3;
  private retryCount = 0;
  private readonly retryDelay = 2000;

  async connect(url: string): Promise<void> {
    if (this.connectionPromise) {
      console.log('Connection already in progress, returning existing promise');
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      console.log('Connecting to WebSocket URL:', url);
      
      this.ws = new WebSocket(url);
      
      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          console.log('Connection timeout');
          this.ws?.close();
          reject(new Error('Connection timeout'));
        }
      }, 5000);

      this.ws.onopen = () => {
        console.log('WebSocket connection established');
        this.isConnected = true;
        clearTimeout(timeout);
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
        clearTimeout(timeout);
        this.handleConnectionError(url, reject);
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.isConnected = false;
        this.handleConnectionError(url, reject);
      };
    });

    return this.connectionPromise;
  }

  private async handleConnectionError(url: string, reject: (reason?: any) => void) {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`Retrying connection (${this.retryCount}/${this.maxRetries})...`);
      
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      
      try {
        await this.connect(url);
      } catch (error) {
        reject(error);
      }
    } else {
      this.retryCount = 0;
      reject(new Error('Max retry attempts reached'));
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
    this.retryCount = 0;
    this.connectionPromise = null;
    this.messageHandlers.clear();
  }

  isWebSocketConnected(): boolean {
    return this.isConnected;
  }
}