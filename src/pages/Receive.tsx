import React, { useState } from 'react';
import { WebRTCService } from '@/utils/WebRTCService';
import { FileAssembler } from '@/utils/FileAssembler';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const Receive = () => {
  const [connectionId, setConnectionId] = useState('');
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  
  const handleConnect = async () => {
    try {
      if (!connectionId.trim()) {
        toast.error('Please enter a connection ID');
        return;
      }

      const webRTCService = await WebRTCService.getInstance();
      const fileAssembler = new FileAssembler();

      webRTCService.onData((data) => {
        if (data.type === 'chunk') {
          fileAssembler.addChunk(data.data, data.metadata);
          setProgress((data.metadata.chunkIndex + 1) / data.metadata.totalChunks * 100);
          
          if (data.metadata.chunkIndex + 1 === data.metadata.totalChunks) {
            const file = fileAssembler.assembleFile();
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.metadata.fileName;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('File received successfully!');
          }
        }
      });

      await webRTCService.connect(connectionId);
      setIsConnected(true);
      toast.success('Connected successfully!');
    } catch (error) {
      console.error('Error connecting:', error);
      toast.error('Failed to connect');
    }
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

export default Receive;