import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/FileUpload';
import { CodeDisplay } from '@/components/CodeDisplay';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { FileSplitter } from '@/utils/FileSplitter';
import { useToast } from '@/hooks/use-toast';
import WebRTCService from '@/utils/WebRTCService';

const Send = () => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [code, setCode] = useState<string>('');
  const [chunks, setChunks] = useState<ArrayBuffer[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const webRTCService = WebRTCService.getInstance();

  useEffect(() => {
    return () => {
      if (code) {
        webRTCService.closeConnection(code);
      }
    };
  }, [code]);

  const handleFileSelect = async (selectedFile: File) => {
    try {
      setFile(selectedFile);
      setProgress(0);
      setIsUploading(true);
      
      console.log('Starting file splitting...');
      const fileChunks = await FileSplitter.splitFile(selectedFile);
      setChunks(fileChunks);
      console.log(`File split into ${fileChunks.length} chunks`);
      
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      setCode(randomCode);
      
      try {
        await webRTCService.createConnection(randomCode);
        
        for (let i = 0; i < fileChunks.length; i++) {
          try {
            await webRTCService.sendData(randomCode, fileChunks[i]);
            const currentProgress = Math.round(((i + 1) / fileChunks.length) * 100);
            setProgress(currentProgress);
          } catch (error) {
            console.error(`Error sending chunk ${i}:`, error);
            toast({
              title: "Error sending file",
              description: "Failed to send chunk. Please try again.",
              variant: "destructive",
            });
            return;
          }
        }
        
        toast({
          title: "File ready to share",
          description: "Share the code with the receiver to start the transfer",
        });
      } catch (error) {
        console.error('Error creating WebRTC connection:', error);
        toast({
          title: "Connection Error",
          description: "Failed to establish connection. Please try again later.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error preparing file:', error);
      toast({
        title: "Error preparing file",
        description: "There was an error preparing your file for transfer",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/50 p-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Send a File</h1>
            <p className="text-muted-foreground">
              Select a file to generate a sharing code
            </p>
          </div>

          {!file && <FileUpload onFileSelect={handleFileSelect} />}

          {file && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="glass-card p-6 rounded-xl">
                <h3 className="font-semibold mb-2">Selected File</h3>
                <p className="text-muted-foreground">{file.name}</p>
                <Progress value={progress} className="mt-4" />
              </div>

              {code && <CodeDisplay code={code} />}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Send;