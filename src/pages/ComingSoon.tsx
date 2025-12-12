import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

const ComingSoon = ({ title }: { title: string }) => {
  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Construction className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground">Cette fonctionnalité sera disponible prochainement.</p>
      </motion.div>
    </div>
  );
};

export default ComingSoon;
