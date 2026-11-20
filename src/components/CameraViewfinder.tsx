import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, SwitchCamera, X } from 'lucide-react';
import { captureVideoFrame, type CapturedPhoto } from '../utils/image';

interface CameraViewfinderProps {
  onCapture: (photo: CapturedPhoto) => void;
  onClose: () => void;
}

export function CameraViewfinder({ onCapture, onClose }: CameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      stopStream();
      setCameraReady(false);
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Your browser does not support direct camera access. Try opening FoodSnap in a modern mobile or desktop browser.',
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          setCameraReady(true);
        }
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCameraError(
            'Camera permission was denied. Please allow camera access in your browser settings and tap Retry Camera.',
          );
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setCameraError(
            'No camera device was detected on this browser. Connect or enable a camera and tap Retry Camera.',
          );
        } else {
          setCameraError(
            'Could not start the camera stream. Make sure no other app is using your camera and try again.',
          );
        }
      }
    },
    [stopStream],
  );

  useEffect(() => {
    void startCamera(facingMode);
    return () => {
      stopStream();
    };
  }, [facingMode, startCamera, stopStream]);

  const handleSnap = useCallback(() => {
    if (!videoRef.current || !cameraReady || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = captureVideoFrame(videoRef.current);
      stopStream();
      onCapture(photo);
    } catch {
      setCameraError('Could not capture frame from camera. Please try again.');
      setIsCapturing(false);
    }
  }, [cameraReady, isCapturing, onCapture, stopStream]);

  const handleFlipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  return (
    <div
      className="bg-[#181D18] text-white rounded-3xl overflow-hidden border border-[#2D352D]"
      role="region"
      aria-label="Food camera viewfinder"
    >
      {/* Viewfinder Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1E241E]/90 border-b border-white/10">
        <button
          type="button"
          onClick={() => {
            stopStream();
            onClose();
          }}
          className="min-h-[44px] min-w-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58A4B]"
          aria-label="Close camera"
        >
          <X className="w-5 h-5" />
          <span>Cancel</span>
        </button>

        <span className="text-sm font-medium text-white/90 truncate">
          Frame your dish
        </span>

        <button
          type="button"
          onClick={handleFlipCamera}
          className="min-h-[44px] min-w-[44px] px-3 rounded-xl inline-flex items-center justify-center text-white/90 hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58A4B]"
          aria-label="Switch camera"
          title="Switch front or rear camera"
        >
          <SwitchCamera className="w-5 h-5" />
        </button>
      </div>

      {/* Live Video Stream */}
      <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full bg-[#111511] flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            cameraReady && !cameraError ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Corner Viewfinder Framing Guides */}
        {cameraReady && !cameraError && (
          <div className="pointer-events-none absolute inset-6 sm:inset-10">
            <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-[#F58A4B] rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-[#F58A4B] rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-[#6BBF7B] rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-[#6BBF7B] rounded-br-lg" />
          </div>
        )}

        {/* Loading Stream State */}
        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Camera className="w-6 h-6 text-[#F58A4B]" />
            </div>
            <p className="text-sm text-white/80">Starting camera viewfinder…</p>
          </div>
        )}

        {/* Camera Unavailable / Permission Error State */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-[#181D18]">
            <div className="w-12 h-12 rounded-2xl bg-[#D95D24]/20 text-[#F58A4B] flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <div className="max-w-sm space-y-1.5">
              <h3 className="text-base font-semibold text-white">Camera Unavailable</h3>
              <p className="text-sm text-white/75 leading-relaxed">{cameraError}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void startCamera(facingMode)}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D95D24] hover:bg-[#C24E1A] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Camera</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  stopStream();
                  onClose();
                }}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Shutter Controls */}
      <div className="px-6 py-5 bg-[#1E241E] flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handleSnap}
          disabled={!cameraReady || Boolean(cameraError) || isCapturing}
          aria-label="Take food picture"
          className="w-16 h-16 rounded-full bg-white p-1.5 transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F58A4B]"
        >
          <span className="block w-full h-full rounded-full bg-[#D95D24] hover:bg-[#C24E1A] transition-colors flex items-center justify-center">
            <Camera className="w-6 h-6 text-white" />
          </span>
        </button>
        <p className="text-xs text-white/70">
          Tap the shutter to snap &amp; analyze your food
        </p>
      </div>
    </div>
  );
}
