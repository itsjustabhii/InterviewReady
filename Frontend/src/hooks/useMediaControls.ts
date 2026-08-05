/**
 * useMediaControls — acquires and controls local audio/video/screen-share.
 * Also drives the MediaRecorder for client-side recording.
 */
import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setMicOn, setCamOn, setScreenSharing, setRecordingState } from '../store/slices/roomSlice';
import toast from 'react-hot-toast';

export function useMediaControls(
  localStreamRef: RefObject<MediaStream | null>,
  localVideoRef: RefObject<HTMLVideoElement | null>,
) {
  const dispatch = useAppDispatch();
  const { micOn, camOn } = useAppSelector((s) => s.room);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  // ── Acquire initial camera + mic ────────────────────────────────────────────
  const acquireMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      (localStreamRef as any).current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      dispatch(setMicOn(true));
      dispatch(setCamOn(true));
      return stream;
    } catch (err: any) {
      toast.error(`Camera/mic access denied: ${err.message}`);
      return null;
    }
  }, [localStreamRef, localVideoRef, dispatch]);

  // ── Microphone toggle ────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !micOn;
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = next; });
    dispatch(setMicOn(next));
    return next;
  }, [micOn, localStreamRef, dispatch]);

  // ── Camera toggle ────────────────────────────────────────────────────────────
  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !camOn;
    localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = next; });
    dispatch(setCamOn(next));
    return next;
  }, [camOn, localStreamRef, dispatch]);

  // ── Screen share ─────────────────────────────────────────────────────────────
  const startScreenShare = useCallback(async (peerConnection: RTCPeerConnection | null) => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;

      // Replace camera track on peer connection
      if (peerConnection) {
        const sender = peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        sender?.replaceTrack(screenTrack);
      }

      // Update local preview
      if (localVideoRef.current && localStreamRef.current) {
        const clone = localStreamRef.current.clone();
        clone.getVideoTracks().forEach((t) => t.stop());
        clone.addTrack(screenTrack);
        localVideoRef.current.srcObject = clone;
      }

      dispatch(setScreenSharing(true));

      // When user clicks browser's "Stop sharing"
      screenTrack.onended = () => stopScreenShare(peerConnection);
      return screenTrack;
    } catch (err) {
      toast.error('Screen share cancelled or denied');
      return null;
    }
  }, [localStreamRef, localVideoRef, dispatch]);

  const stopScreenShare = useCallback((peerConnection: RTCPeerConnection | null) => {
    if (!screenTrackRef.current) return;
    screenTrackRef.current.stop();
    screenTrackRef.current = null;

    // Restore camera track
    if (peerConnection && localStreamRef.current) {
      const camTrack = localStreamRef.current.getVideoTracks()[0];
      if (camTrack) {
        const sender = peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        sender?.replaceTrack(camTrack);
      }
    }

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    dispatch(setScreenSharing(false));
  }, [localStreamRef, localVideoRef, dispatch]);

  // ── Client-side recording (MediaRecorder) ───────────────────────────────────
  const startRecording = useCallback((combinedStream?: MediaStream) => {
    const stream = combinedStream ?? localStreamRef.current;
    if (!stream) { toast.error('No stream to record'); return; }

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordingBlob(blob);
        dispatch(setRecordingState({ state: 'stopped' }));
        toast.success('Recording saved locally');
      };

      recorder.start(1000); // collect in 1-second chunks
      recorderRef.current = recorder;
      dispatch(setRecordingState({ state: 'recording' }));
    } catch (err: any) {
      toast.error(`Recording failed: ${err.message}`);
    }
  }, [localStreamRef, dispatch]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  const downloadRecording = useCallback(() => {
    if (!recordingBlob) return;
    const url = URL.createObjectURL(recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recordingBlob]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const releaseMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenTrackRef.current?.stop();
    recorderRef.current?.stop();
    (localStreamRef as any).current = null;
  }, [localStreamRef]);

  return {
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
  };
}
