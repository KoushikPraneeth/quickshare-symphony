export type StreamOptions = {
  onProgress?: (progress: number) => void;
  chunkSize?: number;
};

export class FileSplitter {
  private static readonly DEFAULT_CHUNK_SIZE = 1024; // 1KB default chunk size
  private static readonly MIN_CHUNK_SIZE = 256; // 256 bytes minimum
  private currentChunkSize: number;

  constructor() {
    this.currentChunkSize = FileSplitter.DEFAULT_CHUNK_SIZE;
    console.log(`FileSplitter initialized with chunk size: ${this.currentChunkSize} bytes`);
  }

  private validateFile(file: File): void {
    if (!file) {
      throw new Error('No file provided');
    }

    if (file.size === 0) {
      throw new Error('File is empty');
    }

    console.log('File validation passed:');
    console.log(`- Name: ${file.name}`);
    console.log(`- Size: ${file.size} bytes`);
    console.log(`- Type: ${file.type}`);
    console.log(`- Last modified: ${new Date(file.lastModified).toISOString()}`);
  }

  /**
   * Creates an async iterator that yields chunks of the file
   */
  async *createFileStream(file: File, options: StreamOptions = {}): AsyncGenerator<{
    chunk: ArrayBuffer;
    index: number;
    total: number;
  }> {
    this.validateFile(file);
    
    const chunkSize = options.chunkSize || this.currentChunkSize;
    let offset = 0;
    let index = 0;
    const totalChunks = Math.ceil(file.size / chunkSize);

    console.log(`Starting file stream with chunk size: ${chunkSize} bytes`);
    console.log(`Total chunks to process: ${totalChunks}`);

    while (offset < file.size) {
      const end = Math.min(offset + chunkSize, file.size);
      const chunk = file.slice(offset, end);

      try {
        const arrayBuffer = await this.readChunkAsArrayBuffer(chunk);
        
        // Validate chunk data
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error(`Invalid chunk data at offset ${offset}`);
        }

        console.log(`Streaming chunk ${index + 1}/${totalChunks}:`);
        console.log(`- Offset: ${offset}`);
        console.log(`- Size: ${arrayBuffer.byteLength} bytes`);

        // Report progress if callback provided
        if (options.onProgress) {
          options.onProgress((offset / file.size) * 100);
        }

        yield {
          chunk: arrayBuffer,
          index,
          total: totalChunks
        };

        // Update for next iteration
        offset = end;
        index++;

      } catch (error) {
        console.error(`Error processing chunk at offset ${offset}:`, error);
        
        // Reduce chunk size if we hit buffer limits
        if (error.message?.includes('buffer too small') && this.reduceChunkSize()) {
          // Retry with smaller chunk size
          continue;
        }
        
        throw new Error(`Failed to process chunk at offset ${offset}: ${error.message}`);
      }
    }

    console.log('File streaming completed successfully');
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
    const newSize = Math.floor(this.currentChunkSize * 0.75); // Reduce by 25%
    if (newSize >= FileSplitter.MIN_CHUNK_SIZE) {
      this.currentChunkSize = newSize;
      console.log(`Reduced chunk size to ${this.currentChunkSize} bytes`);
      return true;
    }
    console.warn(`Cannot reduce chunk size below minimum of ${FileSplitter.MIN_CHUNK_SIZE} bytes`);
    return false;
  }

  getCurrentChunkSize(): number {
    return this.currentChunkSize;
  }
}
