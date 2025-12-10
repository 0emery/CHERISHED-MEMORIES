import React, { useRef, useImperativeHandle } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import Foliage from './Foliage';
import Ornaments from './Ornaments';
import Photos from './Photos';
import Ribbon from './Ribbon';
import Star from './Star'; 
import FairyLights from './FairyLights';
import { AppState, PhotoData } from '../types';

interface TreeGroupProps {
  appState: AppState;
  handRotation?: { x: number, y: number } | null;
  photos: PhotoData[];
  groupRef: React.RefObject<THREE.Group | null>; 
  featuredPhotoId: string | null;
}

const TreeGroup: React.FC<TreeGroupProps> = ({ appState, handRotation, photos, groupRef, featuredPhotoId }) => {
  const { size } = useThree();

  // Physics state for rotation
  const angularVelocity = useRef(0);
  const lastPointerX = useRef(0);
  const isDragging = useRef(false);
  const currentRotationY = useRef(0);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDragging.current = true;
    lastPointerX.current = e.clientX;
    // @ts-ignore
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    isDragging.current = false;
    // @ts-ignore
    e.target.releasePointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) return;
    
    const deltaX = e.clientX - lastPointerX.current;
    lastPointerX.current = e.clientX;
    if (size.width > 0) {
        angularVelocity.current += (deltaX / size.width) * 15; 
    }
  };

  useFrame((_, delta) => {
    if (groupRef.current) {
      // Allowed normal rotation logic even in FOCUS mode for inspection
      
      if (handRotation) {
        // --- HAND CONTROL MODE ---
        const targetRotY = (handRotation.x - 0.5) * Math.PI * 2; 
        const targetTiltX = (handRotation.y - 0.5) * 0.5; 
        
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, delta * 3);
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetTiltX, delta * 3);
        
        angularVelocity.current = 0;
        currentRotationY.current = groupRef.current.rotation.y;

      } else {
        // --- PHYSICS/MOUSE MODE ---
        currentRotationY.current += angularVelocity.current * delta * 10;
        angularVelocity.current *= 0.95;

        // Keep spinning slowly if idle
        if ((appState === AppState.FORMED || appState === AppState.CHAOS || appState === AppState.FOCUS) && !isDragging.current && Math.abs(angularVelocity.current) < 0.05) {
           currentRotationY.current += delta * 0.1;
        }

        if (!isNaN(currentRotationY.current)) {
            groupRef.current.rotation.y = currentRotationY.current;
        }
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, delta);
      }
    }
  });

  return (
    <group>
        <mesh 
            visible={false} 
            onPointerDown={handlePointerDown} 
            onPointerUp={handlePointerUp} 
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerUp}
        >
            <cylinderGeometry args={[6, 6, 16, 16]} />
            <meshBasicMaterial transparent opacity={0} />
        </mesh>
        
        <group ref={groupRef}>
            <Foliage appState={appState} />
            <Ornaments appState={appState} />
            <FairyLights appState={appState} />
            {/* Merged Ribbon handles both ribbon and aura particles now */}
            <Ribbon appState={appState} />
            <Photos appState={appState} photos={photos} featuredPhotoId={featuredPhotoId} />
            {/* Always visible, let Star handle its own positioning via appState */}
            <Star appState={appState} />
        </group>
    </group>
  );
};

export default TreeGroup;