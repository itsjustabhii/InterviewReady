/**
 * TopBar — session header with timer, recording indicator, connection status.
 */
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { tickElapsed } from '../../store/slices/roomSlice';
import { Zap, Wifi, WifiOff, Circle } from 'lucide-react';
import clsx from 'clsx';

export default function TopBar(_: { bookingId?: string }) {
  const dispatch = useAppDispatch();
  const { elapsed, socketConnected, peerConnectionState, recordingState, participants } =
    useAppSelector((s) => s.room);

  // Tick every second
  useEffect(() => {
    const iv = setInterval(() => dispatch(tickElapsed()), 1000);
    return () => clearInterval(iv);
  }, [dispatch]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  };

  const onlineCount = Object.values(participants).filter(
    (p) => p.connectionState !== 'disconnected'
  ).length;

  const isConnected = socketConnected && peerConnectionState === 'connected';

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/50 backdrop-blur-xl z-10">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className={clsx('w-2.5 h-2.5 rounded-full', recordingState === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-emerald-400')} />
        <span className="text-sm font-medium text-white/80">
          {recordingState === 'recording' ? 'Recording' : 'Live Session'}
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-white/8 text-xs font-mono text-white/70">
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Centre */}
      <div className="flex items-center gap-2">
        <Zap size={14} className="text-[var(--accent)]" />
        <span className="text-sm font-semibold tracking-tight text-white">InterviewReady</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {recordingState === 'recording' && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
            <Circle size={8} className="fill-red-400 animate-pulse" />
            REC
          </div>
        )}
        <div className={clsx('flex items-center gap-1.5 text-xs', isConnected ? 'text-emerald-400' : 'text-yellow-400')}>
          {isConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span className="hidden sm:inline">{isConnected ? `Connected (${onlineCount})` : 'Reconnecting…'}</span>
        </div>
      </div>
    </div>
  );
}
