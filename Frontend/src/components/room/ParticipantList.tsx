import clsx from 'clsx';
import { Mic, MicOff, Video, VideoOff, MonitorOff, Crown } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { Participant } from '../../store/slices/roomSlice';

export default function ParticipantList() {
  const { participants } = useAppSelector((s) => s.room);
  const { user } = useAppSelector((s) => s.auth);

  const list = Object.values(participants).sort((a, b) => {
    // Interviewers first, then self, then others
    if (a.role === 'interviewer' && b.role !== 'interviewer') return -1;
    if (a.userId === user?.id) return -1;
    return 0;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
          Participants ({list.length})
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {list.map((p) => (
          <ParticipantRow key={p.userId} participant={p} isSelf={p.userId === user?.id} />
        ))}
      </div>
    </div>
  );
}

function ParticipantRow({ participant: p, isSelf }: { participant: Participant; isSelf: boolean }) {
  const stateColor = p.connectionState === 'connected' ? 'bg-emerald-400'
    : p.connectionState === 'reconnecting' ? 'bg-yellow-400 animate-pulse'
    : 'bg-white/20';

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 transition-colors">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-sm font-bold text-white/60">
          {p.avatar
            ? <img src={p.avatar} alt={p.displayName} className="w-full h-full object-cover" />
            : p.displayName?.[0]?.toUpperCase()}
        </div>
        <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0f]', stateColor)} />
      </div>

      {/* Name + role */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {p.role === 'interviewer' && <Crown size={10} className="text-yellow-400 flex-shrink-0" />}
          <span className="text-sm font-medium text-white truncate">
            {p.displayName}{isSelf && ' (You)'}
          </span>
        </div>
        <span className="text-[10px] text-white/30 capitalize">{p.role}</span>
      </div>

      {/* Media indicators */}
      <div className="flex items-center gap-1.5">
        {p.micOn
          ? <Mic size={13} className="text-white/40" />
          : <MicOff size={13} className="text-red-400" />
        }
        {p.camOn
          ? <Video size={13} className="text-white/40" />
          : <VideoOff size={13} className="text-red-400" />
        }
        {p.isScreenSharing && <MonitorOff size={13} className="text-blue-400" />}
      </div>
    </div>
  );
}
