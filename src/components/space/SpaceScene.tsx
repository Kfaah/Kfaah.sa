import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useRef, useMemo, Suspense } from "react";
import * as THREE from "three";

function Planet({
  position,
  size,
  color,
  emissive,
  rotationSpeed = 0.05,
  orbitRadius = 0,
  orbitSpeed = 0,
  orbitOffset = 0,
  ring,
}: {
  position: [number, number, number];
  size: number;
  color: string;
  emissive?: string;
  rotationSpeed?: number;
  orbitRadius?: number;
  orbitSpeed?: number;
  orbitOffset?: number;
  ring?: { inner: number; outer: number; color: string };
}) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (mesh.current) mesh.current.rotation.y += rotationSpeed * 0.01;
    if (group.current && orbitRadius > 0) {
      group.current.position.x = position[0] + Math.cos(t * orbitSpeed + orbitOffset) * orbitRadius;
      group.current.position.z = position[2] + Math.sin(t * orbitSpeed + orbitOffset) * orbitRadius;
    }
  });

  return (
    <group ref={group} position={position}>
      <mesh ref={mesh}>
        <sphereGeometry args={[size, 64, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive || color}
          emissiveIntensity={emissive ? 0.4 : 0.15}
          roughness={0.7}
          metalness={0.2}
        />
      </mesh>
      {ring && (
        <mesh rotation={[Math.PI / 2.3, 0, 0]}>
          <ringGeometry args={[ring.inner, ring.outer, 96]} />
          <meshBasicMaterial color={ring.color} side={THREE.DoubleSide} transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  );
}

function Nebula({ position, color, scale }: { position: [number, number, number]; color: string; scale: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.z = clock.getElapsedTime() * 0.01;
    }
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
    </mesh>
  );
}

function ShootingStars() {
  const ref = useRef<THREE.Points>(null);
  const count = 8;
  const data = useMemo(() => {
    const arr: { startTime: number; speed: number; offset: THREE.Vector3 }[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        startTime: Math.random() * 30,
        speed: 8 + Math.random() * 6,
        offset: new THREE.Vector3((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 30, -20 - Math.random() * 20),
      });
    }
    return arr;
  }, []);

  const positions = useMemo(() => new Float32Array(count * 3), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const d = data[i];
      const localT = ((t - d.startTime) % 12) / 12;
      positions[i * 3] = d.offset.x + localT * d.speed * 4;
      positions[i * 3 + 1] = d.offset.y - localT * d.speed * 2;
      positions[i * 3 + 2] = d.offset.z;
    }
    if (ref.current) {
      (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.4} transparent opacity={0.9} />
    </points>
  );
}

function Scene() {
  const camera = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (camera.current) {
      const t = clock.getElapsedTime();
      camera.current.rotation.y = Math.sin(t * 0.05) * 0.05;
      camera.current.rotation.x = Math.cos(t * 0.04) * 0.03;
    }
  });

  return (
    <group ref={camera}>
      <ambientLight intensity={0.25} />
      <pointLight position={[10, 10, 10]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-15, -8, -10]} intensity={0.6} color="#22d3ee" />
      <pointLight position={[15, -5, 5]} intensity={0.5} color="#10b981" />

      <Stars radius={120} depth={60} count={6000} factor={4} saturation={0} fade speed={0.4} />
      <Stars radius={80} depth={40} count={2500} factor={2.5} saturation={0.3} fade speed={0.7} />
      <Stars radius={40} depth={20} count={800} factor={1.5} saturation={0} fade speed={1.2} />

      <Nebula position={[-15, 8, -25]} color="#06b6d4" scale={14} />
      <Nebula position={[18, -10, -30]} color="#10b981" scale={16} />
      <Nebula position={[5, 12, -35]} color="#3b82f6" scale={12} />

      <Planet
        position={[-8, 3, -10]}
        size={1.6}
        color="#1e40af"
        emissive="#1e3a8a"
        rotationSpeed={0.3}
        orbitRadius={1.5}
        orbitSpeed={0.06}
      />
      <Planet
        position={[10, -4, -14]}
        size={2.2}
        color="#0e7490"
        emissive="#155e75"
        rotationSpeed={0.2}
        orbitRadius={2}
        orbitSpeed={0.04}
        orbitOffset={1}
        ring={{ inner: 3, outer: 4.2, color: "#67e8f9" }}
      />
      <Planet
        position={[-14, -6, -18]}
        size={1.1}
        color="#065f46"
        emissive="#047857"
        rotationSpeed={0.5}
        orbitRadius={1}
        orbitSpeed={0.08}
        orbitOffset={2.5}
      />
      <Planet
        position={[6, 8, -22]}
        size={0.7}
        color="#94a3b8"
        rotationSpeed={0.4}
        orbitRadius={0.8}
        orbitSpeed={0.1}
      />

      <ShootingStars />
    </group>
  );
}

export default function SpaceScene() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}