export class PeerConnectionManager {
  private peerConnection: RTCPeerConnection;
  
  constructor(configuration: RTCConfiguration) {
    this.peerConnection = new RTCPeerConnection(configuration);
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  createDataChannel(label: string): RTCDataChannel {
    return this.peerConnection.createDataChannel(label);
  }

  onIceCandidate(handler: (candidate: RTCIceCandidate | null) => void) {
    this.peerConnection.onicecandidate = (event) => handler(event.candidate);
  }

  onDataChannel(handler: (event: RTCDataChannelEvent) => void) {
    this.peerConnection.ondatachannel = handler;
  }

  close() {
    this.peerConnection.close();
  }
}