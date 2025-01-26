import { exec } from 'child_process';
import path from 'path';

const serverPath = path.join(__dirname, 'signaling-server.ts');

console.log('Starting signaling server...');
const server = exec(`ts-node ${serverPath}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
});

server.stdout?.on('data', (data) => {
  console.log(`Server output: ${data}`);
});

server.stderr?.on('data', (data) => {
  console.error(`Server error: ${data}`);
});