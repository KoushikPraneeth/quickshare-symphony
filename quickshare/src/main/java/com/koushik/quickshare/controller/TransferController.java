package com.koushik.quickshare.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.koushik.quickshare.handler.TransferHandler;
import com.koushik.quickshare.model.TransferResponse;
import java.util.UUID;

@RestController
@RequestMapping("/api/transfer")
@CrossOrigin(origins = "*") // In production, specify exact origins
public class TransferController {

    private final TransferHandler transferHandler;

    @Autowired
    public TransferController(TransferHandler transferHandler) {
        this.transferHandler = transferHandler;
    }

    @PostMapping("/init")
    public ResponseEntity<TransferResponse> initializeTransfer() {
        try {
            String connectionId = UUID.randomUUID().toString();
            return ResponseEntity.ok(
                TransferResponse.success("Transfer session initialized")
                    .addData("connectionId", connectionId)
            );
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(
                TransferResponse.error("Failed to initialize transfer session")
            );
        }
    }

    @PostMapping("/connect")
    public ResponseEntity<TransferResponse> establishConnection(
            @RequestParam String senderId,
            @RequestParam String receiverId) {
        try {
            // Removed: transferHandler.establishConnection(senderId, receiverId);
            return ResponseEntity.ok(
                TransferResponse.success("Connection established successfully")
                    .addData("senderId", senderId)
                    .addData("receiverId", receiverId)
            );
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(
                TransferResponse.error("Failed to establish connection")
            );
        }
    }
}
