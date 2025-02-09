# QuickShare Symphony

QuickShare Symphony is a real-time file sharing application that enables seamless file transfers between users through WebSocket connections. Built with modern web technologies and a robust backend, it provides a reliable and efficient way to share files with real-time progress tracking and automatic error recovery.

![image](https://github.com/user-attachments/assets/42f8b407-5151-41cc-b973-6ac414c0f4ce)
![image](https://github.com/user-attachments/assets/085d231d-4770-479a-9886-0db42473256c)


## Features

- 🚀 Real-time file transfer with progress tracking
- 📦 Chunk-based file handling for reliable transfers
- 🔄 Automatic reconnection and error recovery
- ⚡ WebSocket with SockJS fallback support
- 📱 Responsive design for all devices
- 🛡️ Secure file transfer protocol
- 🎯 Progress tracking and status updates

## Technical Architecture

### Frontend Stack

- **React + TypeScript**: Modern frontend development with type safety
- **Vite**: Next-generation frontend tooling
- **shadcn/ui**: High-quality UI components
- **WebSocket**: Real-time communication with automatic fallback
- **File Processing**: Efficient chunk-based file handling

### Backend Stack

- **Spring Boot**: Robust Java-based backend
- **WebSocket**: Native WebSocket support with SockJS fallback
- **Session Management**: Sophisticated transfer session handling
- **Concurrent Processing**: Thread-safe file transfer handling

## Installation & Setup

### Prerequisites

- Node.js (v18+)
- Java Development Kit (JDK) 17+
- Maven

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Backend Setup

```bash
cd quickshare

# Build the project
./mvnw clean install

# Run the application
./mvnw spring-boot:run
```

## Usage Guide

### Starting the Application

1. Start the backend server
2. Launch the frontend application
3. Access the application at `http://localhost:5173`

### Sending Files

1. Open the "Send" page
2. Select file(s) to transfer
3. Share the generated connection ID with the recipient
4. Monitor transfer progress in real-time

### Receiving Files

1. Open the "Receive" page
2. Enter the connection ID provided by the sender
3. Wait for the transfer to complete
4. Files will be automatically saved

## Implementation Details

### File Transfer Protocol

The application implements a sophisticated file transfer protocol:

1. **Connection Establishment**

   - WebSocket connection with fallback to SockJS
   - Unique connection IDs for session management
   - Sender/Receiver role assignment

2. **File Processing**

   - Chunk-based file splitting (FileSplitter)
   - Dynamic chunk size adjustment
   - Progress tracking per chunk

3. **Data Transfer**

   - Binary data transmission
   - Metadata synchronization
   - Order preservation
   - Error detection and recovery

4. **File Assembly**
   - Ordered chunk collection
   - Integrity verification
   - MIME type preservation
   - Automatic cleanup

### WebSocket Communication

```typescript
// Connection Format
{
  type: "connection",
  id: string,
  role: "sender" | "receiver"
}

// Metadata Format
{
  fileName: string,
  mimeType: string,
  totalChunks: number,
  chunkIndex: number
}
```

### Error Handling

The system implements comprehensive error handling:

- Automatic reconnection with exponential backoff
- Chunk size adjustment for buffer limitations
- Duplicate chunk detection
- Missing chunk verification
- Session state recovery

## Development Guide

### Key Components

1. **WebSocketService**

   - Core communication handler
   - Connection management
   - Transfer coordination

2. **FileSplitter**

   - File chunking
   - Stream processing
   - Progress tracking

3. **FileAssembler**

   - Chunk assembly
   - Order management
   - File reconstruction

4. **TransferHandler (Backend)**
   - Session management
   - Binary data handling
   - Client coordination

### Project Structure

```
├── src/
│   ├── components/         # React components
│   ├── services/          # Core services
│   ├── utils/             # Utility functions
│   └── pages/             # Application pages
│
├── quickshare/
│   └── src/
│       └── main/
│           └── java/      # Backend implementation
```

## Performance Considerations

- Adaptive chunk sizing for optimal performance
- Buffer management to prevent memory issues
- Concurrent session handling
- Efficient binary data processing
- Automatic resource cleanup

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
