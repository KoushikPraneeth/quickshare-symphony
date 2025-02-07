package com.koushik.quickshare.handler;

import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.io.IOException;
import java.util.Map;
import java.util.Base64;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Component
public class TransferHandler extends AbstractWebSocketHandler {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final Logger logger = LoggerFactory.getLogger(TransferHandler.class);
    
    // Map of transfer sessions keyed by connection ID
    private final Map<String, TransferSession> transferSessions = new ConcurrentHashMap<>();

    private static class TransferSession {
        WebSocketSession sender;
        WebSocketSession receiver;
        Queue<byte[]> chunkQueue = new ConcurrentLinkedQueue<>();
        
        public void setSender(WebSocketSession sender) {
            this.sender = sender;
            forwardQueuedChunks();
        }
        
        public void setReceiver(WebSocketSession receiver) {
            this.receiver = receiver;
            forwardQueuedChunks();
        }
        
        public void addChunk(byte[] chunk) {
            if (receiver != null && receiver.isOpen()) {
                // If receiver is connected, send directly
                try {
                    sendChunk(chunk);
                } catch (IOException e) {
                    // If sending fails, queue the chunk
                    logger.error("Failed to send chunk directly, queueing instead", e);
                    chunkQueue.add(chunk);
                }
            } else {
                // If no receiver or receiver is disconnected, queue the chunk
                chunkQueue.add(chunk);
            }
        }
        
        private void forwardQueuedChunks() {
            if (receiver == null || !receiver.isOpen()) return;
            
            while (!chunkQueue.isEmpty()) {
                byte[] chunk = chunkQueue.poll();
                try {
                    sendChunk(chunk);
                } catch (IOException e) {
                    logger.error("Error forwarding queued chunk", e);
                    // Re-queue the failed chunk at the front
                    chunkQueue.offer(chunk);
                    break;
                }
            }
        }

        private void sendChunk(byte[] chunk) throws IOException {
            if (receiver == null || !receiver.isOpen()) {
                throw new IOException("Receiver not connected");
            }

            // Check if receiver is using SockJS or native WebSocket
            String transport = receiver.getUri().toString().toLowerCase();
            if (transport.contains("websocket")) {
                // Native WebSocket - send binary directly
                receiver.sendMessage(new BinaryMessage(chunk));
            } else {
                // SockJS - send as base64 encoded JSON
                String base64Data = Base64.getEncoder().encodeToString(chunk);
                receiver.sendMessage(new TextMessage("{\"type\":\"binary\",\"data\":\"" + base64Data + "\"}"));
            }
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class ConnectionMessage {
        private String type;
        private String id;
        private String role;
        
        public ConnectionMessage() {}
        
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class FileMetadata {
        private String fileName;
        private String mimeType;
        private int totalChunks;
        private int chunkIndex;

        public FileMetadata() {}

        public String getFileName() { return fileName; }
        public void setFileName(String fileName) { this.fileName = fileName; }

        public String getMimeType() { return mimeType; }
        public void setMimeType(String mimeType) { this.mimeType = mimeType; }

        public int getTotalChunks() { return totalChunks; }
        public void setTotalChunks(int totalChunks) { this.totalChunks = totalChunks; }

        public int getChunkIndex() { return chunkIndex; }
        public void setChunkIndex(int chunkIndex) { this.chunkIndex = chunkIndex; }
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        logger.info("WebSocket connection established. Waiting for connection details...");
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        try {
            // Skip handling if it's a binary message encoded as text (ArrayBuffer)
            if (payload.contains("[object ArrayBuffer]")) {
                logger.debug("Skipping ArrayBuffer payload that was sent as text");
                return;
            }

            // Fix missing commas in JSON if needed
            payload = payload.replaceAll("\"(\\w+)\":\"([^\"]+)\"\"", "\"$1\":\"$2\",\"");
            logger.debug("Processing text message payload: {}", payload);

            if (payload.contains("\"type\":\"binary\"")) {
                // Handle base64 encoded binary data
                byte[] binaryData = Base64.getDecoder().decode(
                    objectMapper.readTree(payload).get("data").asText()
                );
                handleBinaryData(session, binaryData);
            } else if (payload.contains("\"type\":\"connection\"")) {
                ConnectionMessage connectionMessage = objectMapper.readValue(payload, ConnectionMessage.class);
                handleConnectionMessage(session, connectionMessage);
            } else {
                // Handle file metadata message
                FileMetadata metadata = objectMapper.readValue(payload, FileMetadata.class);
                handleFileMetadata(session, metadata);
            }
        } catch (Exception e) {
            logger.error("Error handling text message", e);
            logger.error("Failed to parse message: {}", payload, e);
            session.close(CloseStatus.BAD_DATA.withReason("Invalid message format: " + e.getMessage()));
        }
    }

    private void handleBinaryData(WebSocketSession session, byte[] data) throws Exception {
        String sessionId = getSessionId(session);
        TransferSession transferSession = transferSessions.get(sessionId);
        
        if (transferSession != null) {
            transferSession.addChunk(data);
        } else {
            logger.warn("No transfer session found for ID: {}", sessionId);
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
        handleBinaryData(session, message.getPayload().array());
    }

    private void handleFileMetadata(WebSocketSession session, FileMetadata metadata) throws IOException {
        String sessionId = getSessionId(session);
        TransferSession transferSession = transferSessions.get(sessionId);
        
        if (transferSession != null && transferSession.receiver != null && transferSession.receiver.isOpen()) {
            String metadataJson = objectMapper.writeValueAsString(metadata);
            transferSession.receiver.sendMessage(new TextMessage(metadataJson));
            logger.info("File metadata forwarded for session: {}", sessionId);
        } else {
            logger.warn("No receiver available for metadata. Session ID: {}", sessionId);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = getSessionId(session);
        if (sessionId != null) {
            TransferSession transferSession = transferSessions.get(sessionId);
            if (transferSession != null) {
                String role = (String) session.getAttributes().get("role");
                if ("sender".equals(role)) {
                    transferSession.sender = null;
                } else {
                    transferSession.receiver = null;
                }
                
                // Remove the transfer session if both sender and receiver are disconnected
                if (transferSession.sender == null && transferSession.receiver == null) {
                    transferSessions.remove(sessionId);
                }
            }
            logger.info("Connection closed for ID: {}. Status: {}", sessionId, status);
        }
    }

    private void handleConnectionMessage(WebSocketSession session, ConnectionMessage message) {
        try {
            String connectionId = message.getId();
            String role = message.getRole();

            // Store the connection ID and role in the session attributes
            session.getAttributes().put("connectionId", connectionId);
            session.getAttributes().put("role", role);

            // Get or create transfer session
            TransferSession transferSession = transferSessions.computeIfAbsent(
                connectionId, 
                k -> new TransferSession()
            );

            // Update the transfer session with the new connection
            if ("sender".equals(role)) {
                transferSession.setSender(session);
                logger.info("Sender connected with ID: {}", connectionId);
            } else if ("receiver".equals(role)) {
                transferSession.setReceiver(session);
                logger.info("Receiver connected with ID: {}", connectionId);
            }
        } catch (Exception e) {
            logger.error("Error handling connection message", e);
            try {
                session.close(CloseStatus.BAD_DATA.withReason("Invalid connection details"));
            } catch (IOException ex) {
                logger.error("Error closing session", ex);
            }
        }
    }

    private String getSessionId(WebSocketSession session) {
        return (String) session.getAttributes().get("connectionId");
    }
}
