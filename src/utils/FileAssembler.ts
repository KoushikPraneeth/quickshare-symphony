import { ChunkMetadata } from './FileSplitter';

export class FileAssembler {
    static async assembleChunks(chunks: ArrayBuffer[]): Promise<Blob> {
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
            const chunks_data: ArrayBuffer[] = [];
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

    private static async parseChunk(chunk: ArrayBuffer): Promise<{ metadata: ChunkMetadata; data: ArrayBuffer }> {
        const decoder = new TextDecoder();
        const view = new Uint8Array(chunk);
        let metadataEnd = -1;
        
        // Find the metadata separator (\n\n)
        for (let i = 0; i < view.length - 1; i++) {
            if (view[i] === 10 && view[i + 1] === 10) { // \n\n
                metadataEnd = i;
                break;
            }
        }
        
        if (metadataEnd === -1) throw new Error('Invalid chunk format');
        
        const metadataText = decoder.decode(view.slice(0, metadataEnd));
        const metadata = JSON.parse(metadataText) as ChunkMetadata;
        const data = chunk.slice(metadataEnd + 2);
        
        return { metadata, data };
    }

    private static async verifyChunk(chunk: { metadata: ChunkMetadata; data: ArrayBuffer }): Promise<void> {
        const hash = await crypto.subtle.digest('SHA-256', chunk.data);
        const checksum = Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0')).join('');
            
        if (checksum !== chunk.metadata.checksum) {
            throw new Error(`Checksum mismatch in chunk ${chunk.metadata.chunkIndex}`);
        }
    }
}