import { Environment } from '@react-three/drei';
import { useStore } from '../store/useStore';
import { preloadAllTextures } from './materials';
import { BACKGROUND_INTENSITY, ENV_INTENSITY, Lighting, useSkyEnvironment } from './Lighting';
import { RoomLights } from './RoomLights';
import { House } from './House';
import { Exterior } from './Exterior';
import { WindowMeshes } from './WindowMeshes';
import { Furniture } from './Furniture';
import { Player } from './Player';
import { OrbitView } from './OrbitView';
import { Effects } from './Effects';

preloadAllTextures();

/** Fog colour = the HDRI's horizon radiance (fog is mixed in before tone mapping). */
const FOG_COLOR = '#b4bac9';

/**
 * Composition root of the 3D world. Every sub-component reads HOUSE from src/data and the
 * store from src/store; this file only wires them together.
 */
export function Scene() {
  const mode = useStore((s) => s.mode);
  const sky = useSkyEnvironment();
  return (
    <>
      <Environment map={sky} background backgroundBlurriness={0} environmentIntensity={ENV_INTENSITY} backgroundIntensity={BACKGROUND_INTENSITY} />
      <fog attach="fog" args={[FOG_COLOR, 60, 260]} />
      <Lighting />
      <RoomLights />
      <Exterior />
      <House />
      <WindowMeshes />
      <Furniture />
      {mode === 'walk' ? <Player /> : <OrbitView />}
      <Effects />
    </>
  );
}
