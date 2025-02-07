# Large File Transfer Improvements

## Current Issues
Received error: "No async message support and buffer too small. Buffer size: [8,192], Message size: [8,186]"

This indicates we're hitting WebSocket buffer limitations when trying to transfer large files.

## Required Changes

### 1. FileSplitter.ts Improvements
- Reduce chunk size from 8KB to 1KB for better buffer management
- Implement dynamic chunk sizing based on connection quality
- Increase MAX_CHUNKS limit to handle larger files with smaller chunks
- Add retry logic for failed chunk reads

```typescript
// Example implementation
private static readonly CHUNK_SIZE = 1024; // 1KB chunks
private static readonly MAX_CHUNKS = 1000000; // Increased for smaller chunks
private static readonly MIN_CHUNK_SIZE = 256; // Minimum chunk size
```

### 2. WebSocketService.ts Improvements
- Add connection state management
- Implement automatic reconnection
- Add backpressure handling
- Implement chunk retry queue
- Add connection quality monitoring

```typescript
// Example reconnection logic
private async reconnect(retryCount: number = 0): Promise<void> {
  if (retryCount >= this.MAX_RETRIES) {
    throw new Error('Max reconnection attempts reached');
  }
  // Implement exponential backoff
  await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
  // Attempt reconnection
}
```

### 3. FileAssembler.ts Updates
- Add support for resumable transfers
- Implement progress persistence
- Add chunk verification
- Support partial file assembly

## Implementation Steps

1. Update FileSplitter.ts:
   - Reduce chunk size
   - Add dynamic chunk sizing
   - Improve error handling

2. Update WebSocketService.ts:
   - Add connection management
   - Implement retry logic
   - Add backpressure handling

3. Update FileAssembler.ts:
   - Add resumable transfer support
   - Improve chunk verification

4. Add Transfer State Management:
   - Track transfer progress
   - Support pausing/resuming
   - Handle connection drops

## Testing Plan

1. Test with various file sizes:
   - Small files (<1MB)
   - Medium files (1-100MB)
   - Large files (>100MB)

2. Test network conditions:
   - Good connection
   - Poor connection
   - Intermittent connection

3. Test error scenarios:
   - Connection drops
   - Server restarts
   - Client page refresh

## Success Criteria

1. Successfully transfer files of any size
2. Handle connection interruptions gracefully
3. Provide accurate progress updates
4. Support transfer resume after interruption
5. Maintain data integrity