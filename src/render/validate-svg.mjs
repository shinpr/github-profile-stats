import {
  ACTIVITY_FORMAT_TOKENS,
  COLOR_SCHEME_TOKENS,
  LANGUAGE_FORMAT_TOKENS,
  contrastRatio,
} from './tokens.mjs';

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

export function validateSvg({ svg, layout }) {
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
  if (!svg.endsWith('</svg>\n')) throw new TypeError('SVG must be a complete UTF-8 document');
  return Object.freeze({ bytes });
}

export function validateSignalFieldSvg({ svg, colorScheme }) {
  if (typeof svg !== 'string') throw new TypeError('svg must be a string');
  const declaredDays = Number(svg.match(/\bdata-period-days="(365|366)"/)?.[1]);
  const activityDates = svg.match(/data-date="\d{4}-\d{2}-\d{2}"/g) ?? [];
  if (!declaredDays || activityDates.length !== declaredDays) {
    throw new TypeError('SVG activity dates must match the declared period');
  }
  validateContrast(colorScheme);
  return Object.freeze({ activityDates: activityDates.length });
}

export function validateActivityConsistencySvg({ svg, colorScheme }) {
  if (typeof svg !== 'string' || !/\bdata-format="activity-consistency"/.test(svg)) {
    throw new TypeError('activity consistency SVG requires its format marker');
  }
  const declaredDays = Number(svg.match(/\bdata-period-days="(365|366)"/)?.[1]);
  const activityDates = svg.match(/data-date="\d{4}-\d{2}-\d{2}"/g) ?? [];
  const dailyMarks = [...svg.matchAll(/<rect\b(?=[^>]*\bdata-date=)[^>]*\bwidth="([^"]+)"[^>]*\bheight="([^"]+)"[^>]*>/g)];
  if (!declaredDays || activityDates.length !== declaredDays) {
    throw new TypeError('activity consistency dates must match the declared period');
  }
  if (dailyMarks.length !== declaredDays
    || dailyMarks.some(([, width, height]) => Number(width) !== Number(height))) {
    throw new TypeError('activity consistency daily marks must be squares');
  }
  const tokens = ACTIVITY_FORMAT_TOKENS[colorScheme];
  if (!tokens) throw new TypeError(`unsupported color scheme: ${colorScheme}`);
  if (contrastRatio(tokens.primaryText, tokens.surface) < 4.5
    || contrastRatio(tokens.mutedText, tokens.surface) < 4.5
    || tokens.levels.slice(1).some((color) => contrastRatio(color, tokens.surface) < 3)) {
    throw new TypeError(`${colorScheme} activity tokens violate the contrast contract`);
  }
  return Object.freeze({ activityDates: activityDates.length });
}

export function validateLanguageCompositionSvg({ svg, colorScheme }) {
  if (typeof svg !== 'string' || !/\bdata-format="language-composition"/.test(svg)) {
    throw new TypeError('language composition SVG requires its format marker');
  }
  const declaredGroups = Number(svg.match(/\bdata-language-groups="([0-5])"/)?.[1]);
  const totalBytes = Number(svg.match(/\bdata-total-bytes="(\d+)"/)?.[1]);
  const railMarks = svg.match(/\bdata-rail-rank="[1-5]"/g) ?? [];
  const rowMarks = svg.match(/\bdata-row-rank="[1-5]"/g) ?? [];
  if (!Number.isSafeInteger(totalBytes) || declaredGroups !== railMarks.length
    || declaredGroups !== rowMarks.length
    || (totalBytes === 0) !== (declaredGroups === 0)) {
    throw new TypeError('language composition groups must match complete or empty semantics');
  }
  const tokens = LANGUAGE_FORMAT_TOKENS[colorScheme];
  if (!tokens) throw new TypeError(`unsupported color scheme: ${colorScheme}`);
  if (contrastRatio(tokens.primaryText, tokens.surface) < 4.5
    || contrastRatio(tokens.mutedText, tokens.surface) < 4.5
    || tokens.ranks.some((color) => contrastRatio(color, tokens.surface) < 3)) {
    throw new TypeError(`${colorScheme} language tokens violate the contrast contract`);
  }
  return Object.freeze({ groups: declaredGroups });
}
