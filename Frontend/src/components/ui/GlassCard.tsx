import { motion } from 'framer-motion';
import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  onClick?: () => void;
}

const paddings = { sm: 'p-4', md: 'p-6', lg: 'p-8', none: '' };

export default function GlassCard({ children, className, hover, padding = 'md', onClick }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -4, scale: 1.01 } : undefined}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={clsx(
        'glass-card',
        paddings[padding],
        hover && 'cursor-pointer',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
