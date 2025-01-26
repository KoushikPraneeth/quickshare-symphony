export interface ChunkMetadata {
    originalName: string;
    totalChunks: number;
    chunkIndex: number;
    fileSize: number;
    checksum: string;
}

export class FileSplitter {
    static CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

    static async splitFile(file: File): Promise<Blob[]> {
        console.log('Starting file splitting...');
        const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
        const chunks: Blob[] = [];

        try {
            for (let i = 0; i < totalChunks; i++) {
                const start = i * this.CHUNK_SIZE;
                const end = Math.min(start + this.CHUNK_SIZE, file.size);
                const chunkData = file.slice(start, end);
                
                const metadata: ChunkMetadata = {
                    originalName: file.name,
                    totalChunks: totalChunks,
                    chunkIndex: i,
                    fileSize: file.size,
                    checksum: await this.calculateChecksum(chunkData)
                };

                // Create chunk with metadata header
                const chunk = new Blob([
                    JSON.stringify(metadata) + '\n\n', // Metadata header
                    chunkData                          // Actual data
                ]);
                
                chunks.push(chunk);
                console.log(`Chunk ${i + 1}/${totalChunks} created`);
            }

            console.log(`File split into ${chunks.length} chunks`);
            return chunks;
        } catch (error) {
            console.error('Error splitting file:', error);
            throw error;
        }
    }

    static async calculateChecksum(chunk: Blob): Promise<string> {
        const buffer = await chunk.arrayBuffer();
        const hash = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }
}