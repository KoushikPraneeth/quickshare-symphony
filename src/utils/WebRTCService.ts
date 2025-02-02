import { WebSocketManager } from './webrtc/WebSocketManager';
import { PeerConnection } from './webrtc/PeerConnection';
import { WEBSOCKET_URLS } from './webrtc/WebRTCConfig';
import { toast } from 'sonner';

export class WebRTCService {
  private static instance: WebRTCService;
  private wsManager: WebSocketManager;
  private peerConnection: PeerConnection | null = null;
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
    
    let connected = false;
    let error = null;
    
    for (const wsUrl of WEBSOCKET_URLS) {
      try {
        console.log(`Attempting to connect to ${wsUrl}...`);
        await this.wsManager.connect(wsUrl);
        connected = true;
        console.log(`Successfully connected to ${wsUrl}`);
        break;
      } catch (err) {
        error = err;
        console.error(`Failed to connect to ${wsUrl}:`, err);
        continue;
      }
    }

    if (!connected) {
      console.error('All connection attempts failed');
      toast.error('Failed to establish connection');
      throw error || new Error('Failed to connect to any WebSocket server');
    }
    
    try {
      this.peerConnection = new PeerConnection(true);
      
      return new Promise((resolve, reject) => {
        if (!this.peerConnection) {
          reject(new Error('Peer not initialized'));
          return;
        }

        this.peerConnection.onSignal(async (data) => {
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

        this.peerConnection.setCallbacks({
          onData: (data) => {
            if (this.dataCallback) {
              this.dataCallback(data);
            }
          },
          onError: (err) => {
            console.error('Peer connection error:', err);
            reject(err);
          }
        });
      });
    } catch (error) {
      console.error('Failed to create connection:', error);
      toast.error('Failed to establish connection');
      throw error;
    }
  }

  async connect(connectionId: string): Promise<void> {
    await this.wsManager.connect(WEBSOCKET_URLS[0]);
    
    this.peerConnection = new PeerConnection(false);
    
    return new Promise((resolve, reject) => {
      if (!this.peerConnection) {
        reject(new Error('Peer not initialized'));
        return;
      }

      this.peerConnection.onSignal(async (data) => {
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

      this.peerConnection.setCallbacks({
        onConnect: () => resolve(),
        onData: (data) => {
          if (this.dataCallback) {
            this.dataCallback(data);
          }
        },
        onError: (err) => reject(err)
      });
    });
  }

  async sendData(data: any): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not established');
    }
    await this.peerConnection.sendData(data);
  }

  onData(callback: (data: any) => void) {
    this.dataCallback = callback;
  }
}