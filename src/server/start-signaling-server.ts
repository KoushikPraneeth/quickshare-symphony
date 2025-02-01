import { exec } from 'child_process';
import path from 'path';

const serverPath = path.join(__dirname, 'signaling-server.ts');

console.log('Starting signaling server...');

const server = exec(`ts-node ${serverPath}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error starting server: ${error}`);
    return;
  }
  if (stderr) {
    console.error(`Server stderr: ${stderr}`);
    return;
  }
  console.log(`Server stdout: ${stdout}`);
});

// Handle server output
server.stdout?.on('data', (data) => {
  console.log(`Server output: ${data}`);
});

server.stderr?.on('data', (data) => {
  console.error(`Server error: ${data}`);
});

// Ensure server is killed on process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Killing server process...');
  server.kill();
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Killing server process...');
  server.kill();
});