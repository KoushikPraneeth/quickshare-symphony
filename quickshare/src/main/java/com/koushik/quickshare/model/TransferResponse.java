package com.koushik.quickshare.model;

import java.util.HashMap;
import java.util.Map;

public class TransferResponse {
    private boolean success;
    private String message;
    private Map<String, Object> data;

    public TransferResponse() {
        this.data = new HashMap<>();
    }

    public static TransferResponse success(String message) {
        TransferResponse response = new TransferResponse();
        response.setSuccess(true);
        response.setMessage(message);
        return response;
    }

    public static TransferResponse error(String message) {
        TransferResponse response = new TransferResponse();
        response.setSuccess(false);
        response.setMessage(message);
        return response;
    }

    public TransferResponse addData(String key, Object value) {
        this.data.put(key, value);
        return this;
    }

    // Getters and Setters
    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Map<String, Object> getData() {
        return data;
    }

    public void setData(Map<String, Object> data) {
        this.data = data;
    }
}
