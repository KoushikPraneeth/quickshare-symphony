
import React, { useState, useEffect } from 'react';
import { webSocketService } from '@/services/WebSocketService';
import { FileUpload } from '@/components/FileUpload';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Pause, Play, StopCircle } from 'lucide-react';

const Send = () => {
  const [connectionId, setConnectionId] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const handleFileSelect = async (file: File) => {
    try {
      setIsTransferring(true);
      setProgress(0);
      
      await webSocketService.sendFile(file, (progress) => {
        setProgress(progress);
      });
      
      toast.success('File transfer completed');
      setIsTransferring(false);
    } catch (error) {
      console.error('Error sending file:', error);
      toast.error('Failed to send file');
      setIsTransferring(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      // Initialize transfer and get connection ID
      const newConnectionId = await webSocketService.initializeTransfer();
      setConnectionId(newConnectionId);
      
      // Connect WebSocket as sender
      await webSocketService.connectWebSocket(newConnectionId, 'sender');
      
      setIsConnected(true);
      toast.success('Connection established');
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Failed to establish connection');
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup WebSocket connection when component unmounts
      webSocketService.disconnect();
    };
  }, []);

  const handlePauseResume = () => {
    // TODO: Implement pause/resume functionality
    setIsPaused(!isPaused);
    toast.info(`Transfer ${isPaused ? 'resumed' : 'paused'}`);
  };

  const handleCancel = () => {
    webSocketService.disconnect();
    setProgress(0);
    setIsTransferring(false);
    setIsPaused(false);
    setIsConnected(false);
    setConnectionId('');
    toast.info('Transfer cancelled');
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Send File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? 'Connecting...' : 'Establish Connection'}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-center font-mono select-all">{connectionId}</p>
              </div>
              <FileUpload onFileSelect={handleFileSelect} />
              {isTransferring && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {progress.toFixed(1)}% Complete
                    </span>
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePauseResume}
                      >
                        {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        {isPaused ? 'Resume' : 'Pause'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                      >
                        <StopCircle className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Send;
