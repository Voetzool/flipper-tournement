import { imgUrl } from '../../lib/serverMode';
import { useState } from 'preact/hooks';

/** Kleine kastafbeelding; valt terug op het app-logo als er geen (offline) plaatje is. */
export function Thumb({ src, size = 48 }: { src?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size + 'px', height: size + 'px' };
  if (!src || failed) {
    return <img class="thumb thumb-empty" style={style} src="icons/icon.svg" alt="" aria-hidden="true" />;
  }
  return <img class="thumb" style={style} src={imgUrl(src)} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
