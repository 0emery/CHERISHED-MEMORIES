import React, { useState, Suspense, useCallback, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AppState, PhotoData } from './types';
import TreeGroup from './components/TreeGroup';
import GoldDust from './components/GoldDust';
import GestureController from './components/GestureController';
import { generatePhotoPositions } from './utils/math';
import { savePhotoToDB, deletePhotoFromDB, getAllPhotosFromDB } from './utils/persistence';

// Camera Controller - STATIC
const CameraController: React.FC<{ appState: AppState }> = ({ appState }) => {
  useFrame((state, delta) => {
    // Keep camera at a fixed, elegant distance.
    const target = new THREE.Vector3(0, 2, 35); 
    state.camera.position.lerp(target, delta * 2);
    state.camera.lookAt(0, 0, 0);
  });
  return null;
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.CHAOS);
  const [handRotation, setHandRotation] = useState<{x: number, y: number} | null>(null);
  const [gestureStatus, setGestureStatus] = useState<string>('NONE');
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Photo State
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [featuredPhotoId, setFeaturedPhotoId] = useState<string | null>(null);
  const treeGroupRef = useRef<THREE.Group>(null);

  // Track history to avoid repeats (Queue of last 5 photos)
  const recentPhotosRef = useRef<string[]>([]);

  // Load photos from DB on mount
  useEffect(() => {
    const loadPhotos = async () => {
        try {
            const savedPhotos = await getAllPhotosFromDB();
            if (savedPhotos.length > 0) {
                // Regenerate positions based on loaded data
                const newPhotoData = generatePhotoPositions(savedPhotos, 14, 5);
                setPhotos(newPhotoData);
                // If we have photos, start in FORMED state
                setAppState(AppState.FORMED);
            }
        } catch (e) {
            console.error("Failed to load photos from DB", e);
        }
    };
    loadPhotos();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      
      const newSourceData = await Promise.all(files.map(async (file: File) => {
          // 1. Convert File to Base64 (Data URL) for storage
          const base64Url = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
          });

          // 2. Load image to get dimensions
          const img = new Image();
          img.src = base64Url;
          await new Promise((resolve) => { img.onload = resolve; });
          
          const aspectRatio = img.width / img.height;
          const id = `photo-${Date.now()}-${Math.random()}`;

          // 3. Save to IndexedDB
          await savePhotoToDB(id, base64Url, aspectRatio);
          
          return {
            id,
            url: base64Url,
            aspectRatio
          };
      }));
      
      // Combine with existing source data
      const currentSourceData = photos.map(p => ({ 
          id: p.id, 
          url: p.url, 
          aspectRatio: p.aspectRatio 
      }));
      const allSourceData = [...currentSourceData, ...newSourceData];
      
      const newPhotoData = generatePhotoPositions(allSourceData, 14, 5);
      setPhotos(newPhotoData);
      
      setAppState(AppState.FORMED);
    }
    // Reset input
    e.target.value = '';
  };

  const handleRemovePhoto = async (id: string) => {
      // 1. Remove from DB
      await deletePhotoFromDB(id);

      // 2. Filter out the deleted photo
      const remainingSourceData = photos
        .filter(p => p.id !== id)
        .map(p => ({ 
            id: p.id, 
            url: p.url,
            aspectRatio: p.aspectRatio
        }));

      // Remove from history if present
      recentPhotosRef.current = recentPhotosRef.current.filter(recId => recId !== id);

      // Regenerate positions for the remaining photos
      const newPhotoData = generatePhotoPositions(remainingSourceData, 14, 5);
      setPhotos(newPhotoData);
  };

  const handleGesture = useCallback((gesture: 'POINT' | 'OPEN' | 'FIST' | 'NONE') => {
    setGestureStatus(gesture);
    
    // Updated Logic: POINT (Index Finger) triggers viewing photo
    if (gesture === 'POINT') {
        setAppState(current => {
            // Only trigger if we are NOT already viewing a photo
            if (current !== AppState.FOCUS) {
                if (photos.length > 0) {
                    const MAX_HISTORY = 5;
                    let candidates = photos;

                    // 1. Try to exclude the full history list (last 5 viewed)
                    const strictCandidates = photos.filter(p => !recentPhotosRef.current.includes(p.id));

                    if (strictCandidates.length > 0) {
                        candidates = strictCandidates;
                    } else {
                        if (photos.length > 1 && recentPhotosRef.current.length > 0) {
                            const lastViewed = recentPhotosRef.current[recentPhotosRef.current.length - 1];
                            candidates = photos.filter(p => p.id !== lastViewed);
                        }
                    }

                    const randomIdx = Math.floor(Math.random() * candidates.length);
                    const selectedId = candidates[randomIdx].id;
                    
                    setFeaturedPhotoId(selectedId);
                    
                    // Release hand control so the tree drifts naturally instead of locking
                    setHandRotation(null);

                    // Update History Queue
                    const newHistory = [...recentPhotosRef.current, selectedId];
                    if (newHistory.length > MAX_HISTORY) {
                        newHistory.shift(); // Remove oldest
                    }
                    recentPhotosRef.current = newHistory;
                }
                return AppState.FOCUS;
            }
            return current;
        });
    } else if (gesture === 'OPEN') {
        setFeaturedPhotoId(null);
        setAppState(AppState.CHAOS);
    } else if (gesture === 'FIST') {
        setFeaturedPhotoId(null);
        setAppState(AppState.FORMED);
    }
  }, [photos]);

  const handleHandMove = useCallback((x: number, y: number) => {
    // When focusing on a photo, stop tracking hand movement to prevent dizzying rotation.
    if (appState !== AppState.FOCUS) {
        setHandRotation({ x, y });
    }
  }, [appState]);

  // Attempt Autoplay
  useEffect(() => {
    const attemptPlay = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => {
                console.log("Audio autoplay blocked, waiting for interaction");
            });
        }
    };
    document.addEventListener('click', attemptPlay, { once: true });
    return () => document.removeEventListener('click', attemptPlay);
  }, []);

  return (
    <div className="relative w-full h-full bg-black select-none">
      {/* Background Music - Merry Christmas Mr. Lawrence */}
      <audio 
        ref={audioRef}
        src="https://music.163.com/song/media/outer/url?id=514055.mp3" 
        loop 
        autoPlay
      />

      {/* 3D Scene */}
      <Canvas dpr={[1, 2]} gl={{ antialias: false, toneMappingExposure: 1.5 }}>
        <PerspectiveCamera makeDefault position={[0, 2, 35]} fov={50} />
        <CameraController appState={appState} />
        
        {/* Lighting */}
        <Environment preset="lobby" background={false} />
        <ambientLight intensity={0.5} color="#013220" />
        <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={2} color="#F1D97A" castShadow />
        <pointLight position={[-10, 5, -10]} intensity={1} color="#C41E3A" />

        <Suspense fallback={null}>
            <TreeGroup 
                appState={appState} 
                handRotation={handRotation} 
                photos={photos}
                featuredPhotoId={featuredPhotoId}
                groupRef={treeGroupRef}
            />
            <GoldDust />
        </Suspense>

        {/* Post Processing */}
        <EffectComposer enableNormalPass={false}>
            <Bloom 
                luminanceThreshold={0.8} 
                mipmapBlur 
                intensity={1.2} 
                radius={0.6}
            />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>

      {/* MediaPipe Controller */}
      <GestureController 
        onGesture={handleGesture} 
        onHandMove={handleHandMove} 
      />

      {/* Luxury UI Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-8 md:p-12">
        
        {/* Header */}
        <header className="text-center z-10 animate-fade-in-down">
          <h1 className="font-serif text-4xl md:text-6xl text-luxury-gold drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-widest uppercase">
            CHERISHED MEMORIES
          </h1>
          <p className="font-sans text-luxury-gold-light opacity-80 mt-2 tracking-[0.2em] text-sm md:text-base">
            Gesture Interactive 3D Christmas Tree
          </p>
        </header>

        {/* Gesture Guide (Chinese) */}
        <div className="absolute top-1/2 right-8 transform -translate-y-1/2 hidden lg:block opacity-60">
            <div className="flex flex-col gap-6 text-right text-luxury-gold-light font-sans text-xs tracking-widest">
                <div className={`transition-opacity duration-300 ${gestureStatus === 'FIST' ? 'opacity-100 text-white' : 'opacity-50'}`}>
                    <span className="block text-lg mb-1">✊ 握拳</span>
                    <span>聚合为树</span>
                </div>
                <div className={`transition-opacity duration-300 ${gestureStatus === 'OPEN' ? 'opacity-100 text-white' : 'opacity-50'}`}>
                    <span className="block text-lg mb-1">✋ 张开</span>
                    <span>散开</span>
                </div>
                <div className={`transition-opacity duration-300 ${gestureStatus === 'POINT' ? 'opacity-100 text-white' : 'opacity-50'}`}>
                    <span className="block text-lg mb-1">☝️ 伸出食指</span>
                    <span>查看照片</span>
                </div>
            </div>
        </div>

        {/* Bottom Area: Controls & Gallery */}
        <div className="flex flex-col items-center justify-end w-full gap-8 pointer-events-auto z-10">
            
            {/* Assemble / Release Button */}
            <button
                onClick={() => setAppState(prev => prev === AppState.CHAOS ? AppState.FORMED : AppState.CHAOS)}
                className="group relative px-12 py-4 bg-luxury-green/80 backdrop-blur-md border border-luxury-gold transition-all duration-500 hover:bg-luxury-gold hover:text-luxury-green overflow-hidden rounded-sm shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>
                <span className="font-serif text-xl md:text-2xl text-luxury-gold group-hover:text-black tracking-widest relative z-10 transition-colors">
                    {appState === AppState.CHAOS ? '聚合为树' : '散开'}
                </span>
            </button>

            {/* Photo Management Strip */}
            <div className="w-full max-w-4xl bg-black/40 backdrop-blur-md border-t border-luxury-gold/30 p-4 flex items-center gap-4 rounded-xl overflow-x-auto custom-scrollbar">
                
                {/* Upload Button */}
                <div className="relative flex-shrink-0 w-20 h-20 border border-dashed border-luxury-gold/50 hover:border-luxury-gold hover:bg-luxury-gold/10 transition-colors flex flex-col items-center justify-center cursor-pointer group rounded-lg">
                    <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={handlePhotoUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    <span className="text-2xl text-luxury-gold group-hover:scale-110 transition-transform">+</span>
                    <span className="text-[10px] uppercase tracking-widest text-luxury-gold mt-1">添加</span>
                </div>

                {/* Photo Thumbnails */}
                {photos.map((photo) => (
                    <div key={photo.id} className="relative flex-shrink-0 w-20 h-20 group">
                        <img 
                            src={photo.url} 
                            alt="memory" 
                            className="w-full h-full object-cover rounded-lg border border-luxury-gold/30 group-hover:border-luxury-gold transition-colors"
                        />
                        {/* Delete Overlay */}
                        <div 
                            onClick={() => handleRemovePhoto(photo.id)}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-lg"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                    </div>
                ))}
                
                {photos.length === 0 && (
                    <div className="text-luxury-gold-light/40 text-sm italic ml-4">
                        上传照片，将记忆挂上树梢...
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;