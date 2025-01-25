import React from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface CodeDisplayProps {
  code: string;
}

export const CodeDisplay = ({ code }: CodeDisplayProps) => {
  const { toast } = useToast();

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copied!",
      description: "Share this code with the receiver",
    });
  };

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-lg font-semibold mb-2">Share this code</h3>
      <div className="flex items-center gap-2">
        <code className="bg-secondary px-4 py-2 rounded-lg flex-1 font-mono text-lg">
          {code}
        </code>
        <Button variant="ghost" size="icon" onClick={copyCode}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};