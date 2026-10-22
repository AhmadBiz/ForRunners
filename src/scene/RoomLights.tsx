/**
 * Interior lighting. Walls do not occlude the HDRI's diffuse light in three.js, but the sky alone
 * leaves rooms grey, so every room gets a ceiling fixture with a PointLight (no shadows — 35 shadow
 * casters would be far too expensive). Physical units (candela-ish, decay 2): irradiance at d metres
 * = intensity / d².
 *
 *  - ordinary rooms: a flush-mount disc (r 0.18 m) at the room centre, 2 cm below the ceiling;
 *  - the six big open rooms: two recessed spots (r 0.06 m) at 1/4 and 3/4 of the long axis;
 *  - the garage: one bare bulb on a short stem;
 *  - closets under 2 m² keep a fixture but no light (their neighbours light them).
 *
 * Fixtures are drawn with four InstancedMeshes (4 draw calls, ~5 k triangles) built once from HOUSE.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HOUSE } from '../data/house';
import { LEVEL_BY_ID } from '../data/geometry';

const CEILING_GAP = 0.02;
/** Rooms that get two recessed spots instead of one flush mount. */
const TWO_FIXTURES = new Set(['g-salon', 'g-sam', 'g-cuisine', 'b-jeux', 'b-familiale', 'u-ch1']);
/** Below this floor area (m²) a room gets a fixture but no PointLight. */
const NO_LIGHT_AREA = 2;
/** Global multiplier for every PointLight (tuned against the screenshots with exposure 1.0). */
const LIGHT_SCALE = 1.0;

type FixtureKind = 'flush' | 'spot' | 'bulb';

interface Fixture {
  kind: FixtureKind;
  x: number;
  z: number;
  /** Ceiling height (m) at this fixture. */
  ceiling: number;
  /** PointLight intensity (0 = no light). */
  intensity: number;
  distance: number;
}

function tier(area: number): number {
  if (area > 15) return 12;
  if (area > 7) return 7;
  return 4;
}

function buildFixtures(): Fixture[] {
  const out: Fixture[] = [];
  for (const room of HOUSE.rooms) {
    if (room.noFloor) continue;
    const level = LEVEL_BY_ID[room.level];
    const ceiling = level.floorY + level.ceilingHeight;
    const [x1, z1, x2, z2] = room.bounds;
    const w = x2 - x1;
    const d = z2 - z1;
    const area = w * d;
    const diag = Math.hypot(w, d);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    if (TWO_FIXTURES.has(room.id)) {
      const alongX = w >= d;
      const each = tier(area) * 0.7 * LIGHT_SCALE;
      for (const f of [0.25, 0.75]) {
        out.push({
          kind: 'spot',
          x: alongX ? x1 + w * f : cx,
          z: alongX ? cz : z1 + d * f,
          ceiling,
          intensity: each,
          distance: diag,
        });
      }
      continue;
    }
    const intensity = area < NO_LIGHT_AREA ? 0 : tier(area) * LIGHT_SCALE;
    out.push({ kind: room.id === 'g-garage' ? 'bulb' : 'flush', x: cx, z: cz, ceiling, intensity, distance: diag });
  }
  return out;
}

const FIXTURES: Fixture[] = buildFixtures();
const LIGHTS: Fixture[] = FIXTURES.filter((f) => f.intensity > 0);

// ---------------------------------------------------------------------------------------------
// Fixture geometry / materials (shared, created once)
// ---------------------------------------------------------------------------------------------
const FLUSH_HOUSING = new THREE.CylinderGeometry(0.19, 0.17, 0.06, 36);
const FLUSH_LENS = new THREE.CylinderGeometry(0.15, 0.15, 0.016, 36);
const SPOT_TRIM = new THREE.CylinderGeometry(0.075, 0.075, 0.012, 24);
const SPOT_LENS = new THREE.CylinderGeometry(0.055, 0.055, 0.008, 24);
const BULB_BASE = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 24);
const BULB_STEM = new THREE.CylinderGeometry(0.014, 0.014, 0.09, 12);
const BULB = new THREE.SphereGeometry(0.038, 20, 14);

const WHITE = new THREE.MeshStandardMaterial({ color: '#f6f5f2', roughness: 0.45, metalness: 0.05, envMapIntensity: 0.8 });
const LENS = new THREE.MeshStandardMaterial({ color: '#fff7e8', emissive: '#fff2d6', emissiveIntensity: 2, roughness: 0.5 });
const BULB_GLASS = new THREE.MeshStandardMaterial({ color: '#fff3dd', emissive: '#fff2d6', emissiveIntensity: 3, roughness: 0.3 });
const SOCKET = new THREE.MeshStandardMaterial({ color: '#d9d6d0', roughness: 0.6, metalness: 0.1 });

interface InstanceSpec {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Vertical offset of the instance centre relative to the ceiling (negative = below). */
  dy: number;
  kind: FixtureKind;
}

const INSTANCES: InstanceSpec[] = [
  { geometry: FLUSH_HOUSING, material: WHITE, dy: -(CEILING_GAP + 0.03), kind: 'flush' },
  { geometry: FLUSH_LENS, material: LENS, dy: -(CEILING_GAP + 0.06 + 0.008), kind: 'flush' },
  { geometry: SPOT_TRIM, material: WHITE, dy: -0.006, kind: 'spot' },
  { geometry: SPOT_LENS, material: LENS, dy: -0.016, kind: 'spot' },
];

function Instanced({ spec }: { spec: InstanceSpec }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => FIXTURES.filter((f) => f.kind === spec.kind), [spec.kind]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    items.forEach((f, i) => {
      m.makeTranslation(f.x, f.ceiling + spec.dy, f.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [items, spec.dy]);
  if (items.length === 0) return null;
  return <instancedMesh ref={ref} args={[spec.geometry, spec.material, items.length]} frustumCulled={false} />;
}

function BareBulb({ f }: { f: Fixture }) {
  const y = f.ceiling - CEILING_GAP;
  return (
    <group position={[f.x, y, f.z]}>
      <mesh geometry={BULB_BASE} material={SOCKET} position={[0, -0.015, 0]} />
      <mesh geometry={BULB_STEM} material={SOCKET} position={[0, -0.075, 0]} />
      <mesh geometry={BULB} material={BULB_GLASS} position={[0, -0.15, 0]} />
    </group>
  );
}

/** Ceiling fixtures + their PointLights for every room (35 lights). */
export function RoomLights() {
  const bulbs = useMemo(() => FIXTURES.filter((f) => f.kind === 'bulb'), []);
  return (
    <group name="room-lights">
      {INSTANCES.map((spec, i) => (
        <Instanced key={i} spec={spec} />
      ))}
      {bulbs.map((f, i) => (
        <BareBulb key={i} f={f} />
      ))}
      {LIGHTS.map((f, i) => (
        <pointLight
          key={i}
          position={[f.x, f.ceiling - (f.kind === 'spot' ? 0.08 : 0.16), f.z]}
          color="#fff0dc"
          intensity={f.intensity}
          distance={f.distance}
          decay={2}
          castShadow={false}
        />
      ))}
    </group>
  );
}

/** For the integrator's budget report. */
export const ROOM_LIGHT_COUNT = LIGHTS.length;
