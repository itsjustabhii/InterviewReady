import { useRef, useEffect } from 'react';
import { Mic, MicOff, Monitor } from 'lucide-react';
import clsx from 'clsx';
import type { Participant } from '../../store/slices/roomSlice';

interface Props {
  participant: Participant;
  stream: MediaStream | null;
  isLocal?: boolean;
  isLarge?: boolean;
}

export default function VideoTile({ participant, stream, isLocal, isLarge }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const isConnected = participant.connectionState === 'connected';
  const showVideo = (isLocal ? participant.camOn : isConnected) && stream;

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl bg-[#111118] border border-white/5 flex items-center justify-center',
        isLarge ? 'aspect-video' : 'aspect-video'
      )}
    >
      {/* Video element */}
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={clsx(
            'w-full h-full object-cover',
            isLocal && 'scale-x-[-1]' // mirror local video
          )}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 text-white/30">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-white/50">
            {participant.displayName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="text-xs">{participant.isScreenSharing ? 'Screen sharing' : 'Camera off'}</span>
        </div>
      )}

      {/* Screen share overlay indicator */}
      {participant.isScreenSharing && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-blue-500/90 rounded-lg text-white text-xs font-medium">
          <Monitor size={11} />
          Sharing screen
        </div>
      )}

      {/* Connection state */}
      {!isLocal && participant.connectionState === 'reconnecting' && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-white/60">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-xs">Reconnecting…</span>
          </div>
        </div>
      )}

      {/* Name + mic indicator */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/60 rounded-lg backdrop-blur-sm">
          {participant.micOn
            ? <Mic size={11} className="text-white/70" />
            : <MicOff size={11} className="text-red-400" />
          }
          <span className="text-xs text-white font-medium truncate max-w-[120px]">
            {participant.displayName}{isLocal ? ' (You)' : ''}
          </span>
        </div>
        <div className={clsx(
          'w-2 h-2 rounded-full',
          isLocal ? 'bg-emerald-400'
            : isConnected ? 'bg-emerald-400'
            : 'bg-yellow-400 animate-pulse'
        )} />
      </div>
    </div>
  );
}
