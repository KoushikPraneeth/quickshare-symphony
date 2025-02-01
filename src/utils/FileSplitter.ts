export class FileSplitter {
  private readonly CHUNK_SIZE = 16384; // 16KB chunks

  async splitFile(file: File): Promise<ArrayBuffer[]> {
    const chunks: ArrayBuffer[] = [];
    let offset = 0;

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + this.CHUNK_SIZE);
      const arrayBuffer = await chunk.arrayBuffer();
      chunks.push(arrayBuffer);
      offset += this.CHUNK_SIZE;
    }

    return chunks;
  }
}