# QuickShare Symphony

A real-time file sharing application that allows users to transfer files of any size using WebSocket streaming.

## Features

- Efficient file streaming using chunks
- Real-time progress tracking
- Support for any file type
- No server-side storage (direct streaming)
- Memory-efficient handling of large files

## How It Works

1. **Sender Side:**
   - Clicks "Establish Connection" to get a unique connection ID
   - Shares the connection ID with the receiver
   - Selects a file to send
   - File is split into chunks and streamed via WebSocket

2. **Receiver Side:**
   - Enters the connection ID
   - Connects to the sender's session
   - Automatically receives and assembles file chunks
   - File is saved when transfer completes

## Technical Implementation

### Frontend (React + TypeScript)

- Uses File API for efficient chunking
- WebSocket for real-time communication
- Progress tracking and error handling
- Automatic file download on completion

### Backend (Spring Boot)

- WebSocket endpoint for file streaming
- Session management for sender/receiver pairs
- Memory-efficient binary message handling
- No temporary file storage needed

## Running the Application

1. Start the backend:
   ```bash
   cd quickshare
   ./mvnw spring-boot:run
   ```

2. Start the frontend:
   ```bash
   npm install
   npm run dev
   ```

3. Access the frontend at `http://localhost:8080` and ensure the backend is running at `http://localhost:8081`

## Usage

1. Start both the frontend and backend servers:
   ```bash
   # Terminal 1: Start backend
   cd quickshare
   ./mvnw spring-boot:run
   
   # Terminal 2: Start frontend
   npm run dev
   ```

2. Open two browser windows (one for sending, one for receiving)
2. In the sender window, click "Establish Connection" and copy the connection ID
3. In the receiver window, paste the connection ID and click "Connect"
4. Once connected, select a file in the sender window to begin transfer
5. The receiver will automatically download the file when transfer completes

## Architecture

- Frontend chunks files using `File.slice()`
- Each chunk includes metadata (filename, type, chunk index, total chunks)
- Backend acts as a relay, forwarding chunks without storing them
- Receiver assembles chunks in real-time
- Progress is tracked on both ends
