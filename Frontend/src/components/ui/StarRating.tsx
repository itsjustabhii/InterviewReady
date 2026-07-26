import { Star } from 'lucide-react';
import clsx from 'clsx';

export default function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={clsx(
            i < Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-[var(--border)]'
          )}
        />
      ))}
    </div>
  );
}
