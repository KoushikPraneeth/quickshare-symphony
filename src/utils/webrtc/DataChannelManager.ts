export class DataChannelManager {
  private dataChannel: RTCDataChannel | null = null;
  private isReady = false;
  private readonly CHUNK_SIZE = 16384; // 16KB chunks
  
  setupDataChannel(channel: RTCDataChannel, onMessage: (data: ArrayBuffer) => void) {
    console.log('Setting up data channel');
    this.dataChannel = channel;
    
    channel.onopen = () => {
      console.log('Data channel opened');
      this.isReady = true;
    };

    channel.onclose = () => {
      console.log('Data channel closed');
      this.isReady = false;
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.isReady = false;
    };

    channel.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        onMessage(event.data);
      }
    };
  }

  async waitForReady(timeout = 10000): Promise<void> {
    if (!this.dataChannel) {
      throw new Error('No data channel available');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkReady = () => {
        if (this.isReady && this.dataChannel?.readyState === 'open') {
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

  async sendData(data: ArrayBuffer): Promise<void> {
    if (!this.dataChannel) {
      throw new Error('No data channel available');
    }

    await this.waitForReady();
    
    let offset = 0;
    const totalSize = data.byteLength;

    while (offset < totalSize) {
      const chunk = data.slice(offset, offset + this.CHUNK_SIZE);
      if (this.dataChannel.readyState === 'open') {
        this.dataChannel.send(chunk);
        console.log(`Sent chunk: ${offset}-${offset + chunk.byteLength} of ${totalSize}`);
        offset += this.CHUNK_SIZE;
        await new Promise(resolve => setTimeout(resolve, 50));
      } else {
        throw new Error('Data channel closed during transmission');
      }
    }
  }

  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
  }
}