import { WebSocketManager } from './webrtc/WebSocketManager';
import { DataChannelManager } from './webrtc/DataChannelManager';
import { PeerConnectionManager } from './webrtc/PeerConnectionManager';
import { toast } from '@/hooks/use-toast';

class WebRTCService {
  private static instance: WebRTCService;
  private webSocketManager: WebSocketManager;
  private dataChannelManager: DataChannelManager;
  private peerConnections: Map<string, PeerConnectionManager> = new Map();
  private messageCallbacks: Map<string, (data: ArrayBuffer) => void> = new Map();
  private isConnected: boolean = false;
  
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
      const host = window.location.hostname;
      const port = '3001';
      const wsUrl = `ws://${host}:${port}`;
      console.log('Connecting to signaling server at:', wsUrl);
      
      await this.webSocketManager.connect(wsUrl);
      this.isConnected = true;
      this.setupSignalingHandlers();
      
      console.log('Successfully connected to signaling server');
    } catch (error) {
      console.error('Failed to connect to signaling server:', error);
      this.isConnected = false;
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
        await this.webSocketManager.send({ type: 'answer', code: message.code, data: answer });
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
    if (!this.isConnected) {
      console.log('Waiting for WebSocket connection...');
      await this.webSocketManager.waitForConnection();
    }

    try {
      console.log('Creating new connection with code:', code);
      const peerConnection = new PeerConnectionManager(this.configuration);
      this.peerConnections.set(code, peerConnection);

      const dataChannel = peerConnection.createDataChannel('fileTransfer');
      this.dataChannelManager.setupDataChannel(dataChannel, (data) => {
        const callback = this.messageCallbacks.get(code);
        if (callback) callback(data);
      });

      peerConnection.onIceCandidate((candidate) => {
        if (candidate && this.isConnected) {
          this.webSocketManager.send({ 
            type: 'ice-candidate', 
            code, 
            data: candidate 
          }).catch(error => {
            console.error('Error sending ICE candidate:', error);
          });
        }
      });

      const offer = await peerConnection.createOffer();
      await this.webSocketManager.send({ type: 'offer', code, data: offer });
      console.log('Connection created successfully');
    } catch (error) {
      console.error('Error creating connection:', error);
      throw error;
    }
  }

  async joinConnection(code: string): Promise<void> {
    console.log('Joining connection with code:', code);
    try {
      const peerConnection = new PeerConnectionManager(this.configuration);
      this.peerConnections.set(code, peerConnection);

      peerConnection.onIceCandidate((candidate) => {
        if (candidate) {
          console.log('Sending ICE candidate to peer');
          this.webSocketManager.send({ type: 'ice-candidate', code, data: candidate });
        }
      });

      // Wait for data channel from peer
      peerConnection.onDataChannel((event) => {
        console.log('Received data channel from peer');
        this.dataChannelManager.setupDataChannel(event.channel, (data) => {
          const callback = this.messageCallbacks.get(code);
          if (callback) callback(data);
        });
      });

      // Signal ready to receive offer
      this.webSocketManager.send({ type: 'join', code });
      console.log('Sent join signal to server');
    } catch (error) {
      console.error('Error joining connection:', error);
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