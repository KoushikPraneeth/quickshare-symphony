
import React, { useState } from 'react';
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
    setIsTransferring(true);
    setProgress(0);
    toast.info('Backend implementation required');
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setTimeout(() => {
      const mockConnectionId = Math.random().toString(36).substring(7);
      setConnectionId(mockConnectionId);
      setIsConnected(true);
      setIsConnecting(false);
      toast.info('Backend implementation required for real connection');
    }, 1000);
  };

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
    toast.info(`Transfer ${isPaused ? 'resumed' : 'paused'}`);
  };

  const handleCancel = () => {
    setProgress(0);
    setIsTransferring(false);
    setIsPaused(false);
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
