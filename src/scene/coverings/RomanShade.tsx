import type { CoveringProps } from './types';

/** STUB — to be implemented. */
export function RomanShade(props: CoveringProps) {
  return (
    <mesh position={[0, 0, 0.05]}>
      <planeGeometry args={[props.width, props.height]} />
      <meshStandardMaterial color={props.color.hex} />
    </mesh>
  );
}
