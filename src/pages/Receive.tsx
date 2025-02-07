
import React, { useState } from 'react';
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
  
  const handleConnect = async () => {
    try {
      if (!connectionId.trim()) {
        toast.error('Please enter a connection ID');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsConnected(true);
      setIsTransferring(true);
      toast.info('Backend implementation required for real connection');
    } catch (error) {
      console.error('Error connecting:', error);
      toast.error('Failed to connect');
    }
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
