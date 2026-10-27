import { Icon } from './Icon';
import { tr } from '../../i18n';
import { useEffect, useState } from 'preact/hooks';

/** Schermvullende afbeelding met zoomknoppen; knijpen/schuiven werkt ook. */
export function ImageViewer({ src, fallback, alt, onClose }: { src: string; fallback?: string; alt: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [url, setUrl] = useState(src);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div class="viewer" role="dialog" aria-label={alt}>
      <div class="viewer-scroll">
        <img
          src={url}
          alt={alt}
          style={{ width: zoom * 100 + '%' }}
          onError={() => fallback && url !== fallback && setUrl(fallback)}
          onDblClick={() => setZoom(zoom >= 3 ? 1 : zoom + 1)}
        />
      </div>
      <div class="viewer-bar">
        {[1, 2, 3].map((z) => (
          <button key={z} class={'iconbtn' + (zoom === z ? ' on' : '')} onClick={() => setZoom(z)} aria-label={`Zoom ${z}×`}>
            {z === 1 ? <Icon name="zoom_in" /> : z + '×'}
          </button>
        ))}
        <button class="iconbtn" onClick={onClose} aria-label={tr('Sluiten')}>
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}
