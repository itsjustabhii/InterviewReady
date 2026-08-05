import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { Interviewer } from '../../types';
import Badge from './Badge';
import StarRating from './StarRating';

interface Props {
  interviewer: Interviewer;
  index?: number;
}

export default function InterviewerCard({ interviewer, index = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
      whileHover={{ y: -6 }}
      className="glass-card group flex flex-col gap-4 rounded-2xl h-full"
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="relative">
          <img
            src={interviewer.avatar}
            alt={interviewer.name}
            className="w-14 h-14 rounded-2xl object-cover"
          />
          {interviewer.available && (
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white dark:border-[#1c1c1e]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base leading-tight">{interviewer.name}</h3>
          <p className="text-sm text-[var(--text-secondary)] truncate">{interviewer.title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-[var(--text-secondary)]">@ {interviewer.company}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">${interviewer.price}</p>
          <p className="text-xs text-[var(--text-secondary)]">/ session</p>
        </div>
      </div>

      {/* Expertise tags */}
      <div className="flex flex-wrap gap-1.5">
        {interviewer.expertise.slice(0, 3).map((tag) => (
          <Badge key={tag} label={tag} />
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm border-t border-[var(--border)] pt-4 mt-auto">
        <div className="flex items-center gap-1.5">
          <StarRating rating={interviewer.rating.average ?? interviewer.rating} />
          <span className="font-semibold text-sm">{typeof interviewer.rating === 'object' ? interviewer.rating.average.toFixed(1) : interviewer.rating}</span>
          <span className="text-[var(--text-secondary)] text-xs">({interviewer.reviews})</span>
        </div>
        <div className="flex items-center gap-1 text-[var(--text-secondary)] text-xs">
          <Users size={12} />
          <span>{interviewer.sessions} sessions</span>
        </div>
      </div>

      <Link
        to={`/interviewers/${interviewer.id}`}
        className="btn-primary w-full text-center"
      >
        View Profile
      </Link>
    </motion.div>
  );
}
