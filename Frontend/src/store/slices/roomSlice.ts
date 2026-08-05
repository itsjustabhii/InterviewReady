/**
 * roomSlice — Redux state for the active interview room.
 * Tracks all real-time state: participants, media, chat, code, recording.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed';
export type RecordingState  = 'idle' | 'recording' | 'stopped';

export interface Participant {
  userId: string;
  displayName: string;
  avatar: string;
  role: 'user' | 'interviewer' | 'admin';
  micOn: boolean;
  camOn: boolean;
  isScreenSharing: boolean;
  connectionState: ConnectionState;
  joinedAt: number;
  isSelf?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  avatar: string;
  text: string;
  type: 'text' | 'code' | 'system';
  sentAt: string;
}

export interface RoomState {
  roomId: string | null;
  sessionId: string | null;
  iceServers: RTCIceServer[];

  // Connection
  socketConnected: boolean;
  socketError: string | null;
  peerConnectionState: ConnectionState;
  reconnectAttempts: number;

  // Participants
  participants: Record<string, Participant>;

  // Local media
  micOn: boolean;
  camOn: boolean;
  isScreenSharing: boolean;

  // Recording
  recordingState: RecordingState;
  recordingStartedBy: string | null;

  // Chat
  messages: ChatMessage[];
  unreadCount: number;

  // Shared code
  codeContent: string;

  // Session
  elapsed: number;
  sessionEnded: boolean;
  activePanel: 'chat' | 'code' | 'participants';
}

const initialState: RoomState = {
  roomId: null,
  sessionId: null,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],

  socketConnected: false,
  socketError: null,
  peerConnectionState: 'connecting',
  reconnectAttempts: 0,

  participants: {},

  micOn: true,
  camOn: true,
  isScreenSharing: false,

  recordingState: 'idle',
  recordingStartedBy: null,

  messages: [],
  unreadCount: 0,

  codeContent: '// Start typing your solution...\n',

  elapsed: 0,
  sessionEnded: false,
  activePanel: 'chat',
};

const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    initRoom(state, action: PayloadAction<{ roomId: string; sessionId: string; iceServers: RTCIceServer[] }>) {
      state.roomId = action.payload.roomId;
      state.sessionId = action.payload.sessionId;
      state.iceServers = action.payload.iceServers;
      state.sessionEnded = false;
      state.elapsed = 0;
      state.reconnectAttempts = 0;
    },

    setSocketConnected(state, action: PayloadAction<boolean>) {
      state.socketConnected = action.payload;
      if (action.payload) state.socketError = null;
    },

    setSocketError(state, action: PayloadAction<string | null>) {
      state.socketError = action.payload;
    },

    setPeerConnectionState(state, action: PayloadAction<ConnectionState>) {
      state.peerConnectionState = action.payload;
    },

    setReconnectAttempts(state, action: PayloadAction<number>) {
      state.reconnectAttempts = action.payload;
    },

    // ── Participants ─────────────────────────────────────────────────────────
    setParticipants(state, action: PayloadAction<Record<string, Participant>>) {
      state.participants = action.payload;
    },

    upsertParticipant(state, action: PayloadAction<Participant>) {
      state.participants[action.payload.userId] = action.payload;
    },

    removeParticipant(state, action: PayloadAction<string>) {
      const p = state.participants[action.payload];
      if (p) p.connectionState = 'disconnected';
    },

    updateParticipantMedia(
      state,
      action: PayloadAction<{ userId: string; micOn?: boolean; camOn?: boolean; isScreenSharing?: boolean }>
    ) {
      const { userId, ...media } = action.payload;
      if (state.participants[userId]) {
        Object.assign(state.participants[userId], media);
      }
    },

    updateParticipantConnectionState(state, action: PayloadAction<{ userId: string; state: ConnectionState }>) {
      if (state.participants[action.payload.userId]) {
        state.participants[action.payload.userId].connectionState = action.payload.state;
      }
    },

    // ── Local media ──────────────────────────────────────────────────────────
    setMicOn(state, action: PayloadAction<boolean>) { state.micOn = action.payload; },
    setCamOn(state, action: PayloadAction<boolean>) { state.camOn = action.payload; },
    setScreenSharing(state, action: PayloadAction<boolean>) { state.isScreenSharing = action.payload; },

    // ── Recording ────────────────────────────────────────────────────────────
    setRecordingState(state, action: PayloadAction<{ state: RecordingState; startedBy?: string }>) {
      state.recordingState = action.payload.state;
      if (action.payload.startedBy) state.recordingStartedBy = action.payload.startedBy;
    },

    // ── Chat ─────────────────────────────────────────────────────────────────
    addMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages.push(action.payload);
    },

    markMessagesRead(state) {
      state.unreadCount = 0;
    },

    incrementUnread(state) {
      state.unreadCount += 1;
    },

    // ── Code ─────────────────────────────────────────────────────────────────
    setCodeContent(state, action: PayloadAction<string>) {
      state.codeContent = action.payload;
    },

    // ── Session ──────────────────────────────────────────────────────────────
    tickElapsed(state) { state.elapsed += 1; },
    setSessionEnded(state) { state.sessionEnded = true; },
    setActivePanel(state, action: PayloadAction<'chat' | 'code' | 'participants'>) {
      state.activePanel = action.payload;
      if (action.payload === 'chat') state.unreadCount = 0;
    },

    resetRoom: () => initialState,
  },
});

export const {
  initRoom, setSocketConnected, setSocketError,
  setPeerConnectionState, setReconnectAttempts,
  setParticipants, upsertParticipant, removeParticipant,
  updateParticipantMedia, updateParticipantConnectionState,
  setMicOn, setCamOn, setScreenSharing,
  setRecordingState, addMessage, markMessagesRead, incrementUnread,
  setCodeContent, tickElapsed, setSessionEnded, setActivePanel, resetRoom,
} = roomSlice.actions;

export default roomSlice.reducer;
