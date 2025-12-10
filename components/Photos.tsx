import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import * as THREE from 'three';
import { AppState, PhotoData } from '../types';

interface PhotosProps {
  appState: AppState;
  photos: PhotoData[];
  featuredPhotoId: string | null;
}

const PhotosWithStrings: React.FC<PhotosProps> = ({ appState, photos, featuredPhotoId }) => {
    const groupRef = useRef<THREE.Group>(null);
    const currentPositions = useRef<Map<string, THREE.Vector3>>(new Map());
    
    // Define isFormed at component level to be accessible in JSX
    const isFormed = appState === AppState.FORMED || appState === AppState.FOCUS;
  
    // Initialize positions
    if (currentPositions.current.size === 0 && photos.length > 0) {
      photos.forEach(p => {
        currentPositions.current.set(p.id, p.chaosPos.clone());
      });
    }
  
    // PRIORITY 1: Ensure this runs AFTER the tree rotation updates to lock position perfectly
    useFrame((state, delta) => {
      if (!groupRef.current) return;
      
      // Update World Matrix is crucial when we are doing worldToLocal conversions
      // inside a moving parent
      if (featuredPhotoId && groupRef.current.parent) {
          groupRef.current.parent.updateMatrixWorld();
      }

      photos.forEach((photo, i) => {
        const child = groupRef.current?.children[i];
        if (!child) return;
  
        let targetPos = photo.chaosPos;
        let targetRot = new THREE.Euler(0, 0, 0); 
        let targetScale = 1.0;
        let isFeatured = false;

        if (featuredPhotoId) {
            // --- FOCUS MODE (Single Photo) ---
            if (photo.id === featuredPhotoId) {
                isFeatured = true;
                
                // Camera is fixed at z=35.
                // We want the photo to be comfortably in front of the camera.
                // z=30 places it 5 units away from camera.
                const targetWorldPos = new THREE.Vector3(0, 2, 30);
                
                // Convert World position to Local position (relative to the rotating TreeGroup)
                // This ensures the photo stays fixed in screen space even if the tree rotates.
                if (child.parent) {
                    const localTarget = targetWorldPos.clone();
                    child.parent.worldToLocal(localTarget);
                    targetPos = localTarget;
                } else {
                    targetPos = targetWorldPos;
                }
                
                targetScale = 3.0; // Slightly larger for better viewing
            } else {
                // Others hide
                targetPos = isFormed ? photo.targetPos : photo.chaosPos;
                targetScale = 0; 
            }
        } else {
            // --- NORMAL MODES ---
            targetPos = isFormed ? photo.targetPos : photo.chaosPos;
            targetRot = isFormed ? photo.rotation : new THREE.Euler(0, 0, 0); 
            targetScale = photo.scale;
        }
        
        // Get current pos
        const currentPos = currentPositions.current.get(photo.id);
        if (!currentPos) {
          currentPositions.current.set(photo.id, photo.chaosPos.clone());
          return;
        }

        // --- POSITION LOGIC ---
        if (isFeatured) {
            // SNAP LOCK: If we are close to the full size (arrived), we SNAP to the target.
            // This prevents "drag/lag" artifacts when the parent tree rotates quickly.
            // The local targetPos is calculated every frame to perfectly counteract parent rotation.
            if (child.scale.x > (targetScale * 0.9)) { 
                currentPos.copy(targetPos);
            } else {
                // Fast entry transition
                currentPos.lerp(targetPos, delta * 6.0);
            }
        } else {
            // Normal smooth movement for other modes
            currentPos.lerp(targetPos, delta * 3.0);
        }
        
        child.position.copy(currentPos);
        
        // --- SCALE LOGIC ---
        child.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 4.0);

        // --- ROTATION LOGIC ---
        if (isFeatured) {
             // For featured photo, always look at camera
             child.lookAt(state.camera.position);
        } else if (isFormed) {
            child.rotation.x = THREE.MathUtils.lerp(child.rotation.x, targetRot.x, delta * 2);
            child.rotation.y = THREE.MathUtils.lerp(child.rotation.y, targetRot.y, delta * 2);
            child.rotation.z = THREE.MathUtils.lerp(child.rotation.z, targetRot.z, delta * 2);
        } else {
            child.rotation.x += delta * 0.5;
            child.rotation.y += delta * 0.5;
        }
      });
    }, 1); // Render Priority 1
  
    if (photos.length === 0) return null;
  
    return (
      <group ref={groupRef}>
        {photos.map((photo) => {
            // --- ADAPTIVE POLAROID DIMENSIONS ---
            // Base width is fixed at 1.0 unit
            const imgWidth = 1.0;
            // Height depends on aspect ratio
            const imgHeight = imgWidth / photo.aspectRatio;
            
            // Polaroid Borders
            const borderSide = 0.08;
            const borderTop = 0.08;
            const borderBottom = 0.35; // Iconic thick bottom
            
            const frameWidth = imgWidth + (borderSide * 2);
            const frameHeight = imgHeight + borderTop + borderBottom;
            
            // Calculating the Y offset for the image so it sits correctly in the frame
            // Frame is centered at (0,0,0) of the child group
            // Image center relative to Frame center:
            // Top of frame = frameHeight/2
            // Image Top = frameHeight/2 - borderTop
            // Image Center Y = Image Top - imgHeight/2
            const imageY = (frameHeight / 2) - borderTop - (imgHeight / 2);

            return (
              <group key={photo.id} scale={0}> 
                  
                  {/* Polaroid Paper Backing */}
                  <mesh position={[0, 0, -0.01]}>
                      <boxGeometry args={[frameWidth, frameHeight, 0.02]} />
                      <meshStandardMaterial color="#F8F8F8" roughness={0.6} />
                  </mesh>
                  
                  {/* The Image */}
                  <Image 
                      url={photo.url} 
                      transparent 
                      opacity={1}
                      side={THREE.DoubleSide}
                      position={[0, imageY, 0.02]} // Slightly in front
                      scale={[imgWidth, imgHeight]} // Explicit scale to match aspect ratio
                  />
              </group>
            );
        })}
      </group>
    );
  };

export default PhotosWithStrings;