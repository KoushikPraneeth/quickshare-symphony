import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';

const Receive = () => {
  const [code, setCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    
    // Simulate progress for now
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 5;
      setProgress(currentProgress);
      if (currentProgress >= 100) {
        clearInterval(interval);
      }
    }, 200);
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