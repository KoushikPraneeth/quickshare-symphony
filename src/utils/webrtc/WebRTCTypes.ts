export interface WebRTCMessage {
  type: 'chunk' | 'connection' | 'offer' | 'answer';
  data?: ArrayBuffer;
  metadata?: {
    fileName: string;
    chunkIndex: number;
    totalChunks: number;
    mimeType: string;
  };
  clientId?: string;
  offer?: any;
  answer?: any;
  targetId?: string;
}

export interface WebRTCCallbacks {
  onData?: (data: any) => void;
  onConnect?: () => void;
  onError?: (error: Error) => void;
}