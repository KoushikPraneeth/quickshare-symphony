export const WEBSOCKET_URLS = [
  'ws://localhost:3001',
  'wss://signaling.lovable.dev'
] as const;

export const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  connectionTimeout: 5000
} as const;

export const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:turn.lovable.dev:3478',
      username: 'webrtc',
      credential: 'turnserver'
    }
  ]
} as const;