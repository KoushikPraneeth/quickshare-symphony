interface FileMetadata {
  fileName: string;
  mimeType: string;
  totalChunks: number;
  chunkIndex: number;
}

export class FileAssembler {
  private chunks: ArrayBuffer[] = [];
  private metadata: FileMetadata | null = null;

  addChunk(chunk: ArrayBuffer, metadata: FileMetadata) {
    console.log(`Adding chunk ${metadata.chunkIndex + 1}/${metadata.totalChunks} for file: ${metadata.fileName}`);
    this.chunks.push(chunk);
    this.metadata = metadata;
  }

  assembleFile(): { blob: Blob; fileName: string } {
    if (!this.metadata) {
      throw new Error('No metadata available for file assembly');
    }

    console.log(`Assembling file: ${this.metadata.fileName}`);
    const blob = new Blob(this.chunks, { type: this.metadata.mimeType });
    console.log(`File assembled: ${blob.size} bytes`);
    
    const fileName = this.metadata.fileName;
    
    // Clear the stored chunks and metadata
    this.chunks = [];
    this.metadata = null;

    return { blob, fileName };
  }
}
