
import React, { useState, useEffect } from 'react';
import { webSocketService } from '@/services/WebSocketService';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Loader2, Pause, Play, StopCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatFileSize } from '@/utils/formatters';

const Receive = () => {
  const [connectionId, setConnectionId] = useState('');
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [currentFileSize, setCurrentFileSize] = useState<number | null>(null);

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
      setIsConnecting(true);
      console.log('Connecting as receiver with ID:', connectionId);

      await webSocketService.connectWebSocket(connectionId, 'receiver');
      
      webSocketService.setupReceiver(
        (progress) => {
          setProgress(progress);
          setIsTransferring(true);
          console.log(`Transfer progress: ${progress.toFixed(1)}%`);
        },
        (blob, fileName) => {
          console.log(`File received: ${fileName} (${blob.size} bytes)`);
          setIsTransferring(false);
          setProgress(100);
          setCurrentFileName(null);
          setCurrentFileSize(null);
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          toast.success(`File "${fileName}" received successfully!`);
        },
        (metadata) => {
          if (metadata.fileName && metadata.fileSize) {
            setCurrentFileName(metadata.fileName);
            setCurrentFileSize(metadata.fileSize);
          }
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
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePauseResume = () => {
    try {
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
      setCurrentFileSize(null);
      setError(null);
      toast.info('Transfer cancelled');
    } catch (error) {
      console.error('Error cancelling transfer:', error);
      toast.error('Failed to cancel transfer');
    }
  };

  const getConnectionStatus = () => {
    if (isConnecting) return { message: 'Connecting...', color: 'text-blue-500' };
    if (isConnected) return { message: 'Connected', color: 'text-green-500' };
    return { message: 'Disconnected', color: 'text-red-500' };
  };

  const status = getConnectionStatus();

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Receive File</span>
            <span className={`text-sm ${status.color} flex items-center gap-2`}>
              {isConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
              {status.message}
            </span>
          </CardTitle>
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
                disabled={isConnecting}
              />
              <Button 
                className="w-full" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-center">
                  {currentFileName 
                    ? `Receiving: ${currentFileName} (${currentFileSize ? formatFileSize(currentFileSize) : 'Unknown size'})` 
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
                        variant={isPaused ? "default" : "secondary"}
                        size="sm"
                        onClick={handlePauseResume}
                        className="transition-colors duration-200"
                      >
                        {isPaused ? (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            Resume
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4 mr-1" />
                            Pause
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        disabled={!isTransferring}
                      >
                        <StopCircle className="h-4 w-4 mr-1" />
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
