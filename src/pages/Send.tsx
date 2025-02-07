
import React, { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

const Send = () => {
  const [connectionId, setConnectionId] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleFileSelect = async (file: File) => {
    toast.info('Backend implementation required');
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate connection delay
    setTimeout(() => {
      const mockConnectionId = Math.random().toString(36).substring(7);
      setConnectionId(mockConnectionId);
      setIsConnected(true);
      setIsConnecting(false);
      toast.info('Backend implementation required for real connection');
    }, 1000);
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
              {progress > 0 && (
                <Progress value={progress} className="w-full" />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Send;
