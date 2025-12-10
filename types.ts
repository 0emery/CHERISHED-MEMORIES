import * as THREE from 'three';

export enum AppState {
  CHAOS = 'CHAOS',
  FORMED = 'FORMED',
  FOCUS = 'FOCUS',
}

export interface DualPosition {
  chaos: THREE.Vector3;
  target: THREE.Vector3;
}

export interface OrnamentData {
  id: number;
  type: 'box' | 'gold_ball' | 'velvet_ball'; // Luxury types
  color: THREE.Color;
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  scale: number;
  rotation: THREE.Euler;
  speedMultiplier: number; 
}

export interface PhotoData {
  id: string;
  url: string;
  aspectRatio: number; // Width / Height
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  scale: number;
  rotation: THREE.Euler;
  ribbonPoint?: THREE.Vector3; 
}
