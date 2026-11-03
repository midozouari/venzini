// Injected into every page of the recording (never into the app itself): a visible cursor that
// follows the real mouse with a soft click ripple, and the scene titles. Colors are the app's own:
// navy #021C45 and cream #F7F3EC. Playwright serializes this function, so it uses no imports.

export interface DemoOverlay {
  title(n: number, text: string, ms: number): void;
}

declare global {
  interface Window {
    __demo?: DemoOverlay;
  }
}

export function overlay(): void {
  if (window.__demo) return;
  const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
  const css = [
    '#demo-cursor { position: fixed; left: 0; top: 0; width: 26px; height: 26px; z-index: 2147483647;',
    '  pointer-events: none; transform: translate(-200px, -200px); will-change: transform;',
    '  filter: drop-shadow(0 2px 4px rgb(2 28 69 / 0.35)); }',
    '.demo-ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 44px; height: 44px;',
    '  margin: -22px 0 0 -22px; border-radius: 9999px; border: 2px solid rgb(2 28 69 / 0.55);',
    `  background: rgb(2 28 69 / 0.12); animation: demo-ripple 520ms ${ease} forwards; }`,
    '@keyframes demo-ripple { from { transform: scale(0.35); opacity: 1; } to { transform: scale(1.25); opacity: 0; } }',
    '#demo-title { position: fixed; left: 50%; top: 100px; z-index: 2147483645; pointer-events: none;',
    `  transform: translate(-50%, -8px); opacity: 0; transition: opacity 420ms ${ease}, transform 420ms ${ease};`,
    '  display: flex; align-items: center; gap: 12px; padding: 12px 22px 12px 12px; border-radius: 9999px;',
    '  background: #021c45; color: #f7f3ec; border: 1px solid rgb(247 243 236 / 0.18);',
    '  box-shadow: 0 12px 32px rgb(0 8 30 / 0.32), 0 36px 88px rgb(0 8 30 / 0.3);',
    '  font: 600 17px/1.2 Inter, system-ui, sans-serif; white-space: nowrap; }',
    '#demo-title.show { opacity: 1; transform: translate(-50%, 0); }',
    '#demo-title .n { display: inline-flex; align-items: center; justify-content: center; min-width: 28px;',
    '  height: 28px; padding: 0 8px; border-radius: 9999px; background: #f7f3ec; color: #021c45;',
    '  font-size: 13px; font-variant-numeric: tabular-nums; }',
  ].join('\n');

  const style = document.createElement('style');
  style.textContent = css;
  const cursor = document.createElement('div');
  cursor.id = 'demo-cursor';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 26 26');
  svg.setAttribute('width', '26');
  svg.setAttribute('height', '26');
  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  arrow.setAttribute('d', 'M4 2.5 4 20.5 8.8 16.2 11.9 23.2 15.1 21.8 12.1 14.9 18.6 14.6Z');
  arrow.setAttribute('fill', '#fffdf9');
  arrow.setAttribute('stroke', '#021c45');
  arrow.setAttribute('stroke-width', '1.6');
  arrow.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(arrow);
  cursor.appendChild(svg);
  const title = document.createElement('div');
  title.id = 'demo-title';

  // The arrow's tip sits on the mouse position; it starts off screen until the first move.
  const place = (x: number, y: number) =>
    (cursor.style.transform = `translate(${x - 4}px, ${y - 2}px)`);
  const mount = () => {
    document.head.appendChild(style);
    document.body.append(cursor, title);
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });

  window.addEventListener('mousemove', (e) => place(e.clientX, e.clientY), true);
  window.addEventListener(
    'mousedown',
    (e) => {
      const ripple = document.createElement('div');
      ripple.className = 'demo-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    },
    true,
  );

  let hide: number | undefined;
  window.__demo = {
    title(n, text, ms) {
      clearTimeout(hide);
      const badge = document.createElement('span');
      badge.className = 'n';
      badge.textContent = String(n);
      const label = document.createElement('span');
      label.textContent = text;
      title.replaceChildren(badge, label);
      requestAnimationFrame(() => title.classList.add('show'));
      hide = window.setTimeout(() => title.classList.remove('show'), ms);
    },
  };
}
