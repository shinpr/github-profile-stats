import { COLOR_SCHEME_TOKENS, contrastRatio } from './tokens.mjs';

const MAX_SVG_BYTES = 150 * 1024;
const PROHIBITED_CONTENT = /<(?:script|foreignObject|iframe|object|embed)\b|\son[a-z]+\s*=/i;
const EXTERNAL_REFERENCE = /(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/|data:)/i;

function validateContrast(colorScheme) {
  const tokens = COLOR_SCHEME_TOKENS[colorScheme];
  if (!tokens) throw new TypeError(`unsupported color scheme: ${colorScheme}`);
  const requiredPairs = [tokens.primaryText, tokens.secondaryText];
  if (requiredPairs.some((color) => contrastRatio(color, tokens.surface) < 4.5)
    || tokens.activity.slice(1).some((color) => contrastRatio(color, tokens.surface) < 3)) {
    throw new TypeError(`${colorScheme} color scheme violates its contrast contract`);
  }
}

function validateAccessibleMetadata(svg) {
  const title = svg.match(/<title\b[^>]*\bid="([^"]+)"[^>]*>[^<]+<\/title>/);
  const description = svg.match(/<desc\b[^>]*\bid="([^"]+)"[^>]*>[^<]+<\/desc>/);
  if (!title || !description) {
    throw new TypeError('SVG requires a non-empty title and description with IDs');
  }
  const root = svg.match(/^<svg\b[^>]*>/i)?.[0];
  const labelledBy = root?.match(/\baria-labelledby="([^"]+)"/)?.[1].trim().split(/\s+/);
  if (title[1] === description[1]
    || labelledBy?.length !== 2
    || labelledBy[0] !== title[1]
    || labelledBy[1] !== description[1]) {
    throw new TypeError('SVG aria-labelledby must reference the title and description IDs');
  }
}

export function validateSvg({ svg, colorScheme, layout }) {
  if (typeof svg !== 'string') throw new TypeError('svg must be a string');
  const bytes = Buffer.byteLength(svg, 'utf8');
  if (bytes > MAX_SVG_BYTES) throw new RangeError(`SVG exceeds ${MAX_SVG_BYTES} bytes`);
  const viewBoxes = { wide: '0 0 640 360', compact: '0 0 320 528' };
  if (!viewBoxes[layout]) throw new TypeError(`unsupported layout: ${layout}`);
  if (!new RegExp(`^<svg\\b[^>]*viewBox="${viewBoxes[layout]}"[^>]*>`, 'i').test(svg)) {
    throw new TypeError(`SVG must use viewBox ${viewBoxes[layout]}`);
  }
  validateAccessibleMetadata(svg);
  if (PROHIBITED_CONTENT.test(svg)) throw new TypeError('prohibited SVG content');
  if (EXTERNAL_REFERENCE.test(svg)) throw new TypeError('SVG contains an external reference');
  const declaredDays = Number(svg.match(/\bdata-period-days="(365|366)"/)?.[1]);
  const activityDates = svg.match(/data-date="\d{4}-\d{2}-\d{2}"/g) ?? [];
  if (!declaredDays || activityDates.length !== declaredDays) {
    throw new TypeError('SVG activity dates must match the declared period');
  }
  if (!svg.endsWith('</svg>\n')) throw new TypeError('SVG must be a complete UTF-8 document');
  validateContrast(colorScheme);
  return Object.freeze({ bytes });
}
