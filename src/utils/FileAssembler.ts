interface FileMetadata {
  fileName: string;
  mimeType: string;
  totalChunks: number;
  chunkIndex: number;
}

export class FileAssembler {
  private chunks: ArrayBuffer[] = [];
  private metadata: FileMetadata | null = null;
  private totalSize: number = 0;

  constructor() {
    console.log('FileAssembler initialized');
  }

  addChunk(chunk: ArrayBuffer, metadata: FileMetadata) {
    console.log(`Adding chunk ${metadata.chunkIndex + 1}/${metadata.totalChunks} for file: ${metadata.fileName}`);
    console.log(`Chunk size: ${chunk.byteLength} bytes`);
    
    this.chunks.push(chunk);
    this.metadata = metadata;
    this.totalSize += chunk.byteLength;
    
    const progress = (this.chunks.length / metadata.totalChunks) * 100;
    console.log(`Assembly progress: ${progress.toFixed(2)}%, Total size so far: ${this.totalSize} bytes`);
  }

  assembleFile(): { blob: Blob; fileName: string } {
    if (!this.metadata) {
      throw new Error('No metadata available for file assembly');
    }

    console.log(`Starting file assembly for: ${this.metadata.fileName}`);
    console.log(`MIME type: ${this.metadata.mimeType}`);
    console.log(`Total chunks to assemble: ${this.metadata.totalChunks}`);
    console.log(`Current chunks available: ${this.chunks.length}`);

    if (this.chunks.length !== this.metadata.totalChunks) {
      console.warn(`Warning: Number of chunks (${this.chunks.length}) doesn't match expected count (${this.metadata.totalChunks})`);
    }

    const blob = new Blob(this.chunks, { type: this.metadata.mimeType });
    console.log(`File assembled successfully:`);
    console.log(`- Final size: ${blob.size} bytes`);
    console.log(`- Chunk count: ${this.chunks.length}`);
    console.log(`- Average chunk size: ${(blob.size / this.chunks.length).toFixed(2)} bytes`);
    
    const fileName = this.metadata.fileName;
    
    // Clear the stored chunks and metadata
    this.chunks = [];
    this.metadata = null;
    this.totalSize = 0;
    console.log('Assembly buffers cleared');

    return { blob, fileName };
  }
}
