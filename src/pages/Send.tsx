import React, { useEffect, useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { webSocketService } from '@/services/WebSocketService';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Pause, Play, StopCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const Send = () => {
  const [file, setFile] = useState<File | null>(null);
  const [connectionId, setConnectionId] = useState('');
  const [generatedConnectionId, setGeneratedConnectionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
      console.log('Connecting as sender with ID:', connectionId);
      
      await webSocketService.connectWebSocket(connectionId, 'sender');
      setIsConnected(true);
      toast.success('Connected successfully');
      console.log('Sender connection established');
    } catch (error) {
      console.error('Error connecting:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsConnected(false);
    }
  };

  const handleGenerateId = async () => {
    try {
      const newConnectionId = await webSocketService.initializeTransfer();
      setGeneratedConnectionId(newConnectionId);
      setConnectionId(newConnectionId);
    } catch (error) {
      console.error('Error generating connection ID:', error);
      toast.error('Failed to generate connection ID');
    }
  };

  const handleFileSelected = (selectedFile: File) => {
    console.log('File selected:', selectedFile.name);
    setFile(selectedFile);
  };

  const handleSendFile = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setError(null);
      setIsTransferring(true);
      console.log(`Starting file transfer: ${file.name} (${file.size} bytes)`);
      
      await webSocketService.sendFile(file, (progress) => {
        setProgress(progress);
        console.log(`Transfer progress: ${progress.toFixed(1)}%`);
      });

      console.log('File transfer completed successfully');
      toast.success('File sent successfully!');
      setIsTransferring(false);
      setProgress(100);
    } catch (error) {
      console.error('Error sending file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send file';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsTransferring(false);
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
          <CardTitle>Send File</CardTitle>
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
              <Button className="w-full" onClick={handleConnect}>
                Connect
              </Button>
              <Button className="w-full" variant="secondary" onClick={handleGenerateId}>
                Generate Connection ID
              </Button>
            </div>
          ) : generatedConnectionId ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-center">
                  Connection ID: {generatedConnectionId}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <FileUpload onFileSelect={handleFileSelected} />
              </div>

              {file && !isTransferring && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Selected file: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                  <Button className="w-full" onClick={handleSendFile}>
                    Send File
                  </Button>
                </div>
              )}

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
          ) : (
            <div>Error: Connection ID not generated.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Send;
