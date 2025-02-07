export class FileSplitter {
  private static readonly CHUNK_SIZE = 8192; // 8KB chunks
  private static readonly MAX_CHUNKS = 10000; // Safety limit

  constructor() {
    console.log(`FileSplitter initialized with chunk size: ${FileSplitter.CHUNK_SIZE} bytes`);
  }

  private validateFile(file: File): void {
    if (!file) {
      throw new Error('No file provided');
    }

    if (file.size === 0) {
      throw new Error('File is empty');
    }

    const estimatedChunks = Math.ceil(file.size / FileSplitter.CHUNK_SIZE);
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
    console.log(`- Last modified: ${new Date(file.lastModified).toISOString()}`);
  }

  async splitFile(file: File): Promise<ArrayBuffer[]> {
    try {
      this.validateFile(file);

      const totalChunks = Math.ceil(file.size / FileSplitter.CHUNK_SIZE);
      console.log(`Splitting file into ${totalChunks} chunks`);

      const chunks: ArrayBuffer[] = [];
      let offset = 0;
      let chunkIndex = 0;

      while (offset < file.size) {
        const chunk = file.slice(offset, offset + FileSplitter.CHUNK_SIZE);
        try {
          const arrayBuffer = await this.readChunkAsArrayBuffer(chunk);
          
          // Validate chunk data
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            throw new Error(`Invalid chunk data at offset ${offset}`);
          }

          chunks.push(arrayBuffer);

          console.log(`Chunk ${chunkIndex + 1}/${totalChunks} processed:`);
          console.log(`- Offset: ${offset}`);
          console.log(`- Size: ${arrayBuffer.byteLength} bytes`);

          offset += FileSplitter.CHUNK_SIZE;
          chunkIndex++;

          const progress = (offset / file.size) * 100;
          console.log(`Splitting progress: ${progress.toFixed(2)}%`);
        } catch (error) {
          console.error(`Error processing chunk at offset ${offset}:`, error);
          throw new Error(`Failed to process chunk at offset ${offset}: ${error.message}`);
        }
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
      console.log(`- Average chunk size: ${(totalSize / chunks.length).toFixed(2)} bytes`);
      console.log(`- Last chunk size: ${chunks[chunks.length - 1].byteLength} bytes`);

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
}
