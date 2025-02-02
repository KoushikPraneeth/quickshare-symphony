import SimplePeer from 'simple-peer';
import { WebRTCCallbacks } from './WebRTCTypes';
import { toast } from 'sonner';

export class PeerConnection {
  private peer: SimplePeer.Instance | null = null;
  private callbacks: WebRTCCallbacks = {};

  constructor(initiator: boolean = false) {
    this.peer = new SimplePeer({ initiator, trickle: false });
    this.setupPeerEvents();
  }

  private setupPeerEvents() {
    if (!this.peer) return;

    this.peer.on('connect', () => {
      console.log('Peer connection established');
      toast.success('Connected to peer');
      this.callbacks.onConnect?.();
    });

    this.peer.on('data', (data) => {
      if (this.callbacks.onData) {
        this.callbacks.onData(JSON.parse(data.toString()));
      }
    });

    this.peer.on('error', (err) => {
      console.error('Peer connection error:', err);
      toast.error('Connection error occurred');
      this.callbacks.onError?.(err);
    });
  }

  setCallbacks(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  signal(data: any) {
    this.peer?.signal(data);
  }

  async sendData(data: any): Promise<void> {
    if (!this.peer) {
      throw new Error('Peer connection not established');
    }
    this.peer.send(JSON.stringify(data));
  }

  destroy() {
    this.peer?.destroy();
    this.peer = null;
  }

  onSignal(callback: (data: any) => void) {
    this.peer?.on('signal', callback);
  }
}