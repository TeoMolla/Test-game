/**
 * ui/avatar.js — PLACEHOLDER CHARACTER ART.
 *
 * Every character is drawn as an inline SVG from a handful of colour/shape
 * parameters on the hero definition (`art`). This is stand-in art: it exists
 * so the prototype reads as a game on a phone screen without shipping any
 * real or borrowed artwork. Replacing it with sprites means swapping this one
 * module — nothing else knows how a character is drawn.
 */

const EYE = '#1f2937';

function hair(style, colour, cx, cy, rx, ry, skin = '#f2c9a0') {
  switch (style) {
    case 'spiky': {
      const spikes = [];
      const count = 9;
      for (let i = 0; i < count; i++) {
        const a = Math.PI + (Math.PI * i) / (count - 1);
        const x = cx + Math.cos(a) * rx * 1.02;
        const y = cy + Math.sin(a) * ry * 1.02;
        // Tip radii are the largest that keep every spike inside the viewBox
        // for both the bust (cy 44, ry 24) and the body (cy 30, ry 17).
        const tx = cx + Math.cos(a) * rx * 1.8;
        const ty = cy + Math.sin(a) * ry * 1.68;
        const px = cx + Math.cos(a + 0.34) * rx * 1.02;
        const py = cy + Math.sin(a + 0.34) * ry * 1.02;
        spikes.push(`<polygon points="${x},${y} ${tx},${ty} ${px},${py}" fill="${colour}"/>`);
      }
      return `${spikes.join('')}<path d="M${cx - rx},${cy} a${rx},${ry} 0 0 1 ${rx * 2},0 z" fill="${colour}"/>`;
    }
    case 'mane': {
      return `<path d="M${cx - rx * 1.5},${cy + ry * 2.6} Q${cx - rx * 1.9},${cy - ry * 1.1} ${cx},${cy - ry * 1.25}
        Q${cx + rx * 1.9},${cy - ry * 1.1} ${cx + rx * 1.5},${cy + ry * 2.6}
        Q${cx + rx * 0.9},${cy + ry * 1.2} ${cx},${cy + ry * 1.1}
        Q${cx - rx * 0.9},${cy + ry * 1.2} ${cx - rx * 1.5},${cy + ry * 2.6} z" fill="${colour}"/>`;
    }
    case 'long': {
      return `<path d="M${cx - rx * 1.25},${cy + ry * 1.9} Q${cx - rx * 1.4},${cy - ry} ${cx},${cy - ry * 1.15}
        Q${cx + rx * 1.4},${cy - ry} ${cx + rx * 1.25},${cy + ry * 1.9}
        Q${cx + rx * 0.7},${cy + ry * 0.6} ${cx},${cy + ry * 0.55}
        Q${cx - rx * 0.7},${cy + ry * 0.6} ${cx - rx * 1.25},${cy + ry * 1.9} z" fill="${colour}"/>`;
    }
    case 'bowl': {
      return `<path d="M${cx - rx * 1.06},${cy - ry * 0.02} a${rx * 1.06},${ry * 1.0} 0 0 1 ${rx * 2.12},0 z"
        fill="${colour}"/>`;
    }
    case 'widowsPeak': {
      return `<path d="M${cx - rx},${cy - ry * 0.1} a${rx},${ry} 0 0 1 ${rx * 2},0
        l${-rx * 0.2},${-ry * 0.15} l${-rx * 0.8},${ry * 0.5} l${-rx * 0.8},${-ry * 0.5} z" fill="${colour}"/>`;
    }
    case 'turban': {
      // Antennae are drawn first so the turban sits in front of their base;
      // the turban itself must stop well above the eyes (cy + 0.12ry).
      return `
        <path d="M${cx - rx * 0.5},${cy - ry * 0.9} q${-rx * 0.14},${-ry * 0.6} ${rx * 0.12},${-ry * 0.85}"
          stroke="${skin}" stroke-width="${rx * 0.13}" fill="none" stroke-linecap="round"/>
        <path d="M${cx + rx * 0.5},${cy - ry * 0.9} q${rx * 0.14},${-ry * 0.6} ${-rx * 0.12},${-ry * 0.85}"
          stroke="${skin}" stroke-width="${rx * 0.13}" fill="none" stroke-linecap="round"/>
        <path d="M${cx - rx * 1.06},${cy - ry * 0.32} a${rx * 1.06},${ry * 0.86} 0 0 1 ${rx * 2.12},0
          l0,${ry * 0.2} l${-rx * 2.12},0 z" fill="${colour}"/>
        <rect x="${cx - rx * 1.14}" y="${cy - ry * 0.2}" width="${rx * 2.28}" height="${ry * 0.2}"
          rx="${ry * 0.1}" fill="${colour}" opacity="0.72"/>`;
    }
    case 'saibaman': {
      return `<path d="M${cx},${cy - ry * 1.85} q${rx * 0.2},${ry * 0.55} ${-rx * 0.05},${ry * 0.9}"
        stroke="${colour === 'none' ? '#3f6212' : colour}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
    case 'bald':
    case 'thirdEye':
    case 'none':
    default:
      return '';
  }
}

function face(style, cx, cy, rx, ry, opts = {}) {
  const w = rx * 0.2;
  const h = ry * 0.26;
  const dy = cy + ry * 0.12;
  const dx = rx * 0.42;
  if (style === 'saibaman') {
    return `
      <ellipse cx="${cx - dx}" cy="${dy}" rx="${w * 1.5}" ry="${h * 1.3}" fill="#111827"/>
      <ellipse cx="${cx + dx}" cy="${dy}" rx="${w * 1.5}" ry="${h * 1.3}" fill="#111827"/>
      <ellipse cx="${cx - dx}" cy="${dy - h * 0.3}" rx="${w * 0.5}" ry="${h * 0.45}" fill="#fef08a"/>
      <ellipse cx="${cx + dx}" cy="${dy - h * 0.3}" rx="${w * 0.5}" ry="${h * 0.45}" fill="#fef08a"/>`;
  }
  const third = style === 'thirdEye'
    ? `<ellipse cx="${cx}" cy="${cy - ry * 0.42}" rx="${w * 0.85}" ry="${h * 0.85}" fill="${EYE}"/>`
    : '';
  return `
    <ellipse cx="${cx - dx}" cy="${dy}" rx="${w}" ry="${h}" fill="${EYE}"/>
    <ellipse cx="${cx + dx}" cy="${dy}" rx="${w}" ry="${h}" fill="${EYE}"/>
    ${third}
    ${opts.mouth === false ? '' : `<path d="M${cx - rx * 0.25},${cy + ry * 0.52} q${rx * 0.25},${ry * 0.16} ${rx * 0.5},0"
      stroke="${EYE}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.65"/>`}`;
}

/** Head-and-shoulders bust — roster cards, hero detail, battle portraits. */
export function bustSVG(art = {}, { className = '' } = {}) {
  const a = { skin: '#f2c9a0', hair: '#1b1b23', hairStyle: 'spiky', gi: '#f97316', trim: '#1d4ed8', ...art };
  const cx = 50, cy = 44, rx = 21, ry = 24;
  const backHair = ['long', 'mane'].includes(a.hairStyle) ? hair(a.hairStyle, a.hair, cx, cy, rx, ry, a.skin) : '';
  const frontHair = backHair ? '' : hair(a.hairStyle, a.hair, cx, cy, rx, ry, a.skin);

  return `<svg class="avatar-svg ${className}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    ${backHair}
    <path d="M14,100 Q14,74 34,68 L66,68 Q86,74 86,100 Z" fill="${a.gi}"/>
    <path d="M34,68 L50,86 L66,68 L58,66 L50,76 L42,66 Z" fill="${a.trim}"/>
    <rect x="43" y="60" width="14" height="12" fill="${a.skin}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${a.skin}"/>
    ${frontHair}
    ${face(a.hairStyle, cx, cy, rx, ry)}
  </svg>`;
}

/** Full body — battlefield units. `facing` flips enemies to face the player. */
export function bodySVG(art = {}, { facing = 'right', className = '' } = {}) {
  const a = { skin: '#f2c9a0', hair: '#1b1b23', hairStyle: 'spiky', gi: '#f97316', trim: '#1d4ed8', ...art };
  const cx = 50, cy = 30, rx = 15, ry = 17;
  const backHair = ['long', 'mane'].includes(a.hairStyle) ? hair(a.hairStyle, a.hair, cx, cy, rx, ry, a.skin) : '';
  const frontHair = backHair ? '' : hair(a.hairStyle, a.hair, cx, cy, rx, ry, a.skin);
  const flip = facing === 'left' ? 'transform="scale(-1,1) translate(-100,0)"' : '';

  return `<svg class="avatar-svg body ${className}" viewBox="0 0 100 150" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <g ${flip}>
      <ellipse cx="50" cy="146" rx="26" ry="5" fill="rgba(0,0,0,0.32)"/>
      ${backHair}
      <path d="M40,92 L36,140 L46,140 L50,100 L54,140 L64,140 L60,92 Z" fill="${a.trim}"/>
      <path d="M33,60 Q30,52 40,49 L60,49 Q70,52 67,60 L64,94 L36,94 Z" fill="${a.gi}"/>
      <rect x="34" y="82" width="32" height="7" fill="${a.trim}"/>
      <path d="M36,54 L24,80 L31,84 L41,60 Z" fill="${a.gi}"/>
      <path d="M64,54 L76,80 L69,84 L59,60 Z" fill="${a.gi}"/>
      <circle cx="26" cy="83" r="5" fill="${a.skin}"/>
      <circle cx="74" cy="83" r="5" fill="${a.skin}"/>
      <rect x="45" y="42" width="10" height="10" fill="${a.skin}"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${a.skin}"/>
      ${frontHair}
      ${face(a.hairStyle, cx, cy, rx, ry, { mouth: false })}
    </g>
  </svg>`;
}
