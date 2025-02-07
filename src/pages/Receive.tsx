
import React, { useState, useEffect } from 'react';
import { webSocketService } from '@/services/WebSocketService';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Pause, Play, StopCircle } from 'lucide-react';

const Receive = () => {
  const [connectionId, setConnectionId] = useState('');
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  
  useEffect(() => {
    return () => {
      // Cleanup WebSocket connection when component unmounts
      webSocketService.disconnect();
    };
  }, []);

  const handleConnect = async () => {
    try {
      if (!connectionId.trim()) {
        toast.error('Please enter a connection ID');
        return;
      }

      // Connect WebSocket as receiver
      await webSocketService.connectWebSocket(connectionId, 'receiver');
      
      // Setup receiver to handle incoming file chunks
      webSocketService.setupReceiver(
        // Progress callback
        (progress) => {
          setProgress(progress);
          setIsTransferring(true);
        },
        // File received callback
        (blob, fileName) => {
          setIsTransferring(false);
          setProgress(100);
          
          // Create download link
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          toast.success('File received successfully!');
        }
      );

      setIsConnected(true);
      toast.success('Connected successfully');
    } catch (error) {
      console.error('Error connecting:', error);
      toast.error('Failed to connect');
      setIsConnected(false);
    }
  };

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
    toast.info('Transfer cancelled');
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Receive File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <div className="space-y-4">
              <Input
                placeholder="Enter connection ID"
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
              />
              <Button 
                className="w-full" 
                onClick={handleConnect}
              >
                Connect
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-center">Connected! Waiting for file...</p>
              </div>
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

export default Receive;
