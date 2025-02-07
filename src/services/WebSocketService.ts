import { FileSplitter } from '@/utils/FileSplitter';
import { FileAssembler } from '@/utils/FileAssembler';
import SockJS from 'sockjs-client';

// Define a type that includes properties common to both WebSocket and SockJS
type WebSocketLike = {
  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void;
  close(): void;
  readyState: number;
  onopen: ((this: WebSocket, ev: Event) => any) | null;
  onclose: ((this: WebSocket, ev: CloseEvent) => any) | null;
  onerror: ((this: WebSocket, ev: Event) => any) | null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null;
  // Add event listener methods
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};

const enum ReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

interface TransferMetadata {
  fileName: string;
  mimeType: string;
  totalChunks: number;
  chunkIndex: number;
}

interface QueuedChunk {
  chunk: ArrayBuffer;
  metadata: TransferMetadata;
  retries: number;
}

export class WebSocketService {
  private static readonly MAX_RETRIES = 5;
  private static readonly MAX_QUEUE_SIZE = 100;
  private static readonly RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

  private ws: WebSocketLike | null = null;
  private fileSplitter: FileSplitter;
  private fileAssembler: FileAssembler;
  private readonly BASE_URL = 'http://localhost:8081';
  private readonly FRONTEND_URL = 'http://localhost:8080';
  
  private connectionId: string | null = null;
  private role: 'sender' | 'receiver' | null = null;
  private chunkQueue: QueuedChunk[] = [];
  private processingQueue: boolean = false;
  private reconnecting: boolean = false;
  private currentTransfer: { fileName: string; onProgress: (progress: number) => void } | null = null;

  constructor() {
    this.fileSplitter = new FileSplitter();
    this.fileAssembler = new FileAssembler();
  }

  private async waitForConnection(): Promise<void> {
    if (!this.ws || this.ws.readyState === ReadyState.CLOSED) {
      throw new Error('WebSocket is not initialized');
    }

    if (this.ws.readyState === ReadyState.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.onopen = null;
        }
        reject(new Error('Connection timeout'));
      }, 10000);

      if (this.ws) {
        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.ws!.onopen = null;
          resolve();
        };
      }
    });
  }

  async initializeTransfer(): Promise<string> {
    console.log('Initializing transfer...');
    const response = await fetch(`${this.BASE_URL}/api/transfer/init`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to initialize transfer');
    }
    
    const data = await response.json();
    this.connectionId = data.data.connectionId;
    console.log('Transfer initialized with ID:', this.connectionId);
    return this.connectionId;
  }

  private async reconnect(): Promise<void> {
    if (this.reconnecting || !this.connectionId || !this.role) {
      return;
    }

    this.reconnecting = true;
    console.log('Attempting to reconnect...');

    for (let attempt = 0; attempt < WebSocketService.MAX_RETRIES; attempt++) {
      try {
        await new Promise(r => setTimeout(r, WebSocketService.RETRY_DELAYS[attempt]));
        await this.connectWebSocket(this.connectionId!, this.role!);
        this.reconnecting = false;
        console.log('Reconnection successful');
        
        // Resume transfer if one was in progress
        if (this.chunkQueue.length > 0) {
          this.processChunkQueue();
        }
        return;
      } catch (error) {
        console.error(`Reconnection attempt ${attempt + 1} failed:`, error);
      }
    }

    this.reconnecting = false;
    throw new Error('Failed to reconnect after multiple attempts');
  }

  async connectWebSocket(connectionId: string, role: 'sender' | 'receiver'): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Connecting WebSocket as ${role}...`);
      
      const ws = new WebSocket(`ws://localhost:8081/transfer`);
      this.ws = ws as WebSocketLike;
      this.connectionId = connectionId;
      this.role = role;
      
      if (ws instanceof WebSocket) {
        ws.binaryType = 'arraybuffer';
      }

      const handleOpen = () => {
        console.log('WebSocket connection opened');
        const connectionMsg = JSON.stringify({ type: 'connection', id: connectionId, role });
        ws.send(connectionMsg);
        resolve();
      };

      const handleError = (error: Event) => {
        console.error('WebSocket error:', error);
        reject(new Error('WebSocket connection error'));
      };

      const handleClose = async (event: CloseEvent) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`);
        
        if (event.code === 1009) {
          // Buffer overflow error - reduce chunk size and retry
          console.log('Buffer overflow detected, reducing chunk size');
          this.fileSplitter.cancelTransfer(this.currentTransfer?.fileName || '');
          await this.reconnect();
        } else if (event.code !== 1000 && !this.reconnecting) {
          // Attempt reconnection for unexpected closures
          await this.reconnect();
        }
      };

      ws.onopen = handleOpen;
      ws.onerror = handleError;
      ws.onclose = handleClose;
    });
  }

  private async processChunkQueue(): Promise<void> {
    if (this.processingQueue || this.chunkQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.chunkQueue.length > 0) {
      const item = this.chunkQueue[0];

      try {
        await this.waitForConnection();
        await this.sendChunkWithMetadata(item.chunk, item.metadata);
        
        // Successfully sent, remove from queue
        this.chunkQueue.shift();
        
        if (this.currentTransfer) {
          this.currentTransfer.onProgress((item.metadata.chunkIndex + 1) / item.metadata.totalChunks * 100);
        }
      } catch (error) {
        console.error(`Error sending chunk ${item.metadata.chunkIndex}:`, error);
        
        item.retries++;
        if (item.retries >= WebSocketService.MAX_RETRIES) {
          console.error(`Failed to send chunk ${item.metadata.chunkIndex} after ${WebSocketService.MAX_RETRIES} attempts`);
          this.chunkQueue = []; // Clear queue on critical failure
          this.processingQueue = false;
          throw new Error('Failed to send file after multiple retries');
        }

        // Wait before retrying
        await new Promise(r => setTimeout(r, WebSocketService.RETRY_DELAYS[item.retries - 1]));
        continue;
      }
    }

    this.processingQueue = false;
  }

  private async sendChunkWithMetadata(chunk: ArrayBuffer, metadata: TransferMetadata): Promise<void> {
    if (!this.ws || this.ws.readyState !== ReadyState.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Send timeout'));
      }, 5000);

      try {
        // Send metadata first
        this.ws!.send(JSON.stringify(metadata));

        // Small delay between metadata and chunk
        setTimeout(() => {
          try {
            if (this.ws instanceof WebSocket) {
              this.ws.send(chunk);
            } else {
              // For SockJS, convert to base64
              const blob = new Blob([chunk]);
              const reader = new FileReader();
              reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                this.ws!.send(JSON.stringify({
                  type: 'binary',
                  data: base64
                }));
              };
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            }
            clearTimeout(timeout);
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        }, 10);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  async sendFile(file: File, onProgress: (progress: number) => void): Promise<void> {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }

    this.currentTransfer = { fileName: file.name, onProgress };

    try {
      console.log('Starting file transfer:', file.name);
      const chunks = await this.fileSplitter.splitFile(file);
      const totalChunks = chunks.length;

      // Clear existing queue if any
      this.chunkQueue = [];

      // Queue all chunks
      for (let i = 0; i < chunks.length; i++) {
        this.chunkQueue.push({
          chunk: chunks[i],
          metadata: {
            fileName: file.name,
            mimeType: file.type,
            totalChunks,
            chunkIndex: i,
          },
          retries: 0
        });

        // Wait if queue gets too large
        if (this.chunkQueue.length >= WebSocketService.MAX_QUEUE_SIZE) {
          await this.processChunkQueue();
        }
      }

      // Process any remaining chunks
      await this.processChunkQueue();
      
      console.log('File transfer completed:', file.name);
    } catch (error) {
      console.error('File transfer failed:', error);
      this.fileSplitter.cancelTransfer(file.name);
      throw error;
    } finally {
      this.currentTransfer = null;
    }
  }

  setupReceiver(
    onProgress: (progress: number) => void,
    onFileReceived: (blob: Blob, fileName: string) => void
  ): void {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }

    console.log('Setting up file receiver');
    let currentMetadata: TransferMetadata | null = null;

    this.ws.onmessage = async (event) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          
          if (data.type === 'binary') {
            if (!currentMetadata) {
              throw new Error('Received binary data without metadata');
            }
            
            const binaryData = this.base64ToBinary(data.data);
            await this.processReceivedChunk(binaryData, currentMetadata, onProgress, onFileReceived);
          } else if (data.fileName) {
            currentMetadata = data;
            console.log('Received metadata for chunk:', data.chunkIndex + 1);
          }
        } else {
          if (!currentMetadata) {
            throw new Error('Received binary chunk without metadata');
          }
          
          await this.processReceivedChunk(event.data, currentMetadata, onProgress, onFileReceived);
        }
      } catch (error) {
        console.error('Error processing received data:', error);
        this.fileAssembler.clearIncompleteFiles();
      }
    };
  }

  private async processReceivedChunk(
    chunk: ArrayBuffer,
    metadata: TransferMetadata,
    onProgress: (progress: number) => void,
    onFileReceived: (blob: Blob, fileName: string) => void
  ): Promise<void> {
    this.fileAssembler.addChunk(chunk, metadata);
    onProgress((metadata.chunkIndex + 1) / metadata.totalChunks * 100);

    if (this.fileAssembler.isFileComplete(metadata)) {
      try {
        const { blob, fileName } = this.fileAssembler.assembleFile(metadata);
        console.log('File assembled successfully:', fileName);
        onFileReceived(blob, fileName);
      } catch (error) {
        console.error('Error assembling file:', error);
        this.fileAssembler.clearIncompleteFiles();
        throw error;
      }
    }
  }

  private base64ToBinary(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  disconnect(): void {
    if (this.ws) {
      console.log('Disconnecting WebSocket');
      this.fileAssembler.clearIncompleteFiles();
      this.fileSplitter.cancelTransfer(this.currentTransfer?.fileName || '');
      this.ws.close();
      this.ws = null;
      this.connectionId = null;
      this.role = null;
      this.chunkQueue = [];
      this.processingQueue = false;
      this.currentTransfer = null;
    }
  }
}

export const webSocketService = new WebSocketService();
