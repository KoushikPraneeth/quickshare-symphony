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
};

// WebSocket states
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

export class WebSocketService {
  private ws: WebSocketLike | null = null;
  private fileSplitter: FileSplitter;
  private fileAssembler: FileAssembler;
  private readonly BASE_URL = 'http://localhost:8081';
  private readonly FRONTEND_URL = 'http://localhost:8080';
  private readonly CHUNK_SEND_INTERVAL = 10; // ms between chunks to prevent overload
  
  constructor() {
    this.fileSplitter = new FileSplitter();
    this.fileAssembler = new FileAssembler();
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
    console.log('Transfer initialized with ID:', data.data.connectionId);
    return data.data.connectionId;
  }

  async connectWebSocket(connectionId: string, role: 'sender' | 'receiver'): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Connecting WebSocket as ${role}...`);
      this.ws = new WebSocket(`ws://localhost:8081/transfer`);
      console.log('Using native WebSocket');
      (this.ws as WebSocket).binaryType = 'arraybuffer';
      
      this.ws.onopen = () => {
        console.log('WebSocket connection opened');
        const connectionMsg = JSON.stringify({ type: 'connection', id: connectionId, role });
        console.log('Sending connection details:', connectionMsg);
        this.ws?.send(connectionMsg);
        resolve();
      };
      
      this.ws.onerror = (error) => {
        const errorMessage = 'WebSocket connection error';
        console.error(errorMessage, error);
        reject(new Error(errorMessage));
      };
      
      this.ws.onclose = (event) => {
        const message = `WebSocket connection closed: ${event.code} ${event.reason}`;
        console.log(message);
        
        if (event.code !== 1000 && this.ws?.readyState !== ReadyState.OPEN) {
          reject(new Error(`Connection closed abnormally: ${event.code} ${event.reason}`));
        }
      };
    });
  }

  async establishConnection(senderId: string, receiverId: string): Promise<void> {
    console.log('Establishing connection between:', { senderId, receiverId });
    const response = await fetch(`${this.BASE_URL}/api/transfer/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `senderId=${senderId}&receiverId=${receiverId}`,
    });

    if (!response.ok) {
      throw new Error('Failed to establish connection');
    }
    console.log('Connection established successfully');
  }

  private async sendChunkWithMetadata(
    chunk: ArrayBuffer,
    metadata: TransferMetadata,
    isWebSocket: boolean
  ): Promise<void> {
    // First send metadata
    this.ws!.send(JSON.stringify(metadata));

    // Then send the chunk data
    if (!isWebSocket) {
      // For SockJS, convert binary to base64
      const blob = new Blob([chunk]);
      const base64 = await this.blobToBase64(blob);
      this.ws!.send(JSON.stringify({
        type: 'binary',
        data: base64.split(',')[1]
      }));
    } else {
      // For WebSocket, send binary directly
      this.ws!.send(chunk);
    }

    // Add a small delay between chunks to prevent overwhelming the connection
    await new Promise(resolve => setTimeout(resolve, this.CHUNK_SEND_INTERVAL));
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
      reader.readAsDataURL(blob);
    });
  }

  async sendFile(file: File, onProgress: (progress: number) => void): Promise<void> {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }

    if (this.ws.readyState !== ReadyState.OPEN) {
      throw new Error('WebSocket is not open. ReadyState: ' + this.ws.readyState);
    }

    console.log('Starting file transfer:', file.name);
    const chunks = await this.fileSplitter.splitFile(file);
    const totalChunks = chunks.length;
    console.log('File split into', totalChunks, 'chunks');

    const isWebSocket = this.ws instanceof WebSocket;
    for (let i = 0; i < chunks.length; i++) {
      const metadata: TransferMetadata = {
        fileName: file.name,
        mimeType: file.type,
        totalChunks,
        chunkIndex: i,
      };

      try {
        await this.sendChunkWithMetadata(chunks[i], metadata, isWebSocket);
        onProgress((i + 1) / totalChunks * 100);
      } catch (error) {
        console.error(`Error sending chunk ${i}:`, error);
        throw new Error(`Failed to send chunk ${i}: ${error.message}`);
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

  setupReceiver(
    onProgress: (progress: number) => void,
    onFileReceived: (blob: Blob, fileName: string) => void
  ): void {
    if (!this.ws || this.ws.readyState !== ReadyState.OPEN) {
      throw new Error('WebSocket is not connected or not open');
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
            await this.processChunk(binaryData, currentMetadata, onProgress, onFileReceived);
          } else if (data.fileName) {
            // This is metadata
            currentMetadata = data;
            console.log('Received metadata for chunk:', data.chunkIndex + 1);
          }
        } else {
          // Binary data received directly
          if (!currentMetadata) {
            throw new Error('Received binary chunk without metadata');
          }
          
          await this.processChunk(event.data, currentMetadata, onProgress, onFileReceived);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        this.fileAssembler.clearIncompleteFiles();
      }
    };
  }

  private async processChunk(
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

  disconnect(): void {
    if (this.ws) {
      console.log('Disconnecting WebSocket');
      this.fileAssembler.clearIncompleteFiles();
      this.ws.close();
      this.ws = null;
    }
  }
}

export const webSocketService = new WebSocketService();
