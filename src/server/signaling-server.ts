import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as https from 'https';

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join';
  code: string;
  data: any;
}

// Create HTTP server
const server = http.createServer();

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

const clients = new Map<string, WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected');

  ws.on('message', (message: string) => {
    try {
      const parsedMessage: SignalingMessage = JSON.parse(message.toString());
      console.log('Received message:', parsedMessage.type, 'for code:', parsedMessage.code);

      // Store the client connection with their code
      if (!clients.has(parsedMessage.code)) {
        clients.set(parsedMessage.code, ws);
      }

      // Find the peer associated with this code
      const peer = clients.get(parsedMessage.code);
      if (peer && peer !== ws) {
        // Forward the message to the peer
        peer.send(JSON.stringify(parsedMessage));
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Remove client from the map
    for (const [code, client] of clients.entries()) {
      if (client === ws) {
        clients.delete(code);
      }
    }
  });

  // Send initial connection success message
  ws.send(JSON.stringify({ type: 'connection-success' }));
});

// Start server on port 3001 (avoiding common blocked ports)
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});