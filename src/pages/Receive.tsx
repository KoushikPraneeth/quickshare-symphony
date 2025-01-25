import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { FileAssembler } from '@/utils/FileAssembler';
import { useToast } from '@/components/ui/use-toast';

const Receive = () => {
  const [code, setCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [receivedChunks, setReceivedChunks] = useState<Blob[]>([]);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    setProgress(0);
    
    try {
      // Simulate receiving chunks for now
      let currentProgress = 0;
      const interval = setInterval(async () => {
        currentProgress += 5;
        setProgress(currentProgress);
        
        if (currentProgress >= 100) {
          clearInterval(interval);
          
          try {
            console.log('Assembling chunks...');
            const finalFile = await FileAssembler.assembleChunks(receivedChunks);
            console.log('File assembled successfully');
            
            // Create a download link
            const url = URL.createObjectURL(finalFile);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'downloaded-file'; // This will be replaced with actual filename
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            toast({
              title: "Download complete",
              description: "Your file has been downloaded successfully",
            });
          } catch (error) {
            console.error('Error assembling file:', error);
            toast({
              title: "Error downloading file",
              description: "There was an error assembling the file chunks",
              variant: "destructive",
            });
          }
        }
      }, 200);
    } catch (error) {
      console.error('Error receiving file:', error);
      toast({
        title: "Error receiving file",
        description: "There was an error receiving the file chunks",
        variant: "destructive",
      });
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
            <h1 className="text-3xl font-bold mb-2">Receive a File</h1>
            <p className="text-muted-foreground">
              Enter the code shared by the sender
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="glass-card p-6 rounded-xl">
              <Input
                type="text"
                placeholder="Enter code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="text-center text-2xl tracking-wider uppercase"
                maxLength={6}
              />
            </div>

            {!isConnecting && (
              <Button type="submit" className="w-full" disabled={code.length !== 6}>
                Connect
              </Button>
            )}

            {isConnecting && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-6 rounded-xl space-y-4"
              >
                <h3 className="font-semibold">Receiving File...</h3>
                <Progress value={progress} />
              </motion.div>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default Receive;