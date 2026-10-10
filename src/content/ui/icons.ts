/**
 * Inline SVG icons built with `createElementNS` — never `innerHTML` — so the
 * "no markup injection" guarantee holds even for our own artwork.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

type Shape =
  | ['path', { d: string }]
  | ['polyline', { points: string }]
  | ['line', { x1: string; y1: string; x2: string; y2: string }]
  | ['circle', { cx: string; cy: string; r: string }];

export type IconName =
  'refresh' | 'sliders' | 'external' | 'sparkle' | 'check' | 'close' | 'key' | 'user' | 'shield';

const ICONS: Record<IconName, Shape[]> = {
  refresh: [
    ['polyline', { points: '23 4 23 10 17 10' }],
    ['path', { d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10' }],
  ],
  sliders: [
    ['line', { x1: '4', y1: '21', x2: '4', y2: '14' }],
    ['line', { x1: '4', y1: '10', x2: '4', y2: '3' }],
    ['line', { x1: '12', y1: '21', x2: '12', y2: '12' }],
    ['line', { x1: '12', y1: '8', x2: '12', y2: '3' }],
    ['line', { x1: '20', y1: '21', x2: '20', y2: '16' }],
    ['line', { x1: '20', y1: '12', x2: '20', y2: '3' }],
    ['line', { x1: '1', y1: '14', x2: '7', y2: '14' }],
    ['line', { x1: '9', y1: '8', x2: '15', y2: '8' }],
    ['line', { x1: '17', y1: '16', x2: '23', y2: '16' }],
  ],
  external: [
    ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }],
    ['polyline', { points: '15 3 21 3 21 9' }],
    ['line', { x1: '10', y1: '14', x2: '21', y2: '3' }],
  ],
  sparkle: [['path', { d: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z' }]],
  check: [['polyline', { points: '20 6 9 17 4 12' }]],
  close: [
    ['line', { x1: '18', y1: '6', x2: '6', y2: '18' }],
    ['line', { x1: '6', y1: '6', x2: '18', y2: '18' }],
  ],
  key: [
    ['path', { d: 'M15 7a4 4 0 1 0-3.9 5H9l-1 1.2H6l-1 1.2V16h2l1 1.2h2l1-1.2V13a4 4 0 0 0 4-6z' }],
  ],
  user: [
    ['path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: '12', cy: '7', r: '4' }],
  ],
  shield: [['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }]],
};

export function createIcon(name: IconName, size = 16, className = 'dt-icon'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', className);

  for (const shape of ICONS[name]) {
    const [tag, attributes] = shape;
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    svg.append(node);
  }

  return svg;
}
