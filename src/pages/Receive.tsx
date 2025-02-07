import React, { useState, useEffect } from 'react';
import { webSocketService } from '@/services/WebSocketService';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Pause, Play, StopCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const Receive = () => {
  const [connectionId, setConnectionId] = useState('');
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      console.log('Cleaning up WebSocket connection...');
      webSocketService.disconnect();
    };
  }, []);

  const handleConnect = async () => {
    try {
      if (!connectionId.trim()) {
        toast.error('Please enter a connection ID');
        return;
      }

      setError(null);
      console.log('Connecting as receiver with ID:', connectionId);

      // Connect WebSocket as receiver
      await webSocketService.connectWebSocket(connectionId, 'receiver');
      
      // Setup receiver to handle incoming file chunks
      webSocketService.setupReceiver(
        // Progress callback
        (progress) => {
          setProgress(progress);
          setIsTransferring(true);
          console.log(`Transfer progress: ${progress.toFixed(1)}%`);
        },
        // File received callback
        (blob, fileName) => {
          console.log(`File received: ${fileName} (${blob.size} bytes)`);
          setIsTransferring(false);
          setProgress(100);
          setCurrentFileName(null);
          
          // Create download link
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          toast.success(`File "${fileName}" received successfully!`);
        }
      );

      setIsConnected(true);
      toast.success('Connected successfully');
      console.log('Receiver connection established');
    } catch (error) {
      console.error('Error connecting:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsConnected(false);
    }
  };

  const handlePauseResume = () => {
    try {
      // TODO: Implement pause/resume functionality
      setIsPaused(!isPaused);
      console.log(`Transfer ${isPaused ? 'resumed' : 'paused'}`);
      toast.info(`Transfer ${isPaused ? 'resumed' : 'paused'}`);
    } catch (error) {
      console.error('Error toggling pause/resume:', error);
      toast.error('Failed to pause/resume transfer');
    }
  };

  const handleCancel = () => {
    try {
      console.log('Cancelling transfer...');
      webSocketService.disconnect();
      setProgress(0);
      setIsTransferring(false);
      setIsPaused(false);
      setIsConnected(false);
      setCurrentFileName(null);
      setError(null);
      toast.info('Transfer cancelled');
    } catch (error) {
      console.error('Error cancelling transfer:', error);
      toast.error('Failed to cancel transfer');
    }
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Receive File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
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
                <p className="text-center">
                  {currentFileName 
                    ? `Receiving: ${currentFileName}` 
                    : 'Connected! Waiting for file...'}
                </p>
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
