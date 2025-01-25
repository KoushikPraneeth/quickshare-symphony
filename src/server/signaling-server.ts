import WebSocket from 'ws';

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  code: string;
  data: any;
}

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map<string, WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected');

  ws.on('message', (message: string) => {
    try {
      const parsedMessage: SignalingMessage = JSON.parse(message);
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
});

console.log('Signaling server running on ws://localhost:8080');