import React, { useState, useCallback } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { WebRTCService } from '@/utils/WebRTCService';
import { FileSplitter } from '@/utils/FileSplitter';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const Send = () => {
  const [connectionId, setConnectionId] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const handleFileSelect = async (file: File) => {
    try {
      if (!isConnected) {
        toast.error('Please establish connection first');
        return;
      }

      const webRTCService = await WebRTCService.getInstance();
      const fileSplitter = new FileSplitter();
      
      const chunks = await fileSplitter.splitFile(file);
      const totalChunks = chunks.length;
      
      for (let i = 0; i < chunks.length; i++) {
        await webRTCService.sendData({
          type: 'chunk',
          data: chunks[i],
          metadata: {
            fileName: file.name,
            chunkIndex: i,
            totalChunks,
            mimeType: file.type
          }
        });
        
        setProgress(((i + 1) / totalChunks) * 100);
      }
      
      toast.success('File sent successfully!');
    } catch (error) {
      console.error('Error sending file:', error);
      toast.error('Failed to send file');
    }
  };

  const handleConnect = async () => {
    try {
      const webRTCService = await WebRTCService.getInstance();
      const id = await webRTCService.createConnection();
      setConnectionId(id);
      setIsConnected(true);
      toast.success('Connection established! Share this ID with the receiver');
    } catch (error) {
      console.error('Error creating connection:', error);
      toast.error('Failed to establish connection');
    }
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Send File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <button
              onClick={handleConnect}
              className="w-full p-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Establish Connection
            </button>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-center font-mono">{connectionId}</p>
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