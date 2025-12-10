import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppState } from '../types';
import { randomSpherePoint } from '../utils/math';

interface OrbitingParticlesProps {
  appState: AppState;
}

const vertexShader = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPixelRatio;

  attribute vec3 aChaosPos;
  attribute vec3 aTargetPos;
  attribute float aSize;
  attribute float aSpeed;
  attribute float aOffset;

  varying float vAlpha;

  void main() {
    float t = uProgress;
    // Smooth cubic ease
    float ease = t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;

    // Interpolate between chaos and target (cylindrical/conical formation)
    vec3 pos = mix(aChaosPos, aTargetPos, ease);

    // --- Orbiting Logic ---
    // Only apply rotation when formed (or transitioning) to create the "swirl" effect
    if (uProgress > 0.01) {
        // Calculate dynamic angle
        // aSpeed controls how fast this specific particle orbits
        float angle = uTime * aSpeed * 0.3 + aOffset; 
        
        // We want to rotate the current position around the Y axis
        // aTargetPos sets the initial "shell" radius and height
        float radius = length(pos.xz);
        float currentAngle = atan(pos.z, pos.x);
        
        // Blend rotation: chaos positions don't rotate, formed ones do
        float finalAngle = currentAngle + angle * ease; 
        
        pos.x = cos(finalAngle) * radius;
        pos.z = sin(finalAngle) * radius;
        
        // Add vertical floating (bobbing)
        pos.y += sin(uTime * 1.0 + aOffset) * 0.8 * ease;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // --- Size Logic ---
    // Large particles to be "obvious" as requested
    // aSize is base size (3-7), multiplied by pixel ratio and perspective scaling
    gl_PointSize = (aSize * uPixelRatio) * (80.0 / -mvPosition.z);

    vAlpha = 0.5 + 0.5 * sin(uTime * 2.0 + aOffset); // Dynamic opacity
  }
`;

const fragmentShader = `
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord.xy - 0.5;
    float r = length(uv);
    if (r > 0.5) discard;

    // Strong radial gradient for a "glowing orb" look
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);

    // Pure White
    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * glow);
  }
`;

const OrbitingParticles: React.FC<OrbitingParticlesProps> = ({ appState }) => {
  const meshRef = useRef<THREE.Points>(null);
  const uniforms = useRef({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  });

  const count = 500; // Enough to be visible, not too crowded

  const { positions, chaosPositions, sizes, speeds, offsets } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const chaosPositions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        // Distribute along height
        const t = i / count;
        const h = 25; // Taller than the tree (16)
        const y = (t * h) - (h/2);
        
        // Radius: Wide spiral
        // Base radius 12, top radius 4 (Conical)
        const rBase = 12; 
        const rTop = 4;
        const r = THREE.MathUtils.lerp(rBase, rTop, t) + (Math.random() * 2 - 1);
        
        // Spiral angle
        const angle = t * Math.PI * 8; // 4 full turns
        
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        
        positions[i*3] = x;
        positions[i*3+1] = y;
        positions[i*3+2] = z;

        // Chaos: Random cloud
        const c = randomSpherePoint(30);
        chaosPositions[i*3] = c.x;
        chaosPositions[i*3+1] = c.y;
        chaosPositions[i*3+2] = c.z;

        // Attributes
        sizes[i] = 4.0 + Math.random() * 4.0; // Large size: 4.0 to 8.0
        speeds[i] = 0.5 + Math.random() * 0.5; // Rotation speed
        offsets[i] = Math.random() * Math.PI * 2;
    }

    return { positions, chaosPositions, sizes, speeds, offsets };
  }, []);

  useFrame((state, delta) => {
    if (meshRef.current) {
        uniforms.current.uTime.value = state.clock.elapsedTime;
        
        const targetProgress = (appState === AppState.FORMED || appState === AppState.FOCUS) ? 1 : 0;
        
        uniforms.current.uProgress.value = THREE.MathUtils.lerp(
            uniforms.current.uProgress.value,
            targetProgress,
            delta * 0.6 // Slightly slower transition than others
        );
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aTargetPos" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aChaosPos" count={count} array={chaosPositions} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-aSpeed" count={count} array={speeds} itemSize={1} />
        <bufferAttribute attach="attributes-aOffset" count={count} array={offsets} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial 
        vertexShader={vertexShader} 
        fragmentShader={fragmentShader} 
        uniforms={uniforms.current}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export default OrbitingParticles;