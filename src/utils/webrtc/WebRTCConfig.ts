export const WEBSOCKET_URLS = [
  process.env.NODE_ENV === 'production' ? 'wss://signaling.lovable.dev' : 'ws://localhost:3001',
  'wss://ws.postman-echo.com/raw'
] as const;

export const RETRY_CONFIG = {
  maxRetries: 5,
  retryDelay: 2000
} as const;