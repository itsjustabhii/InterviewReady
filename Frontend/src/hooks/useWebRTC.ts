/**
 * useWebRTC — full WebRTC peer connection lifecycle.
 *
 * Responsibilities:
 *   • Create RTCPeerConnection with ICE servers
 *   • Perfect negotiation (polite/impolite pattern)
 *   • Relay SDP and ICE via the signaling socket
 *   • Expose remote stream for the VideoTile component
 *   • Reconnect logic: on ICE failure → restart ICE; after 3 restarts → renegotiate
 *
 * Returns:
 *   localStreamRef   — ref to the local MediaStream (camera/mic)
 *   remoteStream     — state of the remote peer's stream
 *   peerRef          — RTCPeerConnection ref (for screen-share track replacement)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setPeerConnectionState, updateParticipantConnectionState } from '../store/slices/roomSlice';

const MAX_ICE_RESTARTS = 3;

export function useWebRTC(
  socketRef: RefObject<import('socket.io-client').Socket | null>,
  localStreamRef: RefObject<MediaStream | null>,
  roomId: string | null,
  remoteUserId: string | null,
  isSelf: boolean,  // Am I the "polite" peer?
) {
  const dispatch = useAppDispatch();
  const iceServers = useAppSelector((s) => s.room.iceServers);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const iceRestartCount = useRef(0);
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);

  // ── Create peer connection ─────────────────────────────────────────────────
  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers });

    // Track remote stream
    const rs = new MediaStream();
    setRemoteStream(rs);

    pc.ontrack = (ev) => {
      ev.streams[0]?.getTracks().forEach((t) => rs.addTrack(t));
    };

    // ICE candidate → relay
    pc.onicecandidate = (ev) => {
      if (!ev.candidate || !socketRef.current || !remoteUserId) return;
      socketRef.current.emit('signal', {
        roomId,
        targetUserId: remoteUserId,
        signal: { type: 'ice-candidate', candidate: ev.candidate },
      });
    };

    // ICE connection state → Redux
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      const mapped = s === 'connected' || s === 'completed' ? 'connected'
        : s === 'disconnected' ? 'reconnecting'
        : s === 'failed' ? 'failed'
        : 'connecting';

      dispatch(setPeerConnectionState(mapped));
      if (remoteUserId) {
        dispatch(updateParticipantConnectionState({ userId: remoteUserId, state: mapped }));
      }

      if (s === 'failed') {
        if (iceRestartCount.current < MAX_ICE_RESTARTS) {
          iceRestartCount.current++;
          pc.restartIce();
        } else {
          // Give up and signal session-ended on UI
          dispatch(setPeerConnectionState('failed'));
        }
      }
      if (s === 'connected') iceRestartCount.current = 0;
    };

    // Negotiation needed (called when tracks are added)
    pc.onnegotiationneeded = async () => {
      if (!socketRef.current || !remoteUserId) return;
      try {
        makingOffer.current = true;
        await pc.setLocalDescription();
        socketRef.current.emit('signal', {
          roomId,
          targetUserId: remoteUserId,
          signal: { type: 'sdp', sdp: pc.localDescription },
        });
      } catch (err) {
        console.error('[WebRTC] negotiation error', err);
      } finally {
        makingOffer.current = false;
      }
    };

    return pc;
  }, [iceServers, roomId, remoteUserId, dispatch, socketRef]);

  // ── Add local tracks ───────────────────────────────────────────────────────
  const addLocalTracks = useCallback((pc: RTCPeerConnection) => {
    if (!localStreamRef.current) return;
    for (const track of localStreamRef.current.getTracks()) {
      const senders = pc.getSenders();
      if (!senders.find((s) => s.track?.kind === track.kind)) {
        pc.addTrack(track, localStreamRef.current);
      }
    }
  }, [localStreamRef]);

  // ── Signal handler ─────────────────────────────────────────────────────────
  const handleSignal = useCallback(async ({
    fromUserId,
    signal,
  }: {
    fromUserId: string;
    signal: any;
  }) => {
    if (fromUserId !== remoteUserId) return;

    const pc = peerRef.current;
    if (!pc) return;

    try {
      if (signal.type === 'sdp') {
        const offerCollision =
          signal.sdp.type === 'offer' &&
          (makingOffer.current || pc.signalingState !== 'stable');

        ignoreOffer.current = !isSelf && offerCollision;
        if (ignoreOffer.current) return;

        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        if (signal.sdp.type === 'offer') {
          await pc.setLocalDescription();
          socketRef.current?.emit('signal', {
            roomId,
            targetUserId: remoteUserId,
            signal: { type: 'sdp', sdp: pc.localDescription },
          });
        }
      } else if (signal.type === 'ice-candidate') {
        if (!ignoreOffer.current) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      }
    } catch (err) {
      console.error('[WebRTC] signal handling error', err);
    }
  }, [remoteUserId, roomId, isSelf, socketRef]);

  // ── Setup & teardown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!socketRef.current || !roomId || !remoteUserId) return;

    const pc = createPeer();
    peerRef.current = pc;
    addLocalTracks(pc);

    socketRef.current.on('signal', handleSignal);

    return () => {
      socketRef.current?.off('signal', handleSignal);
      pc.close();
      peerRef.current = null;
    };
  }, [createPeer, addLocalTracks, handleSignal, roomId, remoteUserId, socketRef]);

  return { peerRef, remoteStream };
}
