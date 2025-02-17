package com.koushik.quickshare.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.koushik.quickshare.handler.TransferHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Bean
    public TransferHandler transferHandler() {
        return new TransferHandler();
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Register native WebSocket endpoint
        registry.addHandler(transferHandler(), "/transfer")
               .setAllowedOriginPatterns("http://localhost:8080");

        // Register SockJS fallback endpoint
        registry.addHandler(transferHandler(), "/transfer")
               .setAllowedOriginPatterns("http://localhost:8080")
               .withSockJS();
    }
}
