
import React from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Pause, Play, StopCircle } from 'lucide-react';
import { formatFileSize } from '@/utils/formatters';

interface TransferProgressProps {
  currentFileName: string | null;
  currentFileSize: number | null;
  progress: number;
  isPaused: boolean;
  isTransferring: boolean;
  onPauseResume: () => void;
  onCancel: () => void;
}

export const TransferProgress = ({
  currentFileName,
  currentFileSize,
  progress,
  isPaused,
  isTransferring,
  onPauseResume,
  onCancel,
}: TransferProgressProps) => {
  return (
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
                onClick={onPauseResume}
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
                onClick={onCancel}
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
  );
};
