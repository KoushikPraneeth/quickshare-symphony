interface PeerConnection {
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  isReady?: boolean;
}

class WebRTCService {
  private static instance: WebRTCService;
  private connections: Map<string, PeerConnection> = new Map();
  private ws: WebSocket | null = null;
  private messageCallbacks: Map<string, (data: ArrayBuffer) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  private configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  private constructor() {
    this.connectToSignalingServer();
  }

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  private connectToSignalingServer() {
    console.log('Attempting to connect to signaling server...');
    
    try {
      // Use secure WebSocket in production
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.hostname}:8080`;
      console.log('Connecting to WebSocket server at:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('Connected to signaling server successfully');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, code, data } = message;
          console.log('Received signaling message:', type, 'for code:', code);

          switch (type) {
            case 'offer':
              await this.handleOffer(code, data);
              break;
            case 'answer':
              await this.handleAnswer(code, data);
              break;
            case 'ice-candidate':
              await this.handleIceCandidate(code, data);
              break;
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.handleConnectionError();
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.handleConnectionError();
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.handleConnectionError();
    }
  }

  private handleConnectionError() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connectToSignalingServer();
      }, 2000 * this.reconnectAttempts); // Exponential backoff
    } else {
      console.error('Max reconnection attempts reached. Please check if the signaling server is running.');
    }
  }

  registerMessageCallback(code: string, callback: (data: ArrayBuffer) => void) {
    this.messageCallbacks.set(code, callback);
  }

  unregisterMessageCallback(code: string) {
    this.messageCallbacks.delete(code);
  }

  private async handleOffer(code: string, offer: RTCSessionDescriptionInit) {
    console.log('Handling offer for code:', code);
    const peerConnection = new RTCPeerConnection(this.configuration);
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage(code, 'ice-candidate', event.candidate);
      }
    };

    peerConnection.ondatachannel = (event) => {
      console.log('Data channel received on receiver side');
      const dataChannel = event.channel;
      this.setupDataChannel(dataChannel);
      this.connections.set(code, { 
        connection: peerConnection, 
        dataChannel: dataChannel,
        isReady: false
      });
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    this.sendSignalingMessage(code, 'answer', answer);
    console.log('Answer sent for code:', code);
  }

  private async handleAnswer(code: string, answer: RTCSessionDescriptionInit) {
    console.log('Handling answer for code:', code);
    const connection = this.connections.get(code);
    if (connection) {
      await connection.connection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Remote description set for code:', code);
    }
  }

  private async handleIceCandidate(code: string, candidate: RTCIceCandidateInit) {
    console.log('Handling ICE candidate for code:', code);
    const connection = this.connections.get(code);
    if (connection) {
      await connection.connection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('ICE candidate added for code:', code);
    }
  }

  private sendSignalingMessage(code: string, type: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, code, data }));
    } else {
      console.error('WebSocket is not connected. Cannot send signaling message.');
      this.handleConnectionError();
    }
  }

  private async waitForDataChannelReady(code: string, timeout = 10000): Promise<void> {
    const connection = this.connections.get(code);
    if (!connection?.dataChannel) {
      throw new Error('No data channel available');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkReady = () => {
        if (connection.isReady && connection.dataChannel?.readyState === 'open') {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Data channel connection timeout'));
        } else {
          setTimeout(checkReady, 100);
        }
      };
      
      checkReady();
    });
  }

  async createConnection(code: string): Promise<void> {
    console.log('Creating WebRTC connection for code:', code);
    const peerConnection = new RTCPeerConnection(this.configuration);
    const dataChannel = peerConnection.createDataChannel('fileTransfer');
    
    this.setupDataChannel(dataChannel);
    this.connections.set(code, { 
      connection: peerConnection, 
      dataChannel,
      isReady: false 
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage(code, 'ice-candidate', event.candidate);
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    this.sendSignalingMessage(code, 'offer', offer);

    console.log('Connection created successfully');
  }

  async joinConnection(code: string): Promise<void> {
    console.log('Joining WebRTC connection for code:', code);
    const peerConnection = new RTCPeerConnection(this.configuration);
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage(code, 'ice-candidate', event.candidate);
      }
    };

    this.connections.set(code, { 
      connection: peerConnection,
      isReady: false
    });
    console.log('Connection joined successfully');
  }

  private setupDataChannel(dataChannel: RTCDataChannel): void {
    console.log('Setting up data channel');
    
    dataChannel.onopen = () => {
      console.log('Data channel opened');
      const connection = Array.from(this.connections.entries())
        .find(([_, conn]) => conn.dataChannel === dataChannel);
      if (connection) {
        const [code, conn] = connection;
        conn.isReady = true;
        console.log('Data channel ready for code:', code);
      }
    };

    dataChannel.onclose = () => {
      console.log('Data channel closed');
      const connection = Array.from(this.connections.entries())
        .find(([_, conn]) => conn.dataChannel === dataChannel);
      if (connection) {
        const [code, conn] = connection;
        conn.isReady = false;
      }
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };

    dataChannel.onmessage = (event) => {
      console.log('Received chunk data, size:', event.data.size);
      const connection = Array.from(this.connections.entries())
        .find(([_, conn]) => conn.dataChannel === dataChannel);
      
      if (connection) {
        const [code] = connection;
        const callback = this.messageCallbacks.get(code);
        if (callback && event.data instanceof ArrayBuffer) {
          callback(event.data);
        }
      }
    };
  }

  async sendData(code: string, data: ArrayBuffer): Promise<void> {
    console.log('Attempting to send data for code:', code);
    const connection = this.connections.get(code);
    if (!connection?.dataChannel) {
      console.error('No data channel available for code:', code);
      throw new Error('No data channel available');
    }

    try {
      // Wait for data channel to be ready with a 10 second timeout
      await this.waitForDataChannelReady(code);
      
      const CHUNK_SIZE = 16384; // 16KB chunks
      let offset = 0;
      const totalSize = data.byteLength;

      while (offset < totalSize) {
        const chunk = data.slice(offset, offset + CHUNK_SIZE);
        if (connection.dataChannel.readyState === 'open') {
          connection.dataChannel.send(chunk);
          console.log(`Sent chunk: ${offset}-${offset + chunk.byteLength} of ${totalSize} (${Math.round((offset / totalSize) * 100)}%)`);
          offset += CHUNK_SIZE;
          
          // Small delay between chunks to prevent overwhelming the channel
          await new Promise(resolve => setTimeout(resolve, 50));
        } else {
          throw new Error('Data channel closed during transmission');
        }
      }
    } catch (error) {
      console.error('Error sending data:', error);
      throw error;
    }
  }

  closeConnection(code: string): void {
    const connection = this.connections.get(code);
    if (connection) {
      if (connection.dataChannel) {
        connection.dataChannel.close();
      }
      connection.connection.close();
      this.connections.delete(code);
      console.log('Connection closed for code:', code);
    }
  }
}

export default WebRTCService;
