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
      // For testing, we're using native WebSocket directly
      this.ws = new WebSocket(`ws://localhost:8081/transfer`);
      console.log('Using native WebSocket');
      (this.ws as WebSocket).binaryType = 'arraybuffer';
      
      this.ws.onopen = () => {
        console.log('WebSocket connection opened');
        // Send connection details immediately after connection is established
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
        
        if (event.code !== 1000) {
          // 1000 is normal closure
          // Only reject if the promise hasn't been resolved yet (connection not established)
          if (this.ws?.readyState !== ReadyState.OPEN) {
            reject(new Error(`Connection closed abnormally: ${event.code} ${event.reason}`));
          }
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

    for (let i = 0; i < chunks.length; i++) {
      const metadata: TransferMetadata = {
        fileName: file.name,
        mimeType: file.type,
        totalChunks,
        chunkIndex: i,
      };

      // Send metadata as JSON
      console.log(`Sending metadata for chunk ${i + 1}/${totalChunks}`);
      
      // Send metadata and wait for processing
      await new Promise<void>(resolve => {
        this.ws!.send(JSON.stringify(metadata));
        // Small delay to ensure metadata is processed
        setTimeout(resolve, 50);
      });

      // Send binary chunk
      if (!(this.ws instanceof WebSocket)) {
        console.log('Using SockJS - converting binary to base64');
        // For SockJS, send binary data as base64 string
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          console.log(`Sending chunk ${i + 1} as base64`);
          this.ws?.send(JSON.stringify({
            type: 'binary',
            data: base64String
          }));
        };
        reader.readAsDataURL(new Blob([chunks[i]]));
      } else {
        console.log(`Sending chunk ${i + 1} as binary`);
        this.ws.send(chunks[i]);
      }

      onProgress((i + 1) / totalChunks * 100);
    }
  }

  setupReceiver(
    onProgress: (progress: number) => void,
    onFileReceived: (blob: Blob, fileName: string) => void
  ): void {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }

    if (this.ws.readyState !== ReadyState.OPEN) {
      throw new Error('WebSocket is not open. ReadyState: ' + this.ws.readyState);
    }

    console.log('Setting up file receiver');
    let metadata: TransferMetadata | null = null;

    this.ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const data = JSON.parse(event.data);
        if (data.type === 'binary') {
          console.log('Received binary data as base64');
          const binaryData = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
          if (!metadata) {
            throw new Error('Received chunk without metadata');
          }
          console.log(`Processing binary chunk ${metadata.chunkIndex + 1}/${metadata.totalChunks}`);
          this.fileAssembler.addChunk(binaryData.buffer, metadata);
          onProgress((metadata.chunkIndex + 1) / metadata.totalChunks * 100);
        } else {
          console.log('Received metadata:', data);
          metadata = data;
        }
      } else {
        if (!metadata) {
          throw new Error('Received chunk without metadata');
        }
        console.log(`Received binary chunk ${metadata.chunkIndex + 1}/${metadata.totalChunks}`);
        this.fileAssembler.addChunk(event.data, metadata);
        onProgress((metadata.chunkIndex + 1) / metadata.totalChunks * 100);
      }

      if (metadata && metadata.chunkIndex === metadata.totalChunks - 1) {
        console.log('All chunks received, assembling file');
        const { blob, fileName } = this.fileAssembler.assembleFile();
        console.log('File assembled:', fileName);
        onFileReceived(blob, fileName);
      }
    };
  }

  disconnect(): void {
    if (this.ws) {
      console.log('Disconnecting WebSocket');
      this.ws.close();
      this.ws = null;
    }
  }
}

export const webSocketService = new WebSocketService();
