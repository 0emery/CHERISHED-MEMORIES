import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { generateFairyLights } from '../utils/math';
import { AppState } from '../types';

interface FairyLightsProps {
  appState: AppState;
}

const vertexShader = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPixelRatio;

  attribute vec3 aChaosPos;
  attribute vec3 aTargetPos;
  attribute float aPhase; // Blinking phase

  varying float vAlpha;

  void main() {
    float t = uProgress;
    // Cubic ease
    float ease = t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;

    vec3 pos = mix(aChaosPos, aTargetPos, ease);
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size varies slightly
    gl_PointSize = (25.0 * uPixelRatio) * (1.0 / -mvPosition.z);
    
    // Blinking logic
    // Sine wave based on time + random phase
    float blink = sin(uTime * 2.0 + aPhase); 
    // Map -1..1 to 0.2..1.0
    float brightness = 0.6 + 0.4 * blink;
    
    vAlpha = brightness;
    
    // Fade out if in chaos mode (optional, or keep them floating as stars)
    // Let's keep them visible but fully opaque in formed state
    if (uProgress < 0.5) {
        vAlpha *= 0.5;
    }
  }
`;

const fragmentShader = `
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord.xy - 0.5;
    float r = length(uv);
    if (r > 0.5) discard;

    // Soft light glow
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 2.0);

    // Warm light color #FFF8E7
    vec3 color = vec3(1.0, 0.97, 0.9);

    gl_FragColor = vec4(color, vAlpha * glow);
  }
`;

const FairyLights: React.FC<FairyLightsProps> = ({ appState }) => {
    const meshRef = useRef<THREE.Points>(null);
    const uniforms = useRef({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    });
  
    const { positions, chaosPositions, phases } = useMemo(
      () => generateFairyLights(2000, 15, 5.5), 
      []
    );
  
    useFrame((state, delta) => {
      if (meshRef.current) {
        uniforms.current.uTime.value = state.clock.elapsedTime;
        
        const targetProgress = appState === AppState.FORMED || appState === AppState.FOCUS ? 1 : 0;
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
              array={positions} 
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
              attach="attributes-aPhase"
              count={phases.length}
              array={phases}
              itemSize={1}
            />
          </bufferGeometry>
          <shaderMaterial
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={uniforms.current}
            transparent
          />
        </points>
      );
};

export default FairyLights;