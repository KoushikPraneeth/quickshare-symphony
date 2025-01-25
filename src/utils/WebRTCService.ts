interface PeerConnection {
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

class WebRTCService {
  private static instance: WebRTCService;
  private connections: Map<string, PeerConnection> = new Map();
  private configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  async createConnection(code: string): Promise<void> {
    console.log('Creating WebRTC connection for code:', code);
    const peerConnection = new RTCPeerConnection(this.configuration);
    const dataChannel = peerConnection.createDataChannel('fileTransfer');
    
    this.setupDataChannel(dataChannel);
    this.connections.set(code, { connection: peerConnection, dataChannel });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate);
        // Here you would send the candidate to the other peer
      }
    };

    console.log('Connection created successfully');
  }

  async joinConnection(code: string): Promise<void> {
    console.log('Joining WebRTC connection with code:', code);
    const peerConnection = new RTCPeerConnection(this.configuration);
    
    peerConnection.ondatachannel = (event) => {
      console.log('Received data channel');
      this.setupDataChannel(event.channel);
      this.connections.set(code, { 
        connection: peerConnection, 
        dataChannel: event.channel 
      });
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate);
        // Here you would send the candidate to the other peer
      }
    };

    console.log('Successfully joined connection');
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
      // Handle incoming data
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