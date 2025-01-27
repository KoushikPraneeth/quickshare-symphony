import { WebSocketManager } from './webrtc/WebSocketManager';
import { DataChannelManager } from './webrtc/DataChannelManager';
import { PeerConnectionManager } from './webrtc/PeerConnectionManager';
import { toast } from '@/components/ui/use-toast';

class WebRTCService {
  private static instance: WebRTCService;
  private webSocketManager: WebSocketManager;
  private dataChannelManager: DataChannelManager;
  private peerConnections: Map<string, PeerConnectionManager> = new Map();
  private messageCallbacks: Map<string, (data: ArrayBuffer) => void> = new Map();
  
  private readonly configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  private constructor() {
    this.webSocketManager = new WebSocketManager();
    this.dataChannelManager = new DataChannelManager();
    this.connectToSignalingServer();
  }

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  private async connectToSignalingServer() {
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.hostname}:8080`;
      await this.webSocketManager.connect(wsUrl);
      this.setupSignalingHandlers();
    } catch (error) {
      console.error('Failed to connect to signaling server:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to server. Please try again later.",
        variant: "destructive",
      });
    }
  }

  private setupSignalingHandlers() {
    this.webSocketManager.addMessageHandler('offer', async (message) => {
      try {
        const peerConnection = new PeerConnectionManager(this.configuration);
        this.peerConnections.set(message.code, peerConnection);
        
        peerConnection.onDataChannel((event) => {
          this.dataChannelManager.setupDataChannel(event.channel, (data) => {
            const callback = this.messageCallbacks.get(message.code);
            if (callback) callback(data);
          });
        });

        const answer = await peerConnection.createAnswer(message.data);
        this.webSocketManager.send({ type: 'answer', code: message.code, data: answer });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    this.webSocketManager.addMessageHandler('answer', async (message) => {
      try {
        const peerConnection = this.peerConnections.get(message.code);
        if (peerConnection) {
          await peerConnection.handleAnswer(message.data);
        }
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    this.webSocketManager.addMessageHandler('ice-candidate', async (message) => {
      try {
        const peerConnection = this.peerConnections.get(message.code);
        if (peerConnection) {
          await peerConnection.addIceCandidate(message.data);
        }
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
      }
    });
  }

  async createConnection(code: string): Promise<void> {
    try {
      const peerConnection = new PeerConnectionManager(this.configuration);
      this.peerConnections.set(code, peerConnection);

      const dataChannel = peerConnection.createDataChannel('fileTransfer');
      this.dataChannelManager.setupDataChannel(dataChannel, (data) => {
        const callback = this.messageCallbacks.get(code);
        if (callback) callback(data);
      });

      peerConnection.onIceCandidate((candidate) => {
        if (candidate) {
          this.webSocketManager.send({ type: 'ice-candidate', code, data: candidate });
        }
      });

      const offer = await peerConnection.createOffer();
      this.webSocketManager.send({ type: 'offer', code, data: offer });
    } catch (error) {
      console.error('Error creating connection:', error);
      throw error;
    }
  }

  async sendData(code: string, data: ArrayBuffer): Promise<void> {
    try {
      await this.dataChannelManager.sendData(data);
    } catch (error) {
      console.error('Error sending data:', error);
      throw error;
    }
  }

  registerMessageCallback(code: string, callback: (data: ArrayBuffer) => void) {
    this.messageCallbacks.set(code, callback);
  }

  unregisterMessageCallback(code: string) {
    this.messageCallbacks.delete(code);
  }

  closeConnection(code: string) {
    const peerConnection = this.peerConnections.get(code);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(code);
    }
    this.dataChannelManager.close();
  }
}

export default WebRTCService;