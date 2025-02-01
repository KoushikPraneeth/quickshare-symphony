import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

const server = createServer();
const wss = new WebSocketServer({ server });

console.log('Starting WebSocket server...');

const clients = new Map<string, WebSocket>();

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  const clientId = Math.random().toString(36).substring(7);
  clients.set(clientId, ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);
      
      // Broadcast to all clients except sender
      clients.forEach((client, id) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            ...data,
            clientId
          }));
        }
      });
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(clientId);
  });

  // Send client ID back to the connected client
  ws.send(JSON.stringify({ type: 'connection', clientId }));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
});

export default server;