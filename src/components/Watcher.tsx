import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial, Vector3 } from 'three';
import { watcherShader } from '../shaders';
import { WatcherData } from '../types';

export const Watcher = ({ data, localPlayerPos }: { data: WatcherData, localPlayerPos: [number, number, number] }) => {
  const meshRef = useRef<any>(null);
  
  const material = useMemo(() => new ShaderMaterial(watcherShader), []);

  useFrame((state, delta) => {
    if (material) {
      material.uniforms.time_u.value = state.clock.getElapsedTime();
      
      const dist = new Vector3(...data.position).distanceTo(new Vector3(...localPlayerPos));
      const intensity = Math.max(0.02, Math.min(0.15, 1.0 - dist / 20.0));
      material.uniforms.dist_intensity.value = intensity;
    }
    
    if (meshRef.current) {
      meshRef.current.position.lerp(new Vector3(...data.position), 0.1);
    }
  });

  return (
    <group ref={meshRef}>
      {/* Humanoid-ish body */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1.8, 8]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* Featureless Head */}
      <mesh position={[0, 1.9, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
};
