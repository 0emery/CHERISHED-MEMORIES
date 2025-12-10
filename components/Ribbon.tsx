import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { randomSpherePoint } from '../utils/math';
import { AppState } from '../types';
import { useFrame } from '@react-three/fiber';

interface RibbonProps {
  appState: AppState;
}

const vertexShader = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPixelRatio;
  
  attribute vec3 aChaosPos;
  attribute vec3 aTargetPos;
  attribute float aSize;
  attribute float aAlpha; 
  attribute float aType; // 0.0 = Ribbon, 1.0 = Snow
  attribute float aSpeed;
  attribute float aOffset;
  
  varying float vAlpha;
  varying float vType;

  void main() {
    vType = aType;
    float t = uProgress;
    
    // Smooth cubic easing
    float ease = t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
    
    vec3 currentPos = aTargetPos;

    // --- LOGIC BASED ON TYPE ---
    if (aType > 0.5) {
        // === SNOW PARTICLES (Falling) ===
        // Only fall when formed (or forming)
        if (uProgress > 0.01) {
            float fallSpeed = aSpeed * 3.0;
            // Downward movement based on time
            float yDrop = uTime * fallSpeed;
            
            // Apply drop to initial Y, wrap around height (Infinite loop)
            // Range: Falls from +20 down to -20, then loops
            float heightRange = 40.0;
            float currentY = aTargetPos.y - yDrop;
            
            // Modulo arithmetic for wrapping: ((y + 20) % 40) - 20
            currentPos.y = mod(currentY + 20.0, heightRange) - 20.0;
            
            // Add gentle sway (Wind)
            currentPos.x += sin(uTime * 0.5 + aOffset) * 0.5;
            currentPos.z += cos(uTime * 0.3 + aOffset) * 0.5;
        }
    } else {
        // === RIBBON PARTICLES (Conical Spiral Line) ===
        // Gentle breathing/pulsing
        if (uProgress > 0.9) {
             currentPos.y += sin(uTime * 1.5 + aOffset) * 0.05;
             // Subtle expansion/contraction
             float breath = 1.0 + sin(uTime + aOffset) * 0.02;
             currentPos.x *= breath;
             currentPos.z *= breath;
        }
    }

    // Blend from Chaos to Calculated Position
    vec3 pos = mix(aChaosPos, currentPos, ease);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    float distScale = (aType > 0.5) ? 50.0 : 25.0; // Snow is bigger
    gl_PointSize = (aSize * uPixelRatio) * (distScale / -mvPosition.z);
    
    vAlpha = aAlpha;
    
    // Fade in snow based on progress
    if (aType > 0.5) {
        vAlpha *= smoothstep(0.0, 0.5, uProgress);
    }
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying float vType;

  void main() {
    vec2 uv = gl_PointCoord.xy - 0.5;
    float r = length(uv);
    if (r > 0.5) discard;

    // --- GLOWING SPHERE EFFECT ---
    // Radial gradient: Bright center, soft edges
    float glow = 1.0 - (r * 2.0);
    
    if (vType > 0.5) {
        // Snow: Soft, fluffy glow
        glow = pow(glow, 2.0);
    } else {
        // Ribbon: Sharper, intense point of light
        glow = pow(glow, 3.0);
    }

    // Pure White Color for everything
    vec3 finalColor = vec3(1.0, 1.0, 1.0);

    gl_FragColor = vec4(finalColor, vAlpha * glow);
  }
`;

const Ribbon: React.FC<RibbonProps> = ({ appState }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useRef({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
  });

  const geometry = useMemo(() => {
    // --- CONFIGURATION ---
    const ribbonCount = 22000; 
    const snowCount = 1000;    
    const totalCount = ribbonCount + snowCount;
    
    const positions = new Float32Array(totalCount * 3); 
    const chaosPositions = new Float32Array(totalCount * 3);
    const sizes = new Float32Array(totalCount);
    const alphas = new Float32Array(totalCount);
    const types = new Float32Array(totalCount); 
    const speeds = new Float32Array(totalCount);
    const offsets = new Float32Array(totalCount);
    
    // --- 1. GENERATE RIBBON PARTICLES (Conical Line, 3 Turns) ---
    // New: Bottom -6. Top 8.
    const yStart = -6;
    const yEnd = 8;
    const turns = 3; 
    
    for (let i = 0; i < ribbonCount; i++) {
        const t = i / ribbonCount;
        
        // Calculate Spiral Position
        const angle = t * Math.PI * 2 * turns;
        
        // Height: Linear interpolation from Bottom (-6) to Top (8)
        const yBase = THREE.MathUtils.lerp(yStart, yEnd, t);
        
        // Wide Conical Radius: Wide at bottom (8), Narrow at top (1)
        const rBase = THREE.MathUtils.lerp(8, 1, t);
        
        const xBase = Math.cos(angle) * rBase;
        const zBase = Math.sin(angle) * rBase;
        
        // Random offset to create a "volumetric line"
        // Tighter scatter to form a defined line
        const scatter = 0.4; 
        
        positions[i*3] = xBase + (Math.random() - 0.5) * scatter;
        positions[i*3+1] = yBase + (Math.random() - 0.5) * scatter;
        positions[i*3+2] = zBase + (Math.random() - 0.5) * scatter;
        
        // Ribbon Chaos
        const sphereChaos = randomSpherePoint(12);
        chaosPositions[i*3] = sphereChaos.x;
        chaosPositions[i*3+1] = sphereChaos.y;
        chaosPositions[i*3+2] = sphereChaos.z;

        sizes[i] = Math.random() * 1.5 + 0.5; 
        alphas[i] = Math.random() * 0.3 + 0.7; 
        types[i] = 0.0;
        speeds[i] = 0.0; 
        offsets[i] = Math.random() * Math.PI * 2;
    }

    // --- 2. GENERATE SNOW PARTICLES (Falling) ---
    for (let i = ribbonCount; i < totalCount; i++) {
        // Random distribution in a large cylinder around tree
        const r = 4.0 + Math.random() * 15.0; // Wide area
        const angle = Math.random() * Math.PI * 2;
        
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = (Math.random() - 0.5) * 40.0; // Spread vertically
        
        positions[i*3] = x;
        positions[i*3+1] = y;
        positions[i*3+2] = z;
        
        // Snow Chaos
        const c = randomSpherePoint(40);
        chaosPositions[i*3] = c.x;
        chaosPositions[i*3+1] = c.y;
        chaosPositions[i*3+2] = c.z;

        sizes[i] = 3.0 + Math.random() * 4.0; // Larger "flakes"
        alphas[i] = Math.random() * 0.4 + 0.4;
        types[i] = 1.0;
        speeds[i] = 0.5 + Math.random() * 1.5; // Falling speed variation
        offsets[i] = Math.random() * Math.PI * 2;
    }
    
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3)); 
    geom.setAttribute('aTargetPos', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aChaosPos', new THREE.BufferAttribute(chaosPositions, 3));
    geom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    geom.setAttribute('aType', new THREE.BufferAttribute(types, 1));
    geom.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geom.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
    
    return geom;
  }, []);

  useFrame((state, delta) => {
    if (materialRef.current) {
        uniforms.current.uTime.value = state.clock.elapsedTime;
        
        const targetProgress = (appState === AppState.FORMED || appState === AppState.FOCUS) ? 1 : 0;
        
        uniforms.current.uProgress.value = THREE.MathUtils.lerp(
            uniforms.current.uProgress.value,
            targetProgress,
            delta * 0.8
        );
        
        materialRef.current.uniforms.uProgress.value = uniforms.current.uProgress.value;
        materialRef.current.uniforms.uTime.value = uniforms.current.uTime.value;
    }
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial 
          ref={materialRef}
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

export default Ribbon;