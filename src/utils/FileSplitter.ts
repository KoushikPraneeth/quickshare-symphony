export class FileSplitter {
  private static readonly CHUNK_SIZE = 16384; // 16KB chunks

  constructor() {
    console.log(`FileSplitter initialized with chunk size: ${FileSplitter.CHUNK_SIZE} bytes`);
  }

  async splitFile(file: File): Promise<ArrayBuffer[]> {
    console.log(`Starting to split file: ${file.name}`);
    console.log(`File details:`);
    console.log(`- Size: ${file.size} bytes`);
    console.log(`- Type: ${file.type}`);
    console.log(`- Last modified: ${new Date(file.lastModified).toISOString()}`);

    const totalChunks = Math.ceil(file.size / FileSplitter.CHUNK_SIZE);
    console.log(`Calculated ${totalChunks} chunks needed`);

    const chunks: ArrayBuffer[] = [];
    let offset = 0;
    let chunkIndex = 0;

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + FileSplitter.CHUNK_SIZE);
      const arrayBuffer = await this.readChunkAsArrayBuffer(chunk);
      chunks.push(arrayBuffer);

      console.log(`Chunk ${chunkIndex + 1}/${totalChunks} processed:`);
      console.log(`- Offset: ${offset}`);
      console.log(`- Size: ${arrayBuffer.byteLength} bytes`);

      offset += FileSplitter.CHUNK_SIZE;
      chunkIndex++;

      const progress = (offset / file.size) * 100;
      console.log(`Splitting progress: ${progress.toFixed(2)}%`);
    }

    console.log('File splitting completed:');
    console.log(`- Total chunks created: ${chunks.length}`);
    console.log(`- Average chunk size: ${(file.size / chunks.length).toFixed(2)} bytes`);
    console.log(`- Last chunk size: ${chunks[chunks.length - 1].byteLength} bytes`);

    return chunks;
  }

  private readChunkAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read chunk as ArrayBuffer'));
        }
      };
      
      reader.onerror = () => {
        reject(reader.error);
      };
      
      reader.readAsArrayBuffer(blob);
    });
  }
}
