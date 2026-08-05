import clsx from 'clsx';
import {
  Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff,
  PhoneOff, Circle, Square, Download, MessageSquare, Code, Users,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setActivePanel } from '../../store/slices/roomSlice';

interface Props {
  onToggleMic: () => void;
  onToggleCam: () => void;
  onScreenShare: () => void;
  onEndCall: () => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onDownloadRecord: () => void;
  hasRecordingBlob: boolean;
}

export default function ControlBar({
  onToggleMic, onToggleCam, onScreenShare, onEndCall,
  onStartRecord, onStopRecord, onDownloadRecord, hasRecordingBlob,
}: Props) {
  const dispatch = useAppDispatch();
  const { micOn, camOn, isScreenSharing, recordingState, activePanel, unreadCount } =
    useAppSelector((s) => s.room);

  const isRecording = recordingState === 'recording';

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-black/30 backdrop-blur-sm">
      {/* Left: timer placeholder */}
      <div className="w-24" />

      {/* Centre: media controls */}
      <div className="flex items-center gap-2">
        <CtrlBtn
          active={micOn}
          icon={micOn ? <Mic size={18} /> : <MicOff size={18} />}
          label={micOn ? 'Mute' : 'Unmute'}
          onClick={onToggleMic}
          danger={!micOn}
        />
        <CtrlBtn
          active={camOn}
          icon={camOn ? <Video size={18} /> : <VideoOff size={18} />}
          label={camOn ? 'Stop cam' : 'Start cam'}
          onClick={onToggleCam}
          danger={!camOn}
        />
        <CtrlBtn
          active={!isScreenSharing}
          icon={isScreenSharing ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
          label={isScreenSharing ? 'Stop share' : 'Share screen'}
          onClick={onScreenShare}
          highlight={isScreenSharing}
        />

        {/* Record */}
        {!isRecording ? (
          <CtrlBtn icon={<Circle size={18} className="text-red-400" />} label="Record" onClick={onStartRecord} active />
        ) : (
          <CtrlBtn icon={<Square size={18} />} label="Stop rec" onClick={onStopRecord} active danger />
        )}
        {hasRecordingBlob && (
          <CtrlBtn icon={<Download size={14} />} label="Download" onClick={onDownloadRecord} active />
        )}

        {/* End call */}
        <button
          onClick={onEndCall}
          className="flex flex-col items-center gap-1 px-5 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-all ml-2"
        >
          <PhoneOff size={18} />
          <span className="text-[10px] font-medium">End call</span>
        </button>
      </div>

      {/* Right: panel toggles */}
      <div className="flex items-center gap-1">
        <PanelBtn
          icon={<MessageSquare size={16} />}
          label="Chat"
          badge={unreadCount}
          active={activePanel === 'chat'}
          onClick={() => dispatch(setActivePanel('chat'))}
        />
        <PanelBtn
          icon={<Code size={16} />}
          label="Code"
          active={activePanel === 'code'}
          onClick={() => dispatch(setActivePanel('code'))}
        />
        <PanelBtn
          icon={<Users size={16} />}
          label="People"
          active={activePanel === 'participants'}
          onClick={() => dispatch(setActivePanel('participants'))}
        />
      </div>
    </div>
  );
}

function CtrlBtn({ icon, label, active, onClick, danger, highlight }: {
  icon: React.ReactNode; label: string; active?: boolean;
  onClick?: () => void; danger?: boolean; highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl transition-all text-white/70',
        active && !danger && !highlight && 'hover:bg-white/10 hover:text-white',
        danger && 'bg-red-500/15 text-red-400 hover:bg-red-500/25',
        highlight && 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
      )}
    >
      {icon}
      <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
    </button>
  );
}

function PanelBtn({ icon, label, active, onClick, badge }: {
  icon: React.ReactNode; label: string; active?: boolean;
  onClick?: () => void; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all text-sm',
        active ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'
      )}
    >
      {icon}
      <span className="text-[9px]">{label}</span>
      {badge ? (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[9px] flex items-center justify-center font-bold">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  );
}
