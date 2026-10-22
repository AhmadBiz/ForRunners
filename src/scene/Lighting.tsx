/**
 * Sun + sky. The HDRI (public/hdri/sky_1k.hdr, partly-cloudy pure sky) lights and reflects the
 * world through the scene environment; a shadow-casting DirectionalLight plays its sun.
 *
 * The sun disc inside the HDRI is ~3000x brighter than the sky. Fed straight into the IBL it would
 * add several lux of UN-shadowed light everywhere (interiors included) and flatten the mapped
 * shadows, so `useSkyEnvironment` clamps the sun out of the copy used for lighting and the
 * DirectionalLight carries it instead. Its direction is measured from the file (elevation 48°,
 * azimuth +34° about Y, i.e. from the rear / south side of the house) so the lit faces, the cast
 * shadows and the visible sun in the background agree.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { useStore } from '../store/useStore';
import { HDRI_URL } from './materials';

/** Unit vector from the house towards the sun (measured on the HDRI: elevation 48.2°, atan2(z, x) = 34.1°). */
export const SUN_DIR = new THREE.Vector3(0.552, 0.745, 0.374).normalize();
/** Point the sun's shadow camera is centred on (middle of the house, at grade). */
export const SUN_TARGET = new THREE.Vector3(6, 0, 5);
const SUN_DISTANCE = 40;
export const SUN_POSITION: [number, number, number] = [
  SUN_TARGET.x + SUN_DIR.x * SUN_DISTANCE,
  SUN_TARGET.y + SUN_DIR.y * SUN_DISTANCE,
  SUN_TARGET.z + SUN_DIR.z * SUN_DISTANCE,
];

export const SUN_INTENSITY = 3.2;
export const SUN_COLOR = '#fff1dc';
export const ENV_INTENSITY = 0.9;
export const BACKGROUND_INTENSITY = 1.0;
/** Radiance ceiling applied to the HDRI copy used for lighting (clouds stay, the sun disc goes). */
const HDRI_CLAMP = 6;
/** Half-extent (m) of the orthographic shadow frustum — covers the house and the fenced yard. */
const SHADOW_EXTENT = 28;

/**
 * The sky HDRI as an equirectangular HalfFloat texture with its sun clamped, for scene.environment
 * and scene.background. Suspends while the file loads; the result is memoised per source texture.
 */
export function useSkyEnvironment(): THREE.DataTexture {
  const src = useLoader(HDRLoader, HDRI_URL, (loader) => (loader as HDRLoader).setDataType(THREE.FloatType));
  return useMemo(() => {
    const { width, height, data } = src.image as { width: number; height: number; data: Float32Array };
    const half = new Uint16Array(data.length);
    for (let i = 0; i < data.length; i += 4) {
      half[i] = THREE.DataUtils.toHalfFloat(Math.min(data[i], HDRI_CLAMP));
      half[i + 1] = THREE.DataUtils.toHalfFloat(Math.min(data[i + 1], HDRI_CLAMP));
      half[i + 2] = THREE.DataUtils.toHalfFloat(Math.min(data[i + 2], HDRI_CLAMP));
      half[i + 3] = THREE.DataUtils.toHalfFloat(1);
    }
    const tex = new THREE.DataTexture(half, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.flipY = src.flipY;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }, [src]);
}

/** Sun (shadow-casting) + a weak sky/ground bounce fill. The HDRI environment does the rest. */
export function Lighting() {
  const quality = useStore((s) => s.quality);
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(SUN_TARGET);
    return o;
  }, []);
  const mapSize = quality === 'high' ? 4096 : 2048;

  useLayoutEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target = target;
    l.shadow.mapSize.set(mapSize, mapSize);
    // force the shadow map to be re-allocated at the new size
    l.shadow.map?.dispose();
    l.shadow.map = null;
    l.shadow.camera.updateProjectionMatrix();
  }, [target, mapSize]);

  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={['#cfe3ff', '#8a7357', 0.35]} />
      <ambientLight intensity={0.08} />
      <directionalLight
        ref={light}
        position={SUN_POSITION}
        intensity={SUN_INTENSITY}
        color={SUN_COLOR}
        castShadow
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-radius={quality === 'high' ? 3 : 2}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={2}
        shadow-camera-far={SUN_DISTANCE + SHADOW_EXTENT + 10}
      />
    </>
  );
}
