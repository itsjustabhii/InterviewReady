/**
 * useSocket — manages a Socket.IO connection to the /webrtc namespace.
 *
 * Returns the socket instance and connection status.
 * Automatically reconnects on disconnect with exponential backoff.
 * Dispatches Redux actions for all signaling events.
 */
import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setSocketConnected, setSocketError, upsertParticipant, removeParticipant,
  updateParticipantMedia, setRecordingState, addMessage, incrementUnread,
  setCodeContent, setSessionEnded, setParticipants,
} from '../store/slices/roomSlice';
import type { Participant, ChatMessage } from '../store/slices/roomSlice';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export function useSocket(roomId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const dispatch = useAppDispatch();
  const { token } = useAppSelector((s) => s.auth);
  const activePanel = useAppSelector((s) => s.room.activePanel);

  // Keep activePanel accessible in callbacks without re-registering handlers
  const panelRef = useRef(activePanel);
  panelRef.current = activePanel;

  const connect = useCallback(() => {
    if (!token || !roomId) return;
    if (socketRef.current?.connected) return;

    const socket = io(`${SOCKET_URL}/webrtc`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      dispatch(setSocketConnected(true));
      socket.emit('join-room', { roomId });
    });

    socket.on('disconnect', (reason) => {
      dispatch(setSocketConnected(false));
      if (reason === 'io server disconnect') {
        // Server explicitly disconnected — try to reconnect once
        setTimeout(() => socket.connect(), 2000);
      }
    });

    socket.on('connect_error', (err) => {
      dispatch(setSocketError(err.message));
    });

    socket.on('reconnect', () => {
      dispatch(setSocketConnected(true));
      socket.emit('reconnect-request', { roomId });
    });

    // ── Room state bootstrap ─────────────────────────────────────────────────
    socket.on('room-state', (data: {
      participants: Participant[];
      recordingState: string;
      codeContent: string;
    }) => {
      const map: Record<string, Participant> = {};
      data.participants.forEach((p) => { map[p.userId] = p; });
      dispatch(setParticipants(map));
      dispatch(setCodeContent(data.codeContent || '// Start typing...\n'));
      if (data.recordingState === 'recording') {
        dispatch(setRecordingState({ state: 'recording' }));
      }
    });

    // Re-join ack on reconnect
    socket.on('reconnect-ack', (data: { roomState: any }) => {
      const map: Record<string, Participant> = {};
      (data.roomState.participants || []).forEach((p: Participant) => { map[p.userId] = p; });
      dispatch(setParticipants(map));
      dispatch(setCodeContent(data.roomState.codeContent || ''));
    });

    // ── Participant events ───────────────────────────────────────────────────
    socket.on('participant-joined', ({ participant }: { participant: Participant }) => {
      dispatch(upsertParticipant(participant));
    });

    socket.on('participant-left', ({ userId }: { userId: string }) => {
      dispatch(removeParticipant(userId));
    });

    // ── Media state ──────────────────────────────────────────────────────────
    socket.on('media-state', ({ userId, micOn, camOn, isScreenSharing }: any) => {
      dispatch(updateParticipantMedia({ userId, micOn, camOn, isScreenSharing }));
    });

    // ── Chat ─────────────────────────────────────────────────────────────────
    socket.on('chat-message', (msg: ChatMessage) => {
      dispatch(addMessage(msg));
      if (panelRef.current !== 'chat') dispatch(incrementUnread());
    });

    // ── Code ─────────────────────────────────────────────────────────────────
    socket.on('code-update', ({ content }: { content: string }) => {
      dispatch(setCodeContent(content));
    });

    // ── Recording ────────────────────────────────────────────────────────────
    socket.on('recording-started', ({ startedBy }: { startedBy: string }) => {
      dispatch(setRecordingState({ state: 'recording', startedBy }));
    });
    socket.on('recording-stopped', () => {
      dispatch(setRecordingState({ state: 'stopped' }));
    });

    // ── Session ended ────────────────────────────────────────────────────────
    socket.on('session-ended', () => {
      dispatch(setSessionEnded());
    });

    // ── Heartbeat ────────────────────────────────────────────────────────────
    const hbInterval = setInterval(() => {
      if (socket.connected && roomId) socket.emit('heartbeat', { roomId });
    }, 25000);

    socket.on('disconnect', () => clearInterval(hbInterval));
  }, [token, roomId, dispatch]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      dispatch(setSocketConnected(false));
    };
  }, [connect]);

  return socketRef;
}
