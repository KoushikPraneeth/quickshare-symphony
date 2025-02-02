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

  // Send immediate confirmation of connection
  ws.send(JSON.stringify({ type: 'connection', clientId }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);
      
      if (data.targetId) {
        // Direct message to specific client
        const targetClient = clients.get(data.targetId);
        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
          targetClient.send(JSON.stringify({
            ...data,
            clientId
          }));
        }
      } else {
        // Broadcast to all clients except sender
        clients.forEach((client, id) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              ...data,
              clientId
            }));
          }
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected:', clientId);
    clients.delete(clientId);
    // Notify other clients about disconnection
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'peer-disconnected',
          clientId
        }));
      }
    });
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(clientId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
});

export default server;