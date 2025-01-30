export class DataChannelManager {
  private dataChannel: RTCDataChannel | null = null;
  private readonly chunkSize = 16384; // 16KB chunks
  
  setupDataChannel(channel: RTCDataChannel, onMessage: (data: ArrayBuffer) => void): void {
    console.log('Setting up data channel');
    this.dataChannel = channel;
    
    channel.onopen = () => {
      console.log('Data channel opened');
    };

    channel.onclose = () => {
      console.log('Data channel closed');
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };

    channel.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        onMessage(event.data);
      }
    };
  }

  async sendData(data: ArrayBuffer): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel is not ready');
    }

    let offset = 0;
    const totalSize = data.byteLength;

    while (offset < totalSize) {
      const chunk = data.slice(offset, offset + this.chunkSize);
      this.dataChannel.send(chunk);
      console.log(`Sent chunk: ${offset}-${offset + chunk.byteLength} of ${totalSize}`);
      offset += chunk.byteLength;
      // Small delay to prevent overwhelming the channel
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
  }
}