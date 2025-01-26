interface PeerConnection {
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  isReady?: boolean;
}

class WebRTCService {
  private static instance: WebRTCService;
  private connections: Map<string, PeerConnection> = new Map();
  private ws: WebSocket | null = null;
  
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
    this.ws = new WebSocket('ws://localhost:8080');
    
    this.ws.onopen = () => {
      console.log('Connected to signaling server');
    };

    this.ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      const { type, code, data } = message;

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
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, code, data }));
    }
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
    };

    dataChannel.onmessage = (event) => {
      console.log('Received chunk data, size:', event.data.size);
    };
  }

  async sendData(code: string, data: ArrayBuffer): Promise<void> {
    const connection = this.connections.get(code);
    if (!connection?.dataChannel) {
      throw new Error('No data channel available');
    }

    if (!connection.isReady || connection.dataChannel.readyState !== 'open') {
      console.log('Waiting for data channel to be ready...');
      await new Promise<void>((resolve) => {
        const checkReady = setInterval(() => {
          if (connection.isReady && connection.dataChannel?.readyState === 'open') {
            clearInterval(checkReady);
            resolve();
          }
        }, 100);
      });
    }

    const CHUNK_SIZE = 16384; // 16KB chunks
    let offset = 0;

    while (offset < data.byteLength) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      connection.dataChannel.send(chunk);
      console.log(`Sent chunk: ${offset}-${offset + chunk.byteLength} of ${data.byteLength}`);
      offset += CHUNK_SIZE;
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