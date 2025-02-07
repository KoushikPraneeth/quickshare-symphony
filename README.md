# QuickShare Symphony

A real-time file sharing application that enables fast and reliable transfer of files of any size using WebSocket streaming.

## Features

- **Large File Support**: Can handle files of any size (even 50GB+) through efficient streaming
- **Memory Efficient**: Uses File.slice() for streaming chunks, keeping memory usage constant
- **Reliable Transfer**: 
  - Automatic retry on failures
  - Connection recovery
  - Progress tracking
  - Data integrity verification
- **Adaptive Performance**:
  - Dynamic chunk size adjustment
  - Network condition monitoring
  - Backoff strategy for retries

## How It Works

The file transfer process works like cutting and sending pieces of a sugarcane:

1. **File Splitting (FileSplitter.ts)**:
   - File is split into 1KB chunks using File.slice()
   - Only one chunk is loaded in memory at a time
   - Chunks are streamed sequentially
   - Automatic chunk size adjustment if network issues occur

2. **Transfer (WebSocketService.ts)**:
   - Each chunk is sent with its metadata
   - Progress is tracked in real-time
   - Failed chunks are automatically retried
   - Lost connections are recovered

3. **Assembly (FileAssembler.ts)**:
   - Chunks are received and validated
   - Progress is tracked
   - Chunks are assembled in correct order
   - Final file is verified for integrity

## Technical Details

### Core Components

1. **FileSplitter**:
```typescript
async *createFileStream(file: File, options?: StreamOptions)
```
- Streams file chunks using File.slice()
- Handles chunk size optimization
- Reports progress

2. **WebSocketService**:
```typescript
async sendFile(file: File, onProgress: (progress: number) => void)
```
- Manages WebSocket connection
- Handles chunk transmission
- Provides progress updates
- Manages retries and reconnection

3. **FileAssembler**:
```typescript
addChunk(chunk: ArrayBuffer, metadata: FileMetadata)
```
- Manages chunk assembly
- Verifies file integrity
- Handles out-of-order chunks

### Key Features

1. **Streaming Implementation**:
   - No full file loading into memory
   - Constant memory usage regardless of file size
   - Progressive chunk processing

2. **Error Handling**:
   - Automatic retry on chunk failure
   - Dynamic chunk size adjustment
   - Connection recovery
   - Data validation

3. **Performance Optimization**:
   - Adaptive chunk sizing
   - Connection quality monitoring
   - Efficient binary data handling

## Setup and Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/quickshare-symphony.git
cd quickshare-symphony
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

### Backend Setup

1. Navigate to the backend directory:
```bash
cd quickshare
```

2. Run the Spring Boot application:
```bash
./mvnw spring-boot:run
```

## Development

### Frontend Stack
- React + TypeScript
- Vite
- WebSocket API
- File API
- ArrayBuffer for binary data handling

### Backend Stack
- Spring Boot
- WebSocket
- Java Concurrency

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by the need for efficient large file transfer
- Built with modern web technologies
- Uses efficient streaming techniques similar to video streaming
