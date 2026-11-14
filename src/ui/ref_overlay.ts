/**
 * Reference Image Overlay.
 * When ?refOverlay=1 is present in the URL, overlays the local developer reference image
 * (from public/dev/ref.jpg) at 40% opacity over the canvas.
 * The image is strictly excluded from git, production builds, and Android packaging.
 */
export function initRefOverlay(): void {
  if (typeof window === 'undefined' || !window.location) return;

  const params = new URLSearchParams(window.location.search);
  const isEnabled = params.get('refOverlay') === '1' || params.get('refOverlay') === 'true';

  const container = document.getElementById('game-container');
  if (!container) return;

  let img = document.getElementById('ref-overlay') as HTMLImageElement | null;

  if (isEnabled) {
    if (!img) {
      img = document.createElement('img');
      img.id = 'ref-overlay';
      img.src = '/dev/ref.jpg';
      img.alt = 'Reference Overlay';
      img.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: fill;
        opacity: 0.4;
        pointer-events: none;
        z-index: 50;
        display: block;
      `;

      img.onerror = () => {
        if (img) img.style.display = 'none';
        console.info(
          '[SwarmGate] public/dev/ref.jpg not found. Place reference image at public/dev/ref.jpg to see overlay.'
        );
      };

      container.appendChild(img);
    } else {
      img.style.display = 'block';
    }
  } else if (img) {
    img.style.display = 'none';
  }
}
