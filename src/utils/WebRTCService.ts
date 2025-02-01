import SimplePeer from 'simple-peer';
import { WebSocketManager } from './webrtc/WebSocketManager';

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
    const wsUrl = process.env.NODE_ENV === 'production'
      ? 'wss://signaling.lovable.dev'
      : 'ws://localhost:3001';
      
    await this.wsManager.connect(wsUrl);
    
    this.peer = new SimplePeer({ initiator: true, trickle: false });
    
    return new Promise((resolve, reject) => {
      this.peer!.on('signal', async (data) => {
        try {
          await this.wsManager.send({
            type: 'offer',
            offer: data
          });
          resolve(data.id);
        } catch (error) {
          reject(error);
        }
      });

      this.peer!.on('connect', () => {
        console.log('Peer connection established');
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