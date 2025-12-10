import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const COUNT = 1500; // Increased count for snow mix

const GoldDust: React.FC = () => {
  const { viewport } = useThree();
  const mesh = useRef<THREE.Points>(null);
  
  // Physics state
  const particles = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const gravity = new Float32Array(COUNT); // Per-particle gravity
    
    const goldColor = new THREE.Color('#F1D97A');
    const whiteColor = new THREE.Color('#FFFFFF');
    const tempColor = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      
      vel[i * 3] = (Math.random() - 0.5) * 0.1;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.1;

      // Mix Gold (70%) and White (30%)
      const isSnow = Math.random() > 0.7;
      
      if (isSnow) {
        tempColor.copy(whiteColor);
        // Snow falls gently
        gravity[i] = 0.0005 + Math.random() * 0.002;
      } else {
        tempColor.copy(goldColor);
        // Gold dust gravity
        gravity[i] = 0.001 + Math.random() * 0.003;
      }

      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }
    
    return { pos, vel, colors, gravity };
  }, []);

  const mouseVector = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((state) => {
    if (!mesh.current) return;

    // Map pointer (-1 to 1) to world space approx
    mouseVector.current.set(
      (state.pointer.x * viewport.width) / 2,
      (state.pointer.y * viewport.height) / 2,
      5 
    );

    const positions = mesh.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      let x = positions[ix];
      let y = positions[iy];
      let z = positions[iz];

      // 1. Gravity (Variable per particle)
      particles.vel[iy] -= particles.gravity[i];

      // 2. Mouse Attraction (Local only)
      const dx = mouseVector.current.x - x;
      const dy = mouseVector.current.y - y;
      const dz = mouseVector.current.z - z;
      
      const distSq = dx*dx + dy*dy + dz*dz;
      
      if (distSq < 36) { 
        const force = (36 - distSq) * 0.0015; 
        particles.vel[ix] += dx * force;
        particles.vel[iy] += dy * force;
        particles.vel[iz] += dz * force;
      }

      // 3. Turbulence
      particles.vel[ix] += (Math.random() - 0.5) * 0.02;
      particles.vel[iy] += (Math.random() - 0.5) * 0.02;
      particles.vel[iz] += (Math.random() - 0.5) * 0.02;

      // 4. Drag
      particles.vel[ix] *= 0.96;
      particles.vel[iy] *= 0.96;
      particles.vel[iz] *= 0.96;

      // 5. Update Position
      x += particles.vel[ix];
      y += particles.vel[iy];
      z += particles.vel[iz];

      // 6. Boundary Check & Recycling
      if (y < -25) {
        y = 25;
        x = (Math.random() - 0.5) * 40;
        z = (Math.random() - 0.5) * 40;
        
        particles.vel[ix] = (Math.random() - 0.5) * 0.1;
        particles.vel[iy] = -0.1;
        particles.vel[iz] = (Math.random() - 0.5) * 0.1;
      }

      positions[ix] = x;
      positions[iy] = y;
      positions[iz] = z;
    }

    mesh.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={particles.pos}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={COUNT}
          array={particles.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.15}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

export default GoldDust;