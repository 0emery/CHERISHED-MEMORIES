import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface GestureControllerProps {
  onGesture: (gesture: 'POINT' | 'OPEN' | 'FIST' | 'NONE') => void;
  onHandMove: (x: number, y: number) => void;
}

const GestureController: React.FC<GestureControllerProps> = ({ onGesture, onHandMove }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const lastGesture = useRef<string>('NONE');
  const gestureDebounce = useRef<number>(0);

  // Use refs for callbacks to avoid stale closures in the loop
  const onGestureRef = useRef(onGesture);
  const onHandMoveRef = useRef(onHandMove);

  useEffect(() => {
    onGestureRef.current = onGesture;
    onHandMoveRef.current = onHandMove;
  }, [onGesture, onHandMove]);

  useEffect(() => {
    let active = true;

    const startWebcam = async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { width: 640, height: 480, facingMode: 'user' } 
            });
            if (active && videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.addEventListener('loadeddata', predictWebcam);
            }
          } catch (err) {
            console.error("Webcam access denied:", err);
          }
        }
    };

    const initMediaPipe = async () => {
      try {
        // Start webcam immediately for better UX
        startWebcam();

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        
        if (!active) return;

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        setLoaded(true);
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
      }
    };

    initMediaPipe();

    return () => {
       active = false;
       if (requestRef.current) cancelAnimationFrame(requestRef.current);
       if (videoRef.current && videoRef.current.srcObject) {
         const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
         tracks.forEach(track => track.stop());
       }
    };
  }, []);

  const predictWebcam = () => {
    if (!videoRef.current) return;

    // If model hasn't loaded yet, keep looping until it is ready
    if (!handLandmarkerRef.current) {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
    }

    const nowInMs = Date.now();
    let results;
    try {
        results = handLandmarkerRef.current.detectForVideo(videoRef.current, nowInMs);
    } catch(e) {
        console.error(e);
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
    }

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      
      const xRaw = landmarks[0].x; 
      const y = landmarks[0].y; 
      
      // Calculate normalized X (0 = Left, 1 = Right)
      // Mirror effect: Input x goes 0(left)..1(right). 
      // Rendered is 1-x.
      const currentX = 1 - xRaw;

      // Use Ref to get latest callback
      onHandMoveRef.current(currentX, y);

      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];
      const pinkyTip = landmarks[20];
      const wrist = landmarks[0];

      const dist = (p1: any, p2: any) => {
        return Math.sqrt(
          Math.pow(p1.x - p2.x, 2) + 
          Math.pow(p1.y - p2.y, 2) + 
          Math.pow(p1.z - p2.z, 2)
        );
      };

      // --- LOGIC FOR FIST / OPEN ---
      const tipsToWristAvg = (
        dist(indexTip, wrist) + 
        dist(middleTip, wrist) + 
        dist(ringTip, wrist) + 
        dist(pinkyTip, wrist)
      ) / 4;

      const isFist = tipsToWristAvg < 0.25;
      const isOpen = tipsToWristAvg > 0.45;

      // --- LOGIC FOR POINTING (Index Finger) ---
      // Index extended (far from wrist)
      const isIndexExtended = dist(indexTip, wrist) > 0.35; 
      // Others curled (close to wrist)
      const areOthersCurled = 
        dist(middleTip, wrist) < 0.3 && 
        dist(ringTip, wrist) < 0.3 && 
        dist(pinkyTip, wrist) < 0.3;

      const isPointing = isIndexExtended && areOthersCurled;

      let detectedGesture: 'POINT' | 'OPEN' | 'FIST' | 'NONE' = 'NONE';
      
      if (isFist) {
        detectedGesture = 'FIST';
      } else if (isPointing) {
        detectedGesture = 'POINT';
      } else if (isOpen) {
        detectedGesture = 'OPEN';
      }

      if (detectedGesture !== lastGesture.current) {
         if (nowInMs - gestureDebounce.current > 150) { 
            lastGesture.current = detectedGesture;
            gestureDebounce.current = nowInMs;
            // Use Ref to get latest callback
            onGestureRef.current(detectedGesture);
         }
      }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };
  
  const getGestureLabel = (g: string) => {
      switch(g) {
          case 'POINT': return '伸出食指';
          case 'FIST': return '握拳';
          case 'OPEN': return '张开';
          case 'NONE': return '检测中...';
          default: return g;
      }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none opacity-80">
      <video 
        ref={videoRef} 
        className="w-32 h-24 object-cover rounded-lg border-2 border-luxury-gold shadow-lg transform scale-x-[-1]" 
        autoPlay 
        playsInline 
        muted 
      />
      {!loaded && <div className="absolute inset-0 flex items-center justify-center text-xs text-luxury-gold bg-black/50 rounded-lg">Loading AI...</div>}
      <div className="absolute -top-6 right-0 text-luxury-gold text-xs font-sans tracking-widest text-right">
        {getGestureLabel(lastGesture.current)}
      </div>
    </div>
  );
};

export default GestureController;