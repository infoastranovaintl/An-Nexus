import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { useTheme } from '../../lib/theme'

interface DamSceneProps {
  level: number
  sensors?: DamSensor[]
}

export interface DamSensor {
  id: string
  name: string
  frac: number | null
  online: boolean
  ts: number
}

interface Pal {
  sky: string
  fog: string
  ground: string
  mountain: string
  concrete: string
  face: string
  crest: string
  gate: string
  gateGlow: string
  water: string
  powerhouse: string
  window: string
  penstock: string
  ambient: number
  sun: string
  shadowStrength: number
}

const PAL_LIGHT: Pal = {
  sky: '#cfe4f4', fog: '#cddfee', ground: '#d7e6d4', mountain: '#b3c4d6',
  concrete: '#c3cfda', face: '#d4dde5', crest: '#93a2b1', gate: '#1f2d3a',
  gateGlow: '#1e88e5', water: '#3fa9bf', powerhouse: '#ccd6df',
  window: '#ffb422', penstock: '#8ba0b4', ambient: 0.8, sun: '#fff3e0', shadowStrength: 0.28,
}
const PAL_DARK: Pal = {
  sky: '#0b1219', fog: '#0b1219', ground: '#12201a', mountain: '#1a2330',
  concrete: '#33404e', face: '#44546a', crest: '#2b3542', gate: '#0a0e14',
  gateGlow: '#38bdf8', water: '#2aa6b8', powerhouse: '#3a4656',
  window: '#ffc233', penstock: '#4b5a6e', ambient: 0.55, sun: '#ffffff', shadowStrength: 0.4,
}

function DamBody({ pal }: { pal: Pal }) {
  return (
    <group position={[0, 0, -4]}>
      <mesh position={[0, 4, 0]} castShadow>
        <boxGeometry args={[26, 10, 5]} />
        <meshStandardMaterial color={pal.concrete} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[0, 2.8, 2]} rotation={[0.06, 0, 0]} castShadow>
        <boxGeometry args={[26.5, 9, 2]} />
        <meshStandardMaterial color={pal.face} roughness={0.8} metalness={0.08} />
      </mesh>
      <mesh position={[0, 9.5, 0]} castShadow>
        <boxGeometry args={[27, 0.9, 6]} />
        <meshStandardMaterial color={pal.crest} roughness={0.9} />
      </mesh>
      {/* parapet railings */}
      {[-2, 2].map((z) => (
        <group key={z}>
          {[-12, -8, -4, 4, 8, 12].map((x) => (
            <mesh key={x} position={[x, 10.1, z]} castShadow>
              <boxGeometry args={[0.16, 1.1, 0.12]} />
              <meshStandardMaterial color={pal.concrete} roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[0, 10.4, z]} castShadow>
            <boxGeometry args={[26, 0.14, 0.1]} />
            <meshStandardMaterial color={pal.crest} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* control towers on crest */}
      {[-10, 10].map((x) => (
        <group key={x}>
          <mesh position={[x, 11, 0]} castShadow>
            <boxGeometry args={[2.4, 2.2, 2.4]} />
            <meshStandardMaterial color={pal.crest} roughness={0.75} />
          </mesh>
          <mesh position={[x, 12.2, 0]} castShadow>
            <boxGeometry args={[2.8, 0.3, 2.8]} />
            <meshStandardMaterial color={pal.concrete} roughness={0.9} />
          </mesh>
          {[-0.6, 0.6].map((tz) => (
            <mesh key={tz} position={[x, 11, tz * 0.8]} rotation={[0, x > 0 ? Math.PI : 0, 0]}>
              <boxGeometry args={[0.6, 0.5, 0.08]} />
              <meshStandardMaterial color={pal.window} emissive={pal.window} emissiveIntensity={2} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      {/* sluice gates */}
      {[-8, -4, 4, 8].map((x) => (
        <group key={x}>
          <mesh position={[x, 3.8, 2.4]}>
            <boxGeometry args={[3.2, 5.5, 0.35]} />
            <meshStandardMaterial color={pal.gate} roughness={0.35} metalness={0.6} />
          </mesh>
          {[3, 4.2, 5.4].map((gy) => (
            <mesh key={gy} position={[x, gy, 2.6]}>
              <boxGeometry args={[2.2, 0.15, 0.08]} />
              <meshStandardMaterial color={pal.gateGlow} emissive={pal.gateGlow} emissiveIntensity={1.8} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      {/* spillway apron */}
      <mesh position={[0, 0.6, 3]} rotation={[0.1, 0, 0]} castShadow>
        <boxGeometry args={[24, 0.6, 6]} />
        <meshStandardMaterial color={pal.concrete} roughness={0.95} />
      </mesh>
      {/* powerhouse */}
      <mesh position={[0, 1.4, 8]} castShadow>
        <boxGeometry args={[7, 3.5, 4.5]} />
        <meshStandardMaterial color={pal.powerhouse} roughness={0.7} metalness={0.15} />
      </mesh>
      {[-2, 0, 2].map((x) => (
        <mesh key={x} position={[x, 1.8, 3.4]}>
          <boxGeometry args={[1.2, 0.8, 0.08]} />
          <meshStandardMaterial color={pal.window} emissive={pal.window} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}
      {[-2.2, 0, 2.2].map((x) => (
        <mesh key={x} position={[x, 2.5, 2.8]} rotation={[1.1, 0, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.42, 6, 14]} />
          <meshStandardMaterial color={pal.penstock} roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

function WaterPlane({ level, pal }: { level: number; pal: Pal }) {
  const height = Math.max(0.1, level * 10)
  return (
    <group position={[0, height, 2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.1, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color={pal.water} transparent opacity={0.6} roughness={0.1} metalness={0.3} />
      </mesh>
    </group>
  )
}

function SensorBeacons({ sensors }: { sensors: DamSensor[] }) {
  const maxY = 11.5
  return (
    <group>
      {sensors.map((s, i) => {
        const x = i === 0 ? 0 : -8 + (i / (sensors.length - 1)) * 16
        const y = Math.max(0.4, maxY + 0.3)
        const color = s.online && s.frac !== null ? (s.frac < 0.15 || s.frac >= 0.95 ? '#f87171' : s.frac < 0.3 || s.frac > 0.85 ? '#fbbf24' : '#2dd48f') : '#8b98a5'
        return (
          <group key={s.id} position={[x, 0, 0.8]}>
            <mesh position={[0, y / 2, 0]}>
              <cylinderGeometry args={[0.03, 0.06, y, 8]} />
              <meshStandardMaterial color="#2c3a48" metalness={0.55} roughness={0.45} />
            </mesh>
            <mesh position={[0, y, 0]}>
              <sphereGeometry args={[0.22, 18, 18]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function SceneContent({ level, pal, sensors }: { level: number; pal: Pal; sensors: DamSensor[] }) {
  return (
    <>
      <DamBody pal={pal} />
      <WaterPlane level={level} pal={pal} />
      <SensorBeacons sensors={sensors} />
      <ContactShadows position={[0, 0.1, 0]} opacity={pal.shadowStrength} scale={35} blur={2.4} far={16} color="#0a1416" frames={2} />
    </>
  )
}

export default function DamScene({ level, sensors = [] }: DamSceneProps) {
  const [theme] = useTheme()
  const pal: Pal = theme === 'dark' ? PAL_DARK : PAL_LIGHT

  return (
    <div className="h-full min-h-0 overflow-hidden bg-transparent">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: false }}
        camera={{ position: [8, 15, 22], fov: 40, near: 0.5, far: 150 }}
      >
        <ambientLight intensity={pal.ambient} />
        <directionalLight position={[16, 26, 12]} intensity={1.4} color={pal.sun} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-0.0005} />
        <pointLight position={[0, 8, 20]} intensity={0.4} color="#ffffff" />
        <SceneContent level={level} pal={pal} sensors={sensors} />
        <OrbitControls target={[0, 3, 0]} enablePan={false} minDistance={8} maxDistance={40} maxPolarAngle={Math.PI / 2 - 0.05} autoRotate autoRotateSpeed={0.8} enableDamping />
      </Canvas>
    </div>
  )
}
