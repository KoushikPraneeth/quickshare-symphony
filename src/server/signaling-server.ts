import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join';
  code: string;
  data: any;
}

const server = http.createServer();
const wss = new WebSocketServer({ server });
const clients = new Map<string, WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected');

  ws.on('message', (message: string) => {
    try {
      const parsedMessage: SignalingMessage = JSON.parse(message.toString());
      console.log('Received message:', parsedMessage.type, 'for code:', parsedMessage.code);

      if (parsedMessage.type === 'join') {
        clients.set(parsedMessage.code, ws);
        ws.send(JSON.stringify({ type: 'join-success', code: parsedMessage.code }));
        return;
      }

      const peer = clients.get(parsedMessage.code);
      if (peer && peer !== ws) {
        peer.send(JSON.stringify(parsedMessage));
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    for (const [code, client] of clients.entries()) {
      if (client === ws) {
        clients.delete(code);
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.send(JSON.stringify({ type: 'connection-success' }));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server...');
  wss.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});