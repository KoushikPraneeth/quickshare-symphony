
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface ConnectionFormProps {
  connectionId: string;
  onConnectionIdChange: (value: string) => void;
  onConnect: () => void;
  isConnecting: boolean;
}

export const ConnectionForm = ({
  connectionId,
  onConnectionIdChange,
  onConnect,
  isConnecting,
}: ConnectionFormProps) => {
  return (
    <div className="space-y-4">
      <Input
        placeholder="Enter connection ID"
        value={connectionId}
        onChange={(e) => onConnectionIdChange(e.target.value)}
        disabled={isConnecting}
      />
      <Button 
        className="w-full" 
        onClick={onConnect}
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
  );
};
