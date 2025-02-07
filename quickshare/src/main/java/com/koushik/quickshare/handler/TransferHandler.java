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
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TransferHandler extends AbstractWebSocketHandler {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final Logger logger = LoggerFactory.getLogger(TransferHandler.class);
    
    // Separate maps for sender and receiver sessions, keyed by connection ID
    private final Map<String, WebSocketSession> senderSessions = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> receiverSessions = new ConcurrentHashMap<>();

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

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class BinaryDataMessage {
        private String type;
        private String data;

        public BinaryDataMessage() {}

        public BinaryDataMessage(String type, String data) {
            this.type = type;
            this.data = data;
        }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public String getData() { return data; }
        public void setData(String data) { this.data = data; }
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
                BinaryDataMessage binaryMsg = objectMapper.readValue(payload, BinaryDataMessage.class);
                byte[] binaryData = Base64.getDecoder().decode(binaryMsg.getData());
                handleBinaryData(session, binaryData);
            } else if (payload.contains("\"type\":\"connection\"")) {
                ConnectionMessage connectionMessage = objectMapper.readValue(payload, ConnectionMessage.class);
                logger.debug("Deserialized connection message - type: {}, id: {}, role: {}", 
                    connectionMessage.getType(), 
                    connectionMessage.getId(), 
                    connectionMessage.getRole());
                handleConnectionMessage(session, connectionMessage);
            } else {
                // Handle file metadata message
                FileMetadata fileMetadata = objectMapper.readValue(payload, FileMetadata.class);
                logger.debug("Deserialized file metadata - fileName: {}, mimeType: {}, chunk: {}/{}", 
                    fileMetadata.getFileName(),
                    fileMetadata.getMimeType(),
                    fileMetadata.getChunkIndex(),
                    fileMetadata.getTotalChunks());
                handleFileMetadata(session, fileMetadata);
            }
        } catch (Exception e) {
            logger.error("Error handling text message", e);
            logger.error("Failed to parse message: {}", payload, e);
            session.close(CloseStatus.BAD_DATA.withReason("Invalid message format: " + e.getMessage()));
        }
    }

    private void handleBinaryData(WebSocketSession session, byte[] data) throws Exception {
        try {
            handleBinaryMessage(session, new BinaryMessage(java.nio.ByteBuffer.wrap(data)));
        } catch (Exception e) {
            logger.error("Error handling binary data", e);
            session.close(CloseStatus.SERVER_ERROR.withReason("Error processing binary data"));
            throw e;
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, org.springframework.web.socket.BinaryMessage message) throws Exception {
        try {
            String sessionId = getSessionId(session);
            String role = (String) session.getAttributes().get("role");
            WebSocketSession pairedSession = null;

            if ("sender".equals(role)) {
                pairedSession = receiverSessions.get(sessionId);
            } else if ("receiver".equals(role)) {
                pairedSession = senderSessions.get(sessionId);
            }

            if (pairedSession != null && pairedSession.isOpen()) {
                // Check if paired session is using SockJS or native WebSocket
                String transport = pairedSession.getUri().toString().toLowerCase();
                if (transport.contains("websocket")) {
                    // Native WebSocket - send binary directly
                    pairedSession.sendMessage(message);
                } else {
                    // SockJS - send as base64 encoded JSON
                    String base64Data = Base64.getEncoder().encodeToString(message.getPayload().array());
                    pairedSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(
                        new BinaryDataMessage("binary", base64Data)
                    )));
                }
            } else {
                logger.warn("No paired session available for session: {}. {} waiting for {}", 
                    sessionId, role, "sender".equals(role) ? "receiver" : "sender");
            }
        } catch (IOException e) {
            logger.error("Error handling binary message", e);
            try {
                session.close(CloseStatus.SERVER_ERROR.withReason("Internal server error"));
            } catch (IOException ex) {
                logger.error("Error closing WebSocket session", ex);
            }
        }
    }

    private void handleFileMetadata(WebSocketSession session, FileMetadata metadata) throws IOException {
        String sessionId = getSessionId(session);
        String role = (String) session.getAttributes().get("role");
        WebSocketSession pairedSession = null;

        if ("sender".equals(role)) {
            pairedSession = receiverSessions.get(sessionId);
        } else if ("receiver".equals(role)) {
            pairedSession = senderSessions.get(sessionId);
        }

        if (pairedSession != null && pairedSession.isOpen()) {
            // Forward the metadata message to the paired session
            String metadataJson = objectMapper.writeValueAsString(metadata);
            pairedSession.sendMessage(new TextMessage(metadataJson));
            logger.info("File metadata forwarded for session: {}", sessionId);
        } else {
            logger.warn("No paired session available for session: {}. {} waiting for {}", 
                sessionId, role, "sender".equals(role) ? "receiver" : "sender");
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = getSessionId(session);
        String role = (String) session.getAttributes().get("role");
        if (sessionId != null) {
            if ("sender".equals(role)) {
                senderSessions.remove(sessionId);
            } else if ("receiver".equals(role)) {
                receiverSessions.remove(sessionId);
            }
            logger.info("Connection closed for ID: {}. Status: {}", sessionId, status);
        }
    }

    private void handleConnectionMessage(WebSocketSession session, ConnectionMessage message) {
        try {
            String connectionId = message.id;
            String role = message.role;

            // Store the connection ID and role in the session attributes for later use
            session.getAttributes().put("connectionId", connectionId);
            session.getAttributes().put("role", role);

            // Store session in the appropriate map based on its role
            if ("sender".equals(role)) {
                senderSessions.put(connectionId, session);
                logger.info("Sender connected with ID: {}", connectionId);

                // If a receiver is already waiting for this sender, log the pairing event
                if (receiverSessions.containsKey(connectionId)) {
                    logger.info("Pairing complete. Receiver found for sender ID: {}", connectionId);
                }
            } else if ("receiver".equals(role)) {
                receiverSessions.put(connectionId, session);
                logger.info("Receiver connected with ID: {}", connectionId);

                // If a sender is already connected, log the pairing event
                if (senderSessions.containsKey(connectionId)) {
                    logger.info("Pairing complete. Sender found for receiver ID: {}", connectionId);
                }
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
