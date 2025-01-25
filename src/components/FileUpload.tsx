import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export const FileUpload = ({ onFileSelect }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      className={`glass-card p-12 rounded-xl text-center transition-all duration-300 ${
        isDragActive ? 'border-primary border-2' : ''
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
      <h3 className="text-xl font-semibold mb-2">Drop your file here</h3>
      <p className="text-muted-foreground mb-4">or click to select</p>
      <Button variant="outline">Select File</Button>
    </div>
  );
};