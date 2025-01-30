export class WebSocketManager {
  private ws: WebSocket | null = null;
  private messageHandlers = new Map<string, (message: any) => void>();
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private readonly maxRetries = 5;
  private retryCount = 0;
  private readonly retryDelay = 2000;

  async connect(url: string): Promise<void> {
    if (this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    if (this.connectionPromise) {
      console.log('Connection already in progress, returning existing promise');
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        console.log('Connecting to WebSocket URL:', url);
        
        // Convert ws:// to wss:// if needed
        const secureUrl = url.replace('ws://', 'wss://');
        this.ws = new WebSocket(secureUrl);

        const timeout = setTimeout(() => {
          if (!this.isConnected) {
            console.log('Connection timeout');
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

        this.ws.onopen = () => {
          console.log('WebSocket connected successfully');
          this.isConnected = true;
          clearTimeout(timeout);
          this.retryCount = 0;
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
          if (!this.ws) return;
          this.ws.close();
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.isConnected = false;
          clearTimeout(timeout);
          this.handleReconnection(secureUrl, reject);
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  private async handleReconnection(url: string, reject: (reason?: any) => void) {
    if (this.retryCount >= this.maxRetries) {
      console.log('Max retry attempts reached');
      this.retryCount = 0;
      this.connectionPromise = null;
      reject(new Error('Max retry attempts reached'));
      return;
    }

    this.retryCount++;
    const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
    console.log(`Retrying connection (${this.retryCount}/${this.maxRetries}) in ${delay}ms...`);

    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.connect(url);
    } catch (error) {
      console.error('Reconnection attempt failed:', error);
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