import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { AppState } from '../types';

interface StarProps {
    appState?: AppState;
}

const Star: React.FC<StarProps> = ({ appState }) => {
  const mesh = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  
  // Track target Y for smooth interpolation
  const currentY = useRef(10); 
  
  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 5;
    const outerRadius = 1.0;
    const innerRadius = 0.45;
    
    // Create star shape
    for (let i = 0; i < points * 2; i++) {
        // We want the first point to point UP (Y-axis)
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const a = (i / (points * 2)) * Math.PI * 2 - (Math.PI / 2);
        
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();
    
    const extrudeSettings = {
        steps: 1,
        depth: 0.3,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 2
    };
    
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center(); 
    return geo;
  }, []);

  useFrame((state, delta) => {
    if (mesh.current && group.current) {
        // 1. Rotation and Pulse
        mesh.current.rotation.y = state.clock.elapsedTime * 0.4;
        const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
        mesh.current.scale.set(scale, scale, scale);
        
        // 2. Position Interpolation
        // Target 10 when formed, move up to 16 when scattered (CHAOS)
        // Default to chaos if undefined, but usually defined
        const isChaos = appState === AppState.CHAOS;
        const targetY = isChaos ? 16 : 10;
        
        currentY.current = THREE.MathUtils.lerp(currentY.current, targetY, delta * 2.0);
        
        // Add bobbing effect on top of the interpolated base height
        const bob = Math.sin(state.clock.elapsedTime) * 0.3;
        group.current.position.y = currentY.current + bob;
    }
  });

  return (
    <group ref={group} position={[0, 10, 0]}>
        <mesh ref={mesh} geometry={starGeometry}>
            <meshStandardMaterial 
                color="#FFD700" 
                emissive="#FFD700"
                emissiveIntensity={2.0}
                metalness={1.0}
                roughness={0.1}
            />
        </mesh>
        <pointLight intensity={3.0} color="#FFD700" distance={15} decay={2} />
    </group>
  )
}
export default Star;