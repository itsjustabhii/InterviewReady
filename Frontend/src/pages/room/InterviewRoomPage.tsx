/**
 * InterviewRoomPage
 * ─────────────────────────────────────────────────────────────────────────────
 * Full real-time WebRTC video interview room.
 *
 * Architecture:
 *   useSocket        — Socket.IO /webrtc connection; dispatches all events to Redux
 *   useWebRTC        — RTCPeerConnection lifecycle; perfect-negotiation
 *   useMediaControls — getUserMedia, mic/cam toggle, screen share, MediaRecorder
 *   roomSlice        — all room state (participants, chat, code, recording)
 *
 * Layout:
 *   ┌────────────────────────────────────────┐
 *   │              TopBar (timer/status)      │
 *   ├────────────────────────────┬───────────┤
 *   │   Video grid               │ Side panel │
 *   │   (remote + local tiles)   │ chat/code/ │
 *   │                            │ people     │
 *   ├────────────────────────────┴───────────┤
 *   │              ControlBar                 │
 *   └────────────────────────────────────────┘
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  initRoom, resetRoom, setActivePanel,
  updateParticipantMedia,
} from '../../store/slices/roomSlice';
import { useSocket } from '../../hooks/useSocket';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useMediaControls } from '../../hooks/useMediaControls';
import VideoTile from '../../components/room/VideoTile';
import ControlBar from '../../components/room/ControlBar';
import ChatPanel from '../../components/room/ChatPanel';
import CodePanel from '../../components/room/CodePanel';
import ParticipantList from '../../components/room/ParticipantList';
import TopBar from '../../components/room/TopBar';
import SessionEndedOverlay from '../../components/room/SessionEndedOverlay';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { PageLoader } from '../../components/ui/Loader';
import clsx from 'clsx';

export default function InterviewRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId') ?? '';
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { user } = useAppSelector((s) => s.auth);
  const { participants, sessionEnded, activePanel, sessionId } = useAppSelector((s) => s.room);

  // ── Step 1: fetch ICE server config from backend ───────────────────────────
  const [bootstrapped, setBootstrapped] = useState(false);
  useEffect(() => {
    if (!bookingId) { setBootstrapped(true); return; }

    api.get(`/sessions/room/${bookingId}`)
      .then(({ data }) => {
        dispatch(initRoom({
          roomId: data.data.roomId,
          sessionId: data.data.sessionId,
          iceServers: data.data.iceServers,
        }));
        setBootstrapped(true);
      })
      .catch(() => {
        // Fallback for demo/direct link — use public Google STUN
        dispatch(initRoom({
          roomId: roomId ?? '',
          sessionId: '',
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        }));
        setBootstrapped(true);
      });

    return () => { dispatch(resetRoom()); };
  }, [bookingId, roomId, dispatch]);

  // ── Media refs ─────────────────────────────────────────────────────────────
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // ── Socket hook ────────────────────────────────────────────────────────────
  const socketRef = useSocket(bootstrapped ? (roomId ?? null) : null);

  // ── Identify remote peer ───────────────────────────────────────────────────
  const remoteParticipant = Object.values(participants).find(
    (p) => p.userId !== user?.id && p.connectionState !== 'disconnected'
  );
  const selfParticipant = user?.id ? participants[user.id] : null;

  // Am I the "polite" peer? The user (interviewee) is always polite.
  const isSelf = user?.role !== 'interviewer';

  // ── WebRTC hook ────────────────────────────────────────────────────────────
  const { peerRef, remoteStream } = useWebRTC(
    socketRef,
    localStreamRef,
    roomId ?? null,
    remoteParticipant?.userId ?? null,
    isSelf,
  );

  // ── Media controls hook ────────────────────────────────────────────────────
  const {
    acquireMedia,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    startRecording,
    stopRecording,
    downloadRecording,
    releaseMedia,
    recordingBlob,
  } = useMediaControls(localStreamRef, localVideoRef);

  // ── Acquire media on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!bootstrapped) return;
    acquireMedia().then((stream) => {
      if (stream && peerRef.current) {
        for (const track of stream.getTracks()) {
          const senders = peerRef.current.getSenders();
          if (!senders.find((s) => s.track?.kind === track.kind)) {
            peerRef.current.addTrack(track, stream);
          }
        }
      }
    });
    return () => releaseMedia();
  }, [bootstrapped, acquireMedia, releaseMedia]);

  // ── Media toggle handlers (also broadcast state via socket) ───────────────
  const handleToggleMic = useCallback(() => {
    const next = toggleMic();
    if (next !== undefined) {
      socketRef.current?.emit('media-state', { roomId, micOn: next, camOn: undefined, isScreenSharing: undefined });
      if (user?.id) dispatch(updateParticipantMedia({ userId: user.id, micOn: next }));
    }
  }, [toggleMic, socketRef, roomId, dispatch, user]);

  const handleToggleCam = useCallback(() => {
    const next = toggleCam();
    if (next !== undefined) {
      socketRef.current?.emit('media-state', { roomId, camOn: next });
      if (user?.id) dispatch(updateParticipantMedia({ userId: user.id, camOn: next }));
    }
  }, [toggleCam, socketRef, roomId, dispatch, user]);

  const { isScreenSharing } = useAppSelector((s) => s.room);

  const handleScreenShare = useCallback(async () => {
    if (!isScreenSharing) {
      const track = await startScreenShare(peerRef.current);
      if (track) {
        socketRef.current?.emit('media-state', { roomId, isScreenSharing: true });
        if (user?.id) dispatch(updateParticipantMedia({ userId: user.id, isScreenSharing: true }));
      }
    } else {
      stopScreenShare(peerRef.current);
      socketRef.current?.emit('media-state', { roomId, isScreenSharing: false });
      if (user?.id) dispatch(updateParticipantMedia({ userId: user.id, isScreenSharing: false }));
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare, peerRef, socketRef, roomId, dispatch, user]);

  // ── Recording ──────────────────────────────────────────────────────────────
  const handleStartRecord = useCallback(() => {
    startRecording(localStreamRef.current ?? undefined);
    socketRef.current?.emit('recording-start', { roomId });
  }, [startRecording, socketRef, roomId, localStreamRef]);

  const handleStopRecord = useCallback(() => {
    stopRecording();
    socketRef.current?.emit('recording-stop', { roomId });
  }, [stopRecording, socketRef, roomId]);

  // ── End call ───────────────────────────────────────────────────────────────
  const handleEndCall = useCallback(async () => {
    stopRecording();
    releaseMedia();
    socketRef.current?.emit('leave-room', { roomId });
    socketRef.current?.disconnect();

    if (sessionId) {
      await api.post(`/sessions/${sessionId}/end`).catch(() => {});
    }

    dispatch(resetRoom());
    navigate('/profile');
    toast.success('Session ended. Check your dashboard for the recording.');
  }, [stopRecording, releaseMedia, socketRef, roomId, sessionId, dispatch, navigate]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!bootstrapped) return <PageLoader />;

  // ── Panel width ────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden select-none">
      {/* Session ended overlay */}
      <AnimatePresence>
        {sessionEnded && (
          <SessionEndedOverlay
            hasRecording={!!recordingBlob}
            onDownloadRecording={downloadRecording}
          />
        )}
      </AnimatePresence>

      {/* Top bar */}
      <TopBar bookingId={bookingId} />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Video grid ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-3 overflow-hidden">
            <div className={clsx(
              'h-full grid gap-2',
              remoteParticipant ? 'grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto'
            )}>
              {/* Remote tile */}
              {remoteParticipant ? (
                <VideoTile
                  key={remoteParticipant.userId}
                  participant={remoteParticipant}
                  stream={remoteStream}
                  isLarge
                />
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-[#111118] border border-white/5 gap-4">
                  <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <p className="text-white/40 text-sm">Waiting for participant to join…</p>
                </div>
              )}

              {/* Local tile */}
              {selfParticipant && (
                <VideoTile
                  key="local"
                  participant={{
                    ...selfParticipant,
                    displayName: selfParticipant.displayName || user?.name || 'You',
                    isSelf: true,
                  }}
                  stream={localStreamRef.current}
                  isLocal
                />
              )}

              {/* Fallback local tile (before room-state bootstrap) */}
              {!selfParticipant && (
                <div className="relative rounded-2xl overflow-hidden bg-[#111118] border border-white/5">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/60 rounded-lg text-xs font-medium">
                    {user?.name ?? 'You'} (connecting…)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Control bar */}
          <ControlBar
            onToggleMic={handleToggleMic}
            onToggleCam={handleToggleCam}
            onScreenShare={handleScreenShare}
            onEndCall={handleEndCall}
            onStartRecord={handleStartRecord}
            onStopRecord={handleStopRecord}
            onDownloadRecord={downloadRecording}
            hasRecordingBlob={!!recordingBlob}
          />
        </div>

        {/* ── Side panel ─────────────────────────────────────────────────── */}
        <motion.div
          key="side-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 340, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="flex-shrink-0 flex flex-col border-l border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden"
          style={{ minWidth: 0 }}
        >
          {/* Panel tab headers */}
          <div className="flex border-b border-white/5">
            {(['chat', 'code', 'participants'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => dispatch(setActivePanel(tab))}
                className={clsx(
                  'flex-1 py-3 text-xs font-medium capitalize transition-colors',
                  activePanel === tab
                    ? 'text-white border-b-2 border-[var(--accent)]'
                    : 'text-white/35 hover:text-white/60'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {activePanel === 'chat' && (
              <ChatPanel socketRef={socketRef} roomId={roomId ?? null} />
            )}
            {activePanel === 'code' && (
              <CodePanel socketRef={socketRef} roomId={roomId ?? null} />
            )}
            {activePanel === 'participants' && (
              <ParticipantList />
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
