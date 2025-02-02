export class FileAssembler {
  private chunks: ArrayBuffer[] = [];
  private metadata: any;

  addChunk(chunk: ArrayBuffer, metadata: any) {
    console.log(`Adding chunk ${metadata.chunkIndex + 1}/${metadata.totalChunks}`);
    this.chunks.push(chunk);
    this.metadata = metadata;
  }

  assembleFile(): Blob {
    console.log(`Assembling file: ${this.metadata.fileName}`);
    const blob = new Blob(this.chunks, { type: this.metadata.mimeType });
    console.log(`File assembled: ${blob.size} bytes`);
    this.chunks = [];
    return blob;
  }
}