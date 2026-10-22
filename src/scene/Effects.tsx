/**
 * Post-processing (high quality only): N8AO ambient occlusion → SMAA → vignette → a touch of
 * contrast. On 'low' quality nothing renders here and the Canvas falls back to MSAA.
 *
 * The composer renders the scene into a HalfFloat buffer and the final effect pass applies the
 * renderer's tone mapping (ACES) + sRGB output, so colours match the no-post path.
 */
import { BrightnessContrast, EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing';
import { useStore } from '../store/useStore';

export function Effects() {
  const quality = useStore((s) => s.quality);
  if (quality !== 'high') return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={0.6} intensity={2.5} distanceFalloff={1} quality="performance" halfRes />
      <SMAA />
      <Vignette eskil={false} offset={0.2} darkness={0.35} />
      <BrightnessContrast contrast={0.05} />
    </EffectComposer>
  );
}
