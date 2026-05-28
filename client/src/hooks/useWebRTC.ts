"use client";

/**
 * WebRTC Hook
 * Manages voice/video peer connections using simple-peer
 * Mesh topology - each peer connects to every other peer
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { socketClient } from "../lib/socket";
import { SOCKET_EVENTS } from "../../shared/constants";

interface PeerConnection {
  peerId: string;
  socketId: string;
  peer: any; // SimplePeer instance
  stream?: MediaStream;
  isMicOn: boolean;
  isCameraOn: boolean;
  isSpeaking: boolean;
}

interface UseWebRTCOptions {
  roomId: string;
  userId: string;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const SPEAKING_THRESHOLD = 15; // Volume threshold for speaking detection
const SPEAKING_CHECK_INTERVAL = 100; // ms

export function useWebRTC({ roomId, userId }: UseWebRTCOptions) {
  const [isInVoice, setIsInVoice] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [peers, setPeers] = useState<PeerConnection[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const peersRef = useRef<PeerConnection[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Get user media (audio + optional video)
   */
  const getUserMedia = useCallback(async (withVideo: boolean) => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: withVideo
          ? { width: 160, height: 120, frameRate: 15 }
          : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setPermissionError(null);
      return stream;
    } catch (err: any) {
      console.error("[WEBRTC] getUserMedia error:", err);
      if (err.name === "NotAllowedError") {
        setPermissionError("Microphone permission denied. Please allow access in your browser settings.");
      } else if (err.name === "NotFoundError") {
        setPermissionError("No microphone found. Please connect a microphone.");
      } else {
        setPermissionError("Could not access microphone. Please check your device settings.");
      }
      return null;
    }
  }, []);

  /**
   * Setup speaking detection using AudioContext analyser
   */
  const setupSpeakingDetection = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Periodically check volume level
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      speakingIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume
        const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        const speaking = average > SPEAKING_THRESHOLD;

        setIsSpeaking(speaking);
      }, SPEAKING_CHECK_INTERVAL);
    } catch (err) {
      console.error("[WEBRTC] Speaking detection setup failed:", err);
    }
  }, []);

  /**
   * Cleanup speaking detection
   */
  const cleanupSpeakingDetection = useCallback(() => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsSpeaking(false);
  }, []);

  /**
   * Create a peer connection to another user
   */
  const createPeer = useCallback(
    (targetSocketId: string, targetUserId: string, initiator: boolean, stream: MediaStream) => {
      // Dynamic import of simple-peer
      import("simple-peer").then(({ default: SimplePeer }) => {
        const peer = new SimplePeer({
          initiator,
          trickle: true,
          stream,
          config: { iceServers: ICE_SERVERS },
        });

        peer.on("signal", (signal: any) => {
          if (initiator) {
            socketClient.emit(SOCKET_EVENTS.WEBRTC_OFFER, {
              roomId,
              userId,
              targetSocketId,
              signal,
            });
          } else {
            socketClient.emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
              roomId,
              userId,
              targetSocketId,
              signal,
            });
          }
        });

        peer.on("stream", (remoteStream: MediaStream) => {
          console.log(`[WEBRTC] Got stream from ${targetUserId.substring(0, 6)}`);
          setPeers((prev) => {
            const updated = prev.map((p) =>
              p.peerId === targetUserId ? { ...p, stream: remoteStream } : p
            );
            peersRef.current = updated;
            return updated;
          });
        });

        peer.on("close", () => {
          console.log(`[WEBRTC] Peer ${targetUserId.substring(0, 6)} disconnected`);
          removePeer(targetUserId);
        });

        peer.on("error", (err: Error) => {
          console.error(`[WEBRTC] Peer error with ${targetUserId.substring(0, 6)}:`, err.message);
          removePeer(targetUserId);
        });

        const newPeer: PeerConnection = {
          peerId: targetUserId,
          socketId: targetSocketId,
          peer,
          isMicOn: true,
          isCameraOn: false,
          isSpeaking: false,
        };

        setPeers((prev) => {
          // Remove existing peer if any
          const filtered = prev.filter((p) => p.peerId !== targetUserId);
          const updated = [...filtered, newPeer];
          peersRef.current = updated;
          return updated;
        });
      });
    },
    [roomId, userId]
  );

  /**
   * Remove a peer connection
   */
  const removePeer = useCallback((peerId: string) => {
    setPeers((prev) => {
      const peerToRemove = prev.find((p) => p.peerId === peerId);
      if (peerToRemove?.peer) {
        peerToRemove.peer.destroy();
      }
      const updated = prev.filter((p) => p.peerId !== peerId);
      peersRef.current = updated;
      return updated;
    });
  }, []);

  /**
   * Join voice chat
   */
  const joinVoice = useCallback(async () => {
    const stream = await getUserMedia(false);
    if (!stream) return;

    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsInVoice(true);
    setIsMicOn(true);

    // Setup speaking detection
    setupSpeakingDetection(stream);

    // Notify server
    socketClient.emit(SOCKET_EVENTS.WEBRTC_JOIN, { roomId, userId });
    socketClient.emit(SOCKET_EVENTS.MIC_TOGGLE, { roomId, userId, isMicOn: true });
  }, [roomId, userId, getUserMedia, setupSpeakingDetection]);

  /**
   * Leave voice chat
   */
  const leaveVoice = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Destroy all peer connections
    peersRef.current.forEach((p) => {
      if (p.peer) p.peer.destroy();
    });
    setPeers([]);
    peersRef.current = [];

    // Cleanup
    cleanupSpeakingDetection();
    setIsInVoice(false);
    setIsMicOn(true);
    setIsCameraOn(false);

    // Notify server
    socketClient.emit(SOCKET_EVENTS.WEBRTC_LEAVE, { roomId, userId });
    socketClient.emit(SOCKET_EVENTS.MIC_TOGGLE, { roomId, userId, isMicOn: false });
    socketClient.emit(SOCKET_EVENTS.CAMERA_TOGGLE, { roomId, userId, isCameraOn: false });
  }, [roomId, userId, cleanupSpeakingDetection]);

  /**
   * Toggle microphone
   */
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;

    const audioTracks = localStreamRef.current.getAudioTracks();
    const newState = !isMicOn;

    audioTracks.forEach((track) => {
      track.enabled = newState;
    });

    setIsMicOn(newState);
    socketClient.emit(SOCKET_EVENTS.MIC_TOGGLE, { roomId, userId, isMicOn: newState });
  }, [isMicOn, roomId, userId]);

  /**
   * Toggle camera
   */
  const toggleCamera = useCallback(async () => {
    if (!localStreamRef.current) return;

    if (!isCameraOn) {
      // Turn camera ON - add video track
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 160, height: 120, frameRate: 15 },
        });

        const videoTrack = videoStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(videoTrack);

        // Add video track to all peer connections
        peersRef.current.forEach((p) => {
          if (p.peer && !p.peer.destroyed) {
            p.peer.addTrack(videoTrack, localStreamRef.current!);
          }
        });

        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsCameraOn(true);
        socketClient.emit(SOCKET_EVENTS.CAMERA_TOGGLE, { roomId, userId, isCameraOn: true });
      } catch (err) {
        console.error("[WEBRTC] Camera access failed:", err);
        setPermissionError("Camera access denied. Please allow camera in browser settings.");
      }
    } else {
      // Turn camera OFF - remove video track
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.stop();
        localStreamRef.current?.removeTrack(track);

        // Remove from peers
        peersRef.current.forEach((p) => {
          if (p.peer && !p.peer.destroyed) {
            try {
              p.peer.removeTrack(track, localStreamRef.current!);
            } catch {
              // Ignore if track wasn't added
            }
          }
        });
      });

      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setIsCameraOn(false);
      socketClient.emit(SOCKET_EVENTS.CAMERA_TOGGLE, { roomId, userId, isCameraOn: false });
    }
  }, [isCameraOn, roomId, userId]);

  /**
   * Socket event listeners for WebRTC signaling
   */
  useEffect(() => {
    if (!userId || !roomId) return;

    // Another user joined voice - create peer connection (we are initiator)
    const handlePeerJoined = (data: { userId: string; socketId: string }) => {
      if (data.userId === userId) return;
      if (!localStreamRef.current) return;

      console.log(`[WEBRTC] Peer ${data.userId.substring(0, 6)} joined, creating connection`);
      createPeer(data.socketId, data.userId, true, localStreamRef.current);
    };

    // Another user left voice
    const handlePeerLeft = (data: { userId: string; socketId: string }) => {
      if (data.userId === userId) return;
      console.log(`[WEBRTC] Peer ${data.userId.substring(0, 6)} left voice`);
      removePeer(data.userId);
    };

    // Received an offer from another peer (we respond)
    const handleOffer = (data: { userId: string; socketId: string; signal: any }) => {
      if (data.userId === userId) return;
      if (!localStreamRef.current) return;

      console.log(`[WEBRTC] Received offer from ${data.userId.substring(0, 6)}`);

      // Check if we already have a peer for this user
      const existingPeer = peersRef.current.find((p) => p.peerId === data.userId);
      if (existingPeer?.peer && !existingPeer.peer.destroyed) {
        // Signal the existing peer
        existingPeer.peer.signal(data.signal);
      } else {
        // Create new peer (not initiator) and signal it
        import("simple-peer").then(({ default: SimplePeer }) => {
          const peer = new SimplePeer({
            initiator: false,
            trickle: true,
            stream: localStreamRef.current!,
            config: { iceServers: ICE_SERVERS },
          });

          peer.on("signal", (signal: any) => {
            socketClient.emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
              roomId,
              userId,
              targetSocketId: data.socketId,
              signal,
            });
          });

          peer.on("stream", (remoteStream: MediaStream) => {
            console.log(`[WEBRTC] Got stream from ${data.userId.substring(0, 6)}`);
            setPeers((prev) => {
              const updated = prev.map((p) =>
                p.peerId === data.userId ? { ...p, stream: remoteStream } : p
              );
              peersRef.current = updated;
              return updated;
            });
          });

          peer.on("close", () => removePeer(data.userId));
          peer.on("error", () => removePeer(data.userId));

          // Signal with the offer
          peer.signal(data.signal);

          const newPeer: PeerConnection = {
            peerId: data.userId,
            socketId: data.socketId,
            peer,
            isMicOn: true,
            isCameraOn: false,
            isSpeaking: false,
          };

          setPeers((prev) => {
            const filtered = prev.filter((p) => p.peerId !== data.userId);
            const updated = [...filtered, newPeer];
            peersRef.current = updated;
            return updated;
          });
        });
      }
    };

    // Received an answer from another peer
    const handleAnswer = (data: { userId: string; socketId: string; signal: any }) => {
      if (data.userId === userId) return;

      const peerConn = peersRef.current.find((p) => p.peerId === data.userId);
      if (peerConn?.peer && !peerConn.peer.destroyed) {
        peerConn.peer.signal(data.signal);
      }
    };

    // Received ICE candidate
    const handleICE = (data: { userId: string; socketId: string; candidate: any }) => {
      if (data.userId === userId) return;

      const peerConn = peersRef.current.find((p) => p.peerId === data.userId);
      if (peerConn?.peer && !peerConn.peer.destroyed) {
        // ICE candidates come through signal in simple-peer
        // This is handled via the signal event already
      }
    };

    // Mic toggle from another user
    const handleMicToggle = (data: { userId: string; isMicOn: boolean }) => {
      if (data.userId === userId) return;
      setPeers((prev) => {
        const updated = prev.map((p) =>
          p.peerId === data.userId ? { ...p, isMicOn: data.isMicOn } : p
        );
        peersRef.current = updated;
        return updated;
      });
    };

    // Camera toggle from another user
    const handleCameraToggle = (data: { userId: string; isCameraOn: boolean }) => {
      if (data.userId === userId) return;
      setPeers((prev) => {
        const updated = prev.map((p) =>
          p.peerId === data.userId ? { ...p, isCameraOn: data.isCameraOn } : p
        );
        peersRef.current = updated;
        return updated;
      });
    };

    socketClient.on(SOCKET_EVENTS.WEBRTC_JOIN, handlePeerJoined);
    socketClient.on(SOCKET_EVENTS.WEBRTC_LEAVE, handlePeerLeft);
    socketClient.on(SOCKET_EVENTS.WEBRTC_OFFER, handleOffer);
    socketClient.on(SOCKET_EVENTS.WEBRTC_ANSWER, handleAnswer);
    socketClient.on(SOCKET_EVENTS.WEBRTC_ICE, handleICE);
    socketClient.on(SOCKET_EVENTS.MIC_TOGGLE, handleMicToggle);
    socketClient.on(SOCKET_EVENTS.CAMERA_TOGGLE, handleCameraToggle);

    return () => {
      socketClient.off(SOCKET_EVENTS.WEBRTC_JOIN, handlePeerJoined);
      socketClient.off(SOCKET_EVENTS.WEBRTC_LEAVE, handlePeerLeft);
      socketClient.off(SOCKET_EVENTS.WEBRTC_OFFER, handleOffer);
      socketClient.off(SOCKET_EVENTS.WEBRTC_ANSWER, handleAnswer);
      socketClient.off(SOCKET_EVENTS.WEBRTC_ICE, handleICE);
      socketClient.off(SOCKET_EVENTS.MIC_TOGGLE, handleMicToggle);
      socketClient.off(SOCKET_EVENTS.CAMERA_TOGGLE, handleCameraToggle);
    };
  }, [userId, roomId, createPeer, removePeer]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      peersRef.current.forEach((p) => {
        if (p.peer) p.peer.destroy();
      });
      cleanupSpeakingDetection();
    };
  }, [cleanupSpeakingDetection]);

  return {
    joinVoice,
    leaveVoice,
    toggleMic,
    toggleCamera,
    isMicOn,
    isCameraOn,
    isSpeaking,
    isInVoice,
    peers,
    localStream,
    permissionError,
  };
}
