import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { generateTreePositions } from '../utils/math';
import { AppState } from '../types';

interface FoliageProps {
  appState: AppState;
}

const vertexShader = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPixelRatio;

  attribute vec3 aChaosPos;
  attribute vec3 aTargetPos;
  attribute vec3 aColor;
  attribute float aOrientation;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vOrientation;

  void main() {
    vColor = aColor;
    vOrientation = aOrientation;

    // Cubic easing for smoother transition
    float t = uProgress;
    float ease = t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;

    vec3 pos = mix(aChaosPos, aTargetPos, ease);
    
    // Add "breathing" effect when formed
    if (uProgress > 0.9) {
      float wind = sin(uTime * 1.5 + pos.y * 0.5) * 0.05;
      pos.x += wind;
      pos.z += wind;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Increase size for needle visibility
    // Scaling based on distance
    gl_PointSize = (40.0 * uPixelRatio) * (1.0 / -mvPosition.z);
    
    // Fade out slightly during chaos
    vAlpha = 0.8 + 0.2 * ease; 
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vOrientation;

  void main() {
    // 1. Center UV coordinates (-0.5 to 0.5)
    vec2 center = gl_PointCoord.xy - 0.5;
    
    // 2. Rotate UVs based on aOrientation attribute
    float s = sin(vOrientation);
    float c = cos(vOrientation);
    
    vec2 rotUV = vec2(
        center.x * c - center.y * s,
        center.x * s + center.y * c
    );
    
    // 3. Define Needle Shape
    // Thin width (X) and longer length (Y)
    // Adjust these values to change needle thickness/length ratio
    // rotUV range is approx -0.5 to 0.5
    if (abs(rotUV.x) > 0.04 || abs(rotUV.y) > 0.45) discard;
    
    // 4. Soft edges for the needle (anti-aliasing)
    float distX = abs(rotUV.x);
    float distY = abs(rotUV.y);
    float alphaMask = 1.0;
    
    // Fade edges
    alphaMask *= smoothstep(0.04, 0.02, distX);
    alphaMask *= smoothstep(0.45, 0.35, distY);

    // Apply color and lighting hint
    // Make tip slightly lighter (simulated by Y pos in needle)
    vec3 finalColor = vColor;
    finalColor += vec3(0.1) * (rotUV.y + 0.5); // Gradient along the needle length

    gl_FragColor = vec4(finalColor, vAlpha * alphaMask);
  }
`;

const Foliage: React.FC<FoliageProps> = ({ appState }) => {
  const meshRef = useRef<THREE.Points>(null);
  const uniforms = useRef({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  });

  // Increased density to 45,000 for realistic pine look
  // Radius 5.5 to slightly overlap with ribbon
  const { positions, chaosPositions, colors, orientations } = useMemo(
    () => generateTreePositions(45000, 15, 5.5), 
    []
  );

  useFrame((state, delta) => {
    if (meshRef.current) {
      uniforms.current.uTime.value = state.clock.elapsedTime;
      
      const targetProgress = (appState === AppState.FORMED || appState === AppState.FOCUS) ? 1 : 0;
      // Smooth lerp for the global transition
      uniforms.current.uProgress.value = THREE.MathUtils.lerp(
        uniforms.current.uProgress.value,
        targetProgress,
        delta * 0.8
      );
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions} // Initial buffer
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aTargetPos"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aChaosPos"
          count={chaosPositions.length / 3}
          array={chaosPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aColor"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aOrientation"
          count={orientations.length}
          array={orientations}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        depthWrite={false}
        transparent={true}
        // Use Normal blending for foliage to prevent over-exposure
        blending={THREE.NormalBlending}
        vertexColors
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms.current}
      />
    </points>
  );
};

export default Foliage;