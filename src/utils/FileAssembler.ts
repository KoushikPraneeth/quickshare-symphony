interface FileMetadata {
  fileName: string;
  mimeType: string;
  totalChunks: number;
  chunkIndex: number;
}

interface FileBuffer {
  chunks: Map<number, ArrayBuffer>;
  metadata: FileMetadata;
  totalSize: number;
  receivedCount: number;
}

export class FileAssembler {
  private fileBuffers: Map<string, FileBuffer> = new Map();

  constructor() {
    console.log('FileAssembler initialized with chunk sequencing support');
  }

  private getFileId(metadata: FileMetadata): string {
    // Create a unique ID for each file transfer using name and total chunks
    return `${metadata.fileName}-${metadata.totalChunks}`;
  }

  addChunk(chunk: ArrayBuffer, metadata: FileMetadata) {
    const fileId = this.getFileId(metadata);
    console.log(`Processing chunk ${metadata.chunkIndex + 1}/${metadata.totalChunks} for file: ${metadata.fileName}`);
    console.log(`Chunk size: ${chunk.byteLength} bytes`);

    // Initialize file buffer if it doesn't exist
    if (!this.fileBuffers.has(fileId)) {
      console.log(`Initializing new file buffer for: ${metadata.fileName}`);
      this.fileBuffers.set(fileId, {
        chunks: new Map(),
        metadata: metadata,
        totalSize: 0,
        receivedCount: 0
      });
    }

    const fileBuffer = this.fileBuffers.get(fileId)!;

    // Only add the chunk if we haven't received it before
    if (!fileBuffer.chunks.has(metadata.chunkIndex)) {
      fileBuffer.chunks.set(metadata.chunkIndex, chunk);
      fileBuffer.totalSize += chunk.byteLength;
      fileBuffer.receivedCount++;

      console.log(`Chunk ${metadata.chunkIndex + 1} added successfully`);
      console.log(`Progress: ${(fileBuffer.receivedCount / metadata.totalChunks * 100).toFixed(2)}%`);
      console.log(`Total size so far: ${fileBuffer.totalSize} bytes`);
    } else {
      console.warn(`Duplicate chunk received for index ${metadata.chunkIndex}, ignoring`);
    }
  }

  isFileComplete(metadata: FileMetadata): boolean {
    const fileId = this.getFileId(metadata);
    const fileBuffer = this.fileBuffers.get(fileId);
    
    if (!fileBuffer) {
      return false;
    }

    // Check if we have all chunks
    if (fileBuffer.receivedCount !== metadata.totalChunks) {
      return false;
    }

    // Verify chunks are in sequence
    for (let i = 0; i < metadata.totalChunks; i++) {
      if (!fileBuffer.chunks.has(i)) {
        console.warn(`Missing chunk at index ${i}`);
        return false;
      }
    }

    return true;
  }

  assembleFile(metadata: FileMetadata): { blob: Blob; fileName: string } {
    const fileId = this.getFileId(metadata);
    const fileBuffer = this.fileBuffers.get(fileId);

    if (!fileBuffer) {
      throw new Error(`No file buffer found for ${metadata.fileName}`);
    }

    if (!this.isFileComplete(metadata)) {
      throw new Error(`Cannot assemble incomplete file ${metadata.fileName}`);
    }

    console.log(`Starting file assembly for: ${metadata.fileName}`);
    console.log(`MIME type: ${metadata.mimeType}`);
    console.log(`Total chunks to assemble: ${metadata.totalChunks}`);

    // Convert ordered Map to array
    const orderedChunks: ArrayBuffer[] = [];
    for (let i = 0; i < metadata.totalChunks; i++) {
      orderedChunks.push(fileBuffer.chunks.get(i)!);
    }

    const blob = new Blob(orderedChunks, { type: metadata.mimeType });
    
    console.log(`File assembled successfully:`);
    console.log(`- Final size: ${blob.size} bytes`);
    console.log(`- Total chunks: ${orderedChunks.length}`);
    console.log(`- Average chunk size: ${(blob.size / orderedChunks.length).toFixed(2)} bytes`);

    // Clean up the file buffer
    this.fileBuffers.delete(fileId);
    console.log(`File buffer cleared for ${metadata.fileName}`);

    return { blob, fileName: metadata.fileName };
  }

  clearIncompleteFiles() {
    this.fileBuffers.clear();
    console.log('Cleared all incomplete file buffers');
  }
}
