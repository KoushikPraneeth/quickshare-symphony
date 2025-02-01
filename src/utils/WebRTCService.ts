import SimplePeer from 'simple-peer';
import { WebSocketManager } from './webrtc/WebSocketManager';
import { toast } from 'sonner';

export class WebRTCService {
  private static instance: WebRTCService;
  private peer: SimplePeer.Instance | null = null;
  private wsManager: WebSocketManager;
  private dataCallback: ((data: any) => void) | null = null;

  private constructor() {
    this.wsManager = new WebSocketManager();
  }

  static async getInstance(): Promise<WebRTCService> {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  async createConnection(): Promise<string> {
    console.log('Creating new WebRTC connection...');
    
    const wsUrl = process.env.NODE_ENV === 'production'
      ? 'wss://signaling.lovable.dev'
      : 'ws://localhost:3001';
    
    try {
      await this.wsManager.connect(wsUrl);
      console.log('WebSocket connected successfully');
      
      this.peer = new SimplePeer({ initiator: true, trickle: false });
      
      return new Promise((resolve, reject) => {
        if (!this.peer) {
          reject(new Error('Peer not initialized'));
          return;
        }

        this.peer.on('signal', async (data) => {
          try {
            console.log('Generated signal data:', data);
            await this.wsManager.send({
              type: 'offer',
              offer: data
            });
            resolve(data.id);
          } catch (error) {
            console.error('Error sending signal:', error);
            reject(error);
          }
        });

        this.peer.on('connect', () => {
          console.log('Peer connection established');
          toast.success('Connected to peer');
        });

        this.peer.on('data', (data) => {
          if (this.dataCallback) {
            this.dataCallback(JSON.parse(data.toString()));
          }
        });

        this.peer.on('error', (err) => {
          console.error('Peer connection error:', err);
          toast.error('Connection error occurred');
          reject(err);
        });
      });
    } catch (error) {
      console.error('Failed to create connection:', error);
      toast.error('Failed to establish connection');
      throw error;
    }
  }

  async connect(connectionId: string): Promise<void> {
    const wsUrl = process.env.NODE_ENV === 'production'
      ? 'wss://signaling.lovable.dev'
      : 'ws://localhost:3001';
      
    await this.wsManager.connect(wsUrl);
    
    this.peer = new SimplePeer({ initiator: false, trickle: false });
    
    return new Promise((resolve, reject) => {
      this.peer!.on('signal', async (data) => {
        try {
          await this.wsManager.send({
            type: 'answer',
            answer: data,
            targetId: connectionId
          });
        } catch (error) {
          reject(error);
        }
      });

      this.peer!.on('connect', () => {
        console.log('Peer connection established');
        resolve();
      });

      this.peer!.on('data', (data) => {
        if (this.dataCallback) {
          this.dataCallback(JSON.parse(data.toString()));
        }
      });

      this.peer!.on('error', (err) => {
        console.error('Peer connection error:', err);
        reject(err);
      });
    });
  }

  async sendData(data: any): Promise<void> {
    if (!this.peer) {
      throw new Error('Peer connection not established');
    }
    this.peer.send(JSON.stringify(data));
  }

  onData(callback: (data: any) => void) {
    this.dataCallback = callback;
  }
}
