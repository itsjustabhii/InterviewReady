/**
 * SessionEndedOverlay — shown when the remote peer ends the session.
 */
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Download, Home, Star } from 'lucide-react';

interface Props {
  onDownloadRecording?: () => void;
  hasRecording: boolean;
}

export default function SessionEndedOverlay({ onDownloadRecording, hasRecording }: Props) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-center max-w-md mx-4"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <Star size={28} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Session ended</h2>
        <p className="text-white/50 mb-8">
          Great work! Your feedback and recording will be available in your dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {hasRecording && (
            <button
              onClick={onDownloadRecording}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors"
            >
              <Download size={16} /> Download recording
            </button>
          )}
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Home size={16} /> Go to dashboard
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
