import { FileSplitter } from '@/utils/FileSplitter';
import { FileAssembler } from '@/utils/FileAssembler';
import SockJS from 'sockjs-client';

// Define a type that includes properties common to both WebSocket and SockJS
type WebSocketLike = {
  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void;
  close(): void;
  onopen: ((this: WebSocket, ev: Event) => any) | null;
  onclose: ((this: WebSocket, ev: CloseEvent) => any) | null;
  onerror: ((this: WebSocket, ev: Event) => any) | null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null;
};

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
    const response = await fetch(`${this.BASE_URL}/api/transfer/init`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to initialize transfer');
    }
    
    const data = await response.json();
    return data.data.connectionId;
  }

  async connectWebSocket(connectionId: string, role: 'sender' | 'receiver'): Promise<void> {
    return new Promise((resolve, reject) => {
      // SockJS doesn't support query parameters in the URL, so we'll handle connection details differently
      this.ws = new SockJS(`${this.BASE_URL}/transfer`);
      
      // Set binary type to arraybuffer if it's a native WebSocket
      if (this.ws instanceof WebSocket) {
        this.ws.binaryType = 'arraybuffer';
      }
      
      this.ws.onopen = () => {
        // Send connection details immediately after connection is established
        this.ws?.send(JSON.stringify({ type: 'connection', id: connectionId, role }));
        console.log(`SockJS connected, sending connection details as ${role}`);
        resolve();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
      };
    });
  }

  async establishConnection(senderId: string, receiverId: string): Promise<void> {
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
  }

  async sendFile(file: File, onProgress: (progress: number) => void): Promise<void> {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }

    const chunks = await this.fileSplitter.splitFile(file);
    const totalChunks = chunks.length;

    for (let i = 0; i < chunks.length; i++) {
      const metadata: TransferMetadata = {
        fileName: file.name,
        mimeType: file.type,
        totalChunks,
        chunkIndex: i,
      };

      // Send metadata as a properly formatted JSON string
      const metadataJson = {
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        totalChunks: metadata.totalChunks,
        chunkIndex: metadata.chunkIndex
      };
      this.ws.send(JSON.stringify(metadataJson));

      // Send binary chunk
      // Convert binary data to base64 for SockJS compatibility if needed
      if (!(this.ws instanceof WebSocket)) {
        // For SockJS, send binary data as base64 string
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          this.ws?.send(JSON.stringify({
            type: 'binary',
            data: base64String
          }));
        };
        reader.readAsDataURL(new Blob([chunks[i]]));
      } else {
        // For native WebSocket, send binary data directly
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

    let metadata: TransferMetadata | null = null;

      this.ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const data = JSON.parse(event.data);
        if (data.type === 'binary') {
          // Convert base64 back to binary data
          const binaryData = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
          if (!metadata) {
            throw new Error('Received chunk without metadata');
          }
          this.fileAssembler.addChunk(binaryData.buffer, metadata);
        } else {
          // Regular metadata message
          metadata = data;
        }
      } else {
        // Direct binary data from native WebSocket
        if (!metadata) {
          throw new Error('Received chunk without metadata');
        }
        this.fileAssembler.addChunk(event.data, metadata);
        onProgress((metadata.chunkIndex + 1) / metadata.totalChunks * 100);

        if (metadata.chunkIndex === metadata.totalChunks - 1) {
          // All chunks received, assemble the file
          const { blob, fileName } = this.fileAssembler.assembleFile();
          onFileReceived(blob, fileName);
        }
      }
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const webSocketService = new WebSocketService();
