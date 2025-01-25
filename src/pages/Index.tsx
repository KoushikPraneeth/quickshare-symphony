import React from 'react';
import { Link } from 'react-router-dom';
import { Send, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/50">
      <div className="max-w-md w-full mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">QuickShare</h1>
          <p className="text-muted-foreground">Secure peer-to-peer file sharing</p>
        </motion.div>
        
        <div className="space-y-4">
          <Link to="/send">
            <Button className="w-full h-16 text-lg" variant="default">
              <Send className="mr-2 h-5 w-5" />
              Send a File
            </Button>
          </Link>
          
          <Link to="/receive">
            <Button className="w-full h-16 text-lg" variant="outline">
              <Download className="mr-2 h-5 w-5" />
              Receive a File
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;