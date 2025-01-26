import { ChunkMetadata, FileSplitter } from './FileSplitter';

export class FileAssembler {
    static async assembleChunks(chunks: Blob[]): Promise<Blob> {
        console.log('Starting file assembly...');
        try {
            const parsedChunks = await Promise.all(chunks.map(this.parseChunk));
            const sortedChunks = parsedChunks.sort((a, b) => 
                a.metadata.chunkIndex - b.metadata.chunkIndex
            );

            // Verify all chunks present
            if (sortedChunks.length === 0) {
                throw new Error('No chunks found');
            }

            const expectedIndices = Array.from(
                { length: sortedChunks[0].metadata.totalChunks },
                (_, i) => i
            );
            const receivedIndices = sortedChunks.map(c => c.metadata.chunkIndex);

            if (!expectedIndices.every(i => receivedIndices.includes(i))) {
                throw new Error('Missing chunks');
            }

            // Verify and combine chunks
            const chunks_data: Blob[] = [];
            for (const chunk of sortedChunks) {
                await this.verifyChunk(chunk);
                chunks_data.push(chunk.data);
            }

            // Create final blob
            const finalBlob = new Blob(chunks_data, { 
                type: 'application/octet-stream' 
            });

            console.log('File assembled successfully');
            return finalBlob;
        } catch (error) {
            console.error('Error assembling file:', error);
            throw error;
        }
    }

    private static async parseChunk(chunk: Blob): Promise<{ metadata: ChunkMetadata; data: Blob }> {
        const text = await chunk.slice(0, 1024).text(); // Read potential metadata
        const metadataEnd = text.indexOf('\n\n');
        
        if (metadataEnd === -1) throw new Error('Invalid chunk format');
        
        const metadata = JSON.parse(text.slice(0, metadataEnd)) as ChunkMetadata;
        const data = chunk.slice(metadataEnd + 2); // Skip metadata header
        
        return { metadata, data };
    }

    private static async verifyChunk(chunk: { metadata: ChunkMetadata; data: Blob }): Promise<void> {
        const checksum = await FileSplitter.calculateChecksum(chunk.data);
        if (checksum !== chunk.metadata.checksum) {
            throw new Error(`Checksum mismatch in chunk ${chunk.metadata.chunkIndex}`);
        }
    }
}