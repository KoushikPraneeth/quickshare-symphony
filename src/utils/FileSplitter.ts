export interface ChunkMetadata {
    originalName: string;
    totalChunks: number;
    chunkIndex: number;
    fileSize: number;
    checksum: string;
}

export class FileSplitter {
    static CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

    static async splitFile(file: File): Promise<ArrayBuffer[]> {
        console.log('Starting file splitting...');
        const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
        const chunks: ArrayBuffer[] = [];

        try {
            for (let i = 0; i < totalChunks; i++) {
                const start = i * this.CHUNK_SIZE;
                const end = Math.min(start + this.CHUNK_SIZE, file.size);
                const chunkData = file.slice(start, end);
                const buffer = await chunkData.arrayBuffer();
                
                const metadata: ChunkMetadata = {
                    originalName: file.name,
                    totalChunks: totalChunks,
                    chunkIndex: i,
                    fileSize: file.size,
                    checksum: await this.calculateChecksum(buffer)
                };

                // Combine metadata and chunk data into a single ArrayBuffer
                const metadataString = JSON.stringify(metadata);
                const metadataBuffer = new TextEncoder().encode(metadataString + '\n\n');
                
                // Create combined buffer
                const combinedBuffer = new Uint8Array(metadataBuffer.length + buffer.byteLength);
                combinedBuffer.set(metadataBuffer, 0);
                combinedBuffer.set(new Uint8Array(buffer), metadataBuffer.length);
                
                chunks.push(combinedBuffer.buffer);
                console.log(`Chunk ${i + 1}/${totalChunks} created`);
            }

            console.log(`File split into ${chunks.length} chunks`);
            return chunks;
        } catch (error) {
            console.error('Error splitting file:', error);
            throw error;
        }
    }

    static async calculateChecksum(buffer: ArrayBuffer): Promise<string> {
        const hash = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }
}