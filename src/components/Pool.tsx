import { useMemo } from "react";
import { CanvasTexture, DoubleSide, LinearFilter } from "three";

export function Pool() {
  const distanceMarkers = [10, 20, 30, 40];

  const distanceMarkerTextures = useMemo(
    () =>
      distanceMarkers.map((meters) => {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 128;

        const context = canvas.getContext("2d");
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = "#ffffff";
          context.font = "bold 72px Arial";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(`${meters}m`, canvas.width / 2, canvas.height / 2);
        }

        const texture = new CanvasTexture(canvas);
        texture.minFilter = LinearFilter;
        texture.needsUpdate = true;

        return { meters, texture };
      }),
    []
  );

  return (
    <group>
      {/* Pool Deck / Surroundings - Using 4 planes to create a hole */}
      <group position={[0, -0.01, 25]}>
        {/* Left deck */}
        <mesh position={[-6.25, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7.5, 60]} />
          <meshStandardMaterial color="#eeeeee" roughness={0.8} />
        </mesh>
        {/* Right deck */}
        <mesh position={[6.25, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7.5, 60]} />
          <meshStandardMaterial color="#eeeeee" roughness={0.8} />
        </mesh>
        {/* Front deck */}
        <mesh position={[0, 0, -27.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5, 5]} />
          <meshStandardMaterial color="#eeeeee" roughness={0.8} />
        </mesh>
        {/* Back deck */}
        <mesh position={[0, 0, 27.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5, 5]} />
          <meshStandardMaterial color="#eeeeee" roughness={0.8} />
        </mesh>
      </group>

      {/* Pool Interior - Floor and Walls (No top face to avoid z-fighting) */}
      <group position={[0, -1, 25]}>
        {/* Floor - Lightened for better contrast */}
        <mesh position={[0, -0.99, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.9, 50.9]} />
          <meshStandardMaterial color="#3388cc" roughness={1} metalness={0} />
        </mesh>
        {/* Walls - Lightened */}
        <mesh position={[-2.45, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[50.9, 2]} />
          <meshStandardMaterial color="#2277bb" roughness={1} metalness={0} side={DoubleSide} />
        </mesh>
        <mesh position={[2.45, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[50.9, 2]} />
          <meshStandardMaterial color="#2277bb" roughness={1} metalness={0} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0, -25.45]}>
          <planeGeometry args={[4.9, 2]} />
          <meshStandardMaterial color="#2277bb" roughness={1} metalness={0} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 25.45]}>
          <planeGeometry args={[4.9, 2]} />
          <meshStandardMaterial color="#2277bb" roughness={1} metalness={0} side={DoubleSide} />
        </mesh>
      </group>

      {/* Lane Lines - Black marking on floor */}
      <mesh position={[0, -1.98, 25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, 50]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* T-Markings at ends */}
      <mesh position={[0, -1.98, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 0.2]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh position={[0, -1.98, 49.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 0.2]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Distance markers - local canvas textures, no external font loading */}
      {distanceMarkerTextures.map(({ meters, texture }) => (
        <mesh
          key={meters}
          position={[1.45, -1.965, meters]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[1.6, 0.8]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.9}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      ))}

      {/* Water Surface - Extremely transparent to ensure swimmer visibility */}
      <mesh position={[0, 0.05, 25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.8, 50.8]} />
        <meshBasicMaterial 
          color="#e0f4ff" 
          transparent 
          opacity={0.05} 
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      {/* Starting Block */}
      <group position={[0, 0.2, -0.5]}>
        <mesh>
          <boxGeometry args={[0.5, 0.4, 0.5]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
        <mesh position={[0, 0.25, 0]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[0.6, 0.05, 0.6]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      </group>

      {/* Lane Ropes */}
      <group position={[-2.4, 0, 25]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 50, 8]} />
          <meshStandardMaterial color="#ff3333" />
        </mesh>
      </group>
      <group position={[2.4, 0, 25]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 50, 8]} />
          <meshStandardMaterial color="#ff3333" />
        </mesh>
      </group>

      {/* Floor Grid */}
      <gridHelper args={[200, 100, 0x000000, 0x000000]} position={[0, -2, 25]} />
    </group>
  );
}
