interface PeerConnection {
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
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
    const peerConnection = new RTCPeerConnection(this.configuration);
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage(code, 'ice-candidate', event.candidate);
      }
    };

    peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
      this.connections.set(code, { 
        connection: peerConnection, 
        dataChannel: event.channel 
      });
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    this.sendSignalingMessage(code, 'answer', answer);
  }

  private async handleAnswer(code: string, answer: RTCSessionDescriptionInit) {
    const connection = this.connections.get(code);
    if (connection) {
      await connection.connection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  private async handleIceCandidate(code: string, candidate: RTCIceCandidateInit) {
    const connection = this.connections.get(code);
    if (connection) {
      await connection.connection.addIceCandidate(new RTCIceCandidate(candidate));
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
    this.connections.set(code, { connection: peerConnection, dataChannel });

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

    this.connections.set(code, { connection: peerConnection });
    console.log('Connection joined successfully');
  }

  private setupDataChannel(dataChannel: RTCDataChannel): void {
    dataChannel.onopen = () => {
      console.log('Data channel opened');
    };

    dataChannel.onclose = () => {
      console.log('Data channel closed');
    };

    dataChannel.onmessage = (event) => {
      console.log('Received message:', event.data);
    };
  }

  async sendData(code: string, data: ArrayBuffer): Promise<void> {
    const connection = this.connections.get(code);
    if (!connection?.dataChannel) {
      throw new Error('No data channel available');
    }

    const CHUNK_SIZE = 16384; // 16KB chunks
    let offset = 0;

    while (offset < data.byteLength) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      connection.dataChannel.send(chunk);
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
    }
  }
}

export default WebRTCService;