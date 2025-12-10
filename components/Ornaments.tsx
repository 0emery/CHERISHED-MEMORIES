import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppState, OrnamentData } from '../types';
import { generateOrnaments } from '../utils/math';

interface OrnamentsProps {
  appState: AppState;
}

const Ornaments: React.FC<OrnamentsProps> = ({ appState }) => {
  const boxMeshRef = useRef<THREE.InstancedMesh>(null);
  const goldMeshRef = useRef<THREE.InstancedMesh>(null);
  const velvetMeshRef = useRef<THREE.InstancedMesh>(null);
  
  const ornamentData = useMemo(() => generateOrnaments(450, 15, 5.5), []);
  
  const boxes = useMemo(() => ornamentData.filter(o => o.type === 'box'), [ornamentData]);
  const goldBalls = useMemo(() => ornamentData.filter(o => o.type === 'gold_ball'), [ornamentData]);
  const velvetBalls = useMemo(() => ornamentData.filter(o => o.type === 'velvet_ball'), [ornamentData]);

  // Temporary object for matrix calculations
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Store current positions for manual interpolation
  const currentPositions = useRef(new Map<number, THREE.Vector3>());

  useLayoutEffect(() => {
    // Initialize current positions to chaos
    ornamentData.forEach(o => {
      currentPositions.current.set(o.id, o.chaosPos.clone());
    });
  }, [ornamentData]);

  useFrame((_, delta) => {
    const isFormed = appState === AppState.FORMED;

    const updateMesh = (mesh: THREE.InstancedMesh, items: OrnamentData[], hasColor: boolean) => {
      let needsUpdate = false;
      
      items.forEach((item, i) => {
        const currentPos = currentPositions.current.get(item.id)!;
        const target = isFormed ? item.targetPos : item.chaosPos;
        
        // Physics-based Lerp: Heavier items move slower
        const speed = 2.0 * item.speedMultiplier * delta;
        
        // Only update if not close enough
        if (currentPos.distanceToSquared(target) > 0.01) {
           currentPos.lerp(target, speed);
           needsUpdate = true;
        }

        dummy.position.copy(currentPos);
        dummy.scale.setScalar(item.scale);
        
        // Rotate ornaments
        dummy.rotation.copy(item.rotation);
        if (isFormed) {
            dummy.rotation.y += delta * 0.5 * item.speedMultiplier;
            dummy.rotation.x += delta * 0.2;
        } else {
            dummy.rotation.x += delta;
            dummy.rotation.z += delta;
        }

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        
        // Only boxes need dynamic color application per instance
        if (hasColor) {
             mesh.setColorAt(i, item.color);
        }
      });

      if (needsUpdate || isFormed) {
        mesh.instanceMatrix.needsUpdate = true;
        if (hasColor && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    };

    if (boxMeshRef.current) updateMesh(boxMeshRef.current, boxes, true);
    if (goldMeshRef.current) updateMesh(goldMeshRef.current, goldBalls, false); // Material color handles it
    if (velvetMeshRef.current) updateMesh(velvetMeshRef.current, velvetBalls, false);
  });

  return (
    <group>
      {/* Boxes (Gift Wrapped) */}
      <instancedMesh ref={boxMeshRef} args={[undefined, undefined, boxes.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.3} metalness={0.6} />
      </instancedMesh>

      {/* Gold Balls (High Polish Metal) */}
      <instancedMesh ref={goldMeshRef} args={[undefined, undefined, goldBalls.length]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial 
            color="#FFD700" 
            roughness={0.15} 
            metalness={1.0} 
            envMapIntensity={1.5}
        />
      </instancedMesh>

      {/* Velvet Balls (Red with Clearcoat) */}
      <instancedMesh ref={velvetMeshRef} args={[undefined, undefined, velvetBalls.length]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshPhysicalMaterial 
            color="#8a0303" 
            roughness={0.6} // Velvet texture base
            metalness={0.1}
            clearcoat={1.0} // Glassy glaze on top
            clearcoatRoughness={0.1}
            sheen={1.0} // Soft sheen
            sheenColor="#ff0000"
            envMapIntensity={1.0}
        />
      </instancedMesh>
    </group>
  );
};

export default Ornaments;