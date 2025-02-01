export class FileAssembler {
  private chunks: ArrayBuffer[] = [];
  private metadata: any;

  addChunk(chunk: ArrayBuffer, metadata: any) {
    this.chunks.push(chunk);
    this.metadata = metadata;
  }

  assembleFile(): Blob {
    const blob = new Blob(this.chunks, { type: this.metadata.mimeType });
    this.chunks = [];
    return blob;
  }
}