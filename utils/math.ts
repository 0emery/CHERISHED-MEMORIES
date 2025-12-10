import * as THREE from 'three';
import { OrnamentData, PhotoData } from '../types';

export const randomSpherePoint = (radius: number): THREE.Vector3 => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random()) * radius;
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    r * sinPhi * Math.cos(theta),
    r * sinPhi * Math.sin(theta),
    r * Math.cos(phi)
  );
};

// Generates points on a cone surface (spiral distribution)
export const generateTreePositions = (count: number, height: number, radius: number) => {
  const positions = new Float32Array(count * 3);
  const chaosPositions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const orientations = new Float32Array(count); // Rotation for needles
  
  // Darker, richer pine colors
  const greenBase = new THREE.Color('#012115'); // Very Dark Emerald
  const greenLight = new THREE.Color('#0f422c'); // Deep Forest Green
  const greenTip = new THREE.Color('#1a5e41'); // Slightly lighter tip
  
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const angle = t * Math.PI * 80; // Dense winding
    const y = t * height - height / 2;
    const r = (1 - t) * radius;
    
    // Increased noise for bushy "Pine" look
    // Deep volume: some particles exist deeper inside the cone
    const rNoise = r * (0.6 + Math.random() * 0.8); 
    
    const x = Math.cos(angle) * rNoise;
    const z = Math.sin(angle) * rNoise;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const spherePos = randomSpherePoint(15);
    chaosPositions[i * 3] = spherePos.x;
    chaosPositions[i * 3 + 1] = spherePos.y;
    chaosPositions[i * 3 + 2] = spherePos.z;

    // Color variation: Depth mix
    const mixFactor = Math.random();
    const color = new THREE.Color().lerpColors(greenBase, mixFactor > 0.7 ? greenTip : greenLight, mixFactor);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    // Random orientation 0 - PI
    orientations[i] = Math.random() * Math.PI;
  }

  return { positions, chaosPositions, colors, orientations };
};

export const generateOrnaments = (count: number, treeHeight: number, treeRadius: number): OrnamentData[] => {
  const data: OrnamentData[] = [];
  
  // Specific Palette
  const goldColor = new THREE.Color('#FFD700');
  const velvetColor = new THREE.Color('#8a0303'); // Deep Red
  const boxColors = [new THREE.Color('#D4AF37'), new THREE.Color('#8a0303'), new THREE.Color('#FFFFFF')];

  for (let i = 0; i < count; i++) {
    const rand = Math.random();
    let type: 'box' | 'gold_ball' | 'velvet_ball' = 'gold_ball';
    let scale = 0.3;
    let speed = 1.0;
    let color = goldColor;

    if (rand > 0.85) {
      type = 'box'; 
      scale = 0.5 + Math.random() * 0.3;
      speed = 0.5;
      color = boxColors[Math.floor(Math.random() * boxColors.length)];
    } else if (rand > 0.45) {
      type = 'velvet_ball'; // Red Velvet
      scale = 0.35 + Math.random() * 0.2;
      speed = 1.0;
      color = velvetColor;
    } else {
      type = 'gold_ball'; // Gold Metal
      scale = 0.3 + Math.random() * 0.2;
      speed = 1.1; // Gold moves slightly lighter
      color = goldColor;
    }

    const t = Math.random();
    const y = t * treeHeight - treeHeight / 2;
    const r = (1 - t) * treeRadius;
    const angle = Math.random() * Math.PI * 2;
    
    // Push ornaments out slightly more to sit ON TOP of dense foliage
    const rOffset = r + 0.5; 
    
    const targetPos = new THREE.Vector3(
      Math.cos(angle) * rOffset,
      y,
      Math.sin(angle) * rOffset
    );

    data.push({
      id: i,
      type,
      color,
      chaosPos: randomSpherePoint(20),
      targetPos,
      scale,
      rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0),
      speedMultiplier: speed
    });
  }
  return data;
};

// New: Fairy Lights Generator
export const generateFairyLights = (count: number, height: number, radius: number) => {
    const positions = new Float32Array(count * 3);
    const chaosPositions = new Float32Array(count * 3);
    const phases = new Float32Array(count); // For blinking offset

    for (let i = 0; i < count; i++) {
        const t = i / count;
        // Tighter spiral for lights, slightly inset
        const angle = t * Math.PI * 50 + (Math.random() * 0.5); 
        const y = t * height - height / 2;
        const r = (1 - t) * radius;
        
        // Random depth (some inside tree, some outside)
        const rVar = r + (Math.random() - 0.4) * 2.0; 

        const x = Math.cos(angle) * rVar;
        const z = Math.sin(angle) * rVar;

        positions[i*3] = x;
        positions[i*3+1] = y;
        positions[i*3+2] = z;

        const spherePos = randomSpherePoint(12);
        chaosPositions[i*3] = spherePos.x;
        chaosPositions[i*3+1] = spherePos.y;
        chaosPositions[i*3+2] = spherePos.z;

        phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, chaosPositions, phases };
};

export const generateRibbonCurve = (height: number, maxRadius: number) => {
  const points: THREE.Vector3[] = [];
  
  // Specific geometry matching Ribbon.tsx visual shape
  // Radius: 8 -> 1
  // Height: -6 -> 8
  // Turns: 3
  
  const turns = 3;
  const numPoints = 200;
  const yStart = -6;
  const yEnd = 8;
  const rStart = 8;
  const rEnd = 1;
  
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    
    const y = THREE.MathUtils.lerp(yStart, yEnd, t);
    const r = THREE.MathUtils.lerp(rStart, rEnd, t);
    const angle = t * Math.PI * 2 * turns;
    
    points.push(new THREE.Vector3(
      Math.cos(angle) * r,
      y,
      Math.sin(angle) * r
    ));
  }
  return new THREE.CatmullRomCurve3(points);
};

export const generatePhotoPositions = (
  sourcePhotos: { id: string, url: string, aspectRatio: number }[], 
  treeHeight: number, 
  treeRadius: number
): PhotoData[] => {
  const curve = generateRibbonCurve(treeHeight, treeRadius);
  
  return sourcePhotos.map((photo, i) => {
    let t = 0.5;
    if (sourcePhotos.length > 1) {
        t = 0.15 + (i / (sourcePhotos.length - 1)) * 0.7;
    } else if (sourcePhotos.length === 1) {
        t = 0.5;
    }
    
    const pointOnRibbon = curve.getPointAt(t);
    const dropDist = 1.0;
    
    const targetPos = new THREE.Vector3(
        pointOnRibbon.x,
        pointOnRibbon.y - dropDist,
        pointOnRibbon.z
    );
    
    const lookAtPos = new THREE.Vector3(0, targetPos.y, 0); 
    const dummy = new THREE.Object3D();
    dummy.position.copy(targetPos);
    dummy.lookAt(lookAtPos); 
    dummy.rotateY(Math.PI); 
    dummy.rotateZ((Math.random() - 0.5) * 0.1); 
    
    return {
      id: photo.id, 
      url: photo.url,
      aspectRatio: photo.aspectRatio,
      chaosPos: randomSpherePoint(25), 
      targetPos,
      rotation: dummy.rotation.clone(),
      scale: 1.2,
      ribbonPoint: pointOnRibbon
    };
  });
};