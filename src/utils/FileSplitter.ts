export class FileSplitter {
  private static readonly DEFAULT_CHUNK_SIZE = 1024; // 1KB default chunk size
  private static readonly MIN_CHUNK_SIZE = 256; // 256 bytes minimum
  private static readonly MAX_CHUNKS = 1000000; // Increased for smaller chunks
  private static readonly BACKOFF_FACTOR = 0.75; // Reduce chunk size by 25% on failure

  private currentChunkSize: number;
  private activeTransfers: Set<string>;

  constructor() {
    this.currentChunkSize = FileSplitter.DEFAULT_CHUNK_SIZE;
    this.activeTransfers = new Set();
    console.log(`FileSplitter initialized with chunk size: ${this.currentChunkSize} bytes`);
  }

  private validateFile(file: File): void {
    if (!file) {
      throw new Error('No file provided');
    }

    if (file.size === 0) {
      throw new Error('File is empty');
    }

    const estimatedChunks = Math.ceil(file.size / this.currentChunkSize);
    if (estimatedChunks > FileSplitter.MAX_CHUNKS) {
      throw new Error(
        `File too large. Would require ${estimatedChunks} chunks, ` +
        `exceeding the limit of ${FileSplitter.MAX_CHUNKS}`
      );
    }

    console.log('File validation passed:');
    console.log(`- Name: ${file.name}`);
    console.log(`- Size: ${file.size} bytes`);
    console.log(`- Type: ${file.type}`);
    console.log(`- Estimated chunks: ${estimatedChunks}`);
    console.log(`- Current chunk size: ${this.currentChunkSize} bytes`);
  }

  async splitFile(file: File): Promise<ArrayBuffer[]> {
    try {
      this.validateFile(file);
      
      // Add file to active transfers
      const transferId = `${file.name}-${file.size}-${Date.now()}`;
      this.activeTransfers.add(transferId);

      const chunks: ArrayBuffer[] = [];
      let offset = 0;
      let chunkIndex = 0;
      let consecutiveFailures = 0;

      while (offset < file.size && this.activeTransfers.has(transferId)) {
        const end = Math.min(offset + this.currentChunkSize, file.size);
        const chunk = file.slice(offset, end);

        try {
          const arrayBuffer = await this.readChunkAsArrayBuffer(chunk);
          
          // Validate chunk data
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            throw new Error(`Invalid chunk data at offset ${offset}`);
          }

          chunks.push(arrayBuffer);
          console.log(`Chunk ${chunkIndex + 1} processed: ${arrayBuffer.byteLength} bytes`);

          // Reset consecutive failures on success
          if (consecutiveFailures > 0) {
            consecutiveFailures = 0;
            // Gradually increase chunk size on success
            this.increaseChunkSize();
          }

          offset = end;
          chunkIndex++;

          const progress = (offset / file.size) * 100;
          console.log(`Splitting progress: ${progress.toFixed(2)}%`);
        } catch (error) {
          console.error(`Error processing chunk at offset ${offset}:`, error);
          
          consecutiveFailures++;
          if (consecutiveFailures >= 3) {
            // Reduce chunk size after multiple failures
            if (!this.reduceChunkSize()) {
              throw new Error('Cannot reduce chunk size further, transfer failed');
            }
            consecutiveFailures = 0;
            continue; // Retry with smaller chunk size
          }

          // Retry current chunk
          console.log(`Retrying chunk at offset ${offset}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * consecutiveFailures));
          continue;
        }
      }

      // Check if transfer was cancelled
      if (!this.activeTransfers.has(transferId)) {
        throw new Error('File transfer was cancelled');
      }

      // Validate final result
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      if (totalSize !== file.size) {
        throw new Error(
          `Size mismatch after splitting. ` +
          `Expected ${file.size} bytes, got ${totalSize} bytes`
        );
      }

      console.log('File splitting completed successfully:');
      console.log(`- Total chunks created: ${chunks.length}`);
      console.log(`- Total size: ${totalSize} bytes`);
      console.log(`- Final chunk size used: ${this.currentChunkSize} bytes`);

      // Clean up
      this.activeTransfers.delete(transferId);
      return chunks;
    } catch (error) {
      console.error('Error splitting file:', error);
      throw new Error(`Failed to split file: ${error.message}`);
    }
  }

  private readChunkAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error('Chunk read timeout'));
      }, 5000); // 5 second timeout

      reader.onload = () => {
        clearTimeout(timeout);
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read chunk as ArrayBuffer'));
        }
      };
      
      reader.onerror = () => {
        clearTimeout(timeout);
        reject(reader.error || new Error('Unknown error reading chunk'));
      };

      reader.onabort = () => {
        clearTimeout(timeout);
        reject(new Error('Chunk read aborted'));
      };
      
      try {
        reader.readAsArrayBuffer(blob);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private reduceChunkSize(): boolean {
    const newSize = Math.floor(this.currentChunkSize * FileSplitter.BACKOFF_FACTOR);
    if (newSize >= FileSplitter.MIN_CHUNK_SIZE) {
      this.currentChunkSize = newSize;
      console.log(`Reduced chunk size to ${this.currentChunkSize} bytes`);
      return true;
    }
    console.warn(`Cannot reduce chunk size below minimum of ${FileSplitter.MIN_CHUNK_SIZE} bytes`);
    return false;
  }

  private increaseChunkSize(): void {
    const newSize = Math.min(
      Math.floor(this.currentChunkSize / FileSplitter.BACKOFF_FACTOR),
      FileSplitter.DEFAULT_CHUNK_SIZE
    );
    if (newSize !== this.currentChunkSize) {
      this.currentChunkSize = newSize;
      console.log(`Increased chunk size to ${this.currentChunkSize} bytes`);
    }
  }

  cancelTransfer(fileName: string): void {
    for (const transferId of this.activeTransfers) {
      if (transferId.startsWith(fileName)) {
        this.activeTransfers.delete(transferId);
        console.log(`Cancelled transfer for ${fileName}`);
      }
    }
  }
}
