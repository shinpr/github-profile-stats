import { ACTIVITY_FORMAT_TOKENS } from './tokens.mjs';
import {
  MONO_FONT,
  SANS_FONT,
  svgFrame,
  svgSequentialLegend,
  svgText,
} from './card-primitives.mjs';
import {
  positionCalendarDays,
  splitCalendarBands,
} from './calendar-grid.mjs';

const NUMBER_FORMAT = new Intl.NumberFormat('en-US');
const MONTHS = Object.freeze(['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']);
const FIELD_TO_LEGEND_GAP = 16;

function formatDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return `${MONTHS[month - 1]} ${String(day).padStart(2, '0')}, ${year}`;
}

function line(x1, y1, x2, y2, color) {
  return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}"/>`;
}

function renderHeader({ snapshot, period, layout, tokens }) {
  if (layout === 'wide') {
    return [
      svgText({ x: 28, y: 31, value: `${snapshot.account.login} · ACTIVITY / CONSISTENCY`, fill: tokens.primaryText, size: 11, weight: 700, spacing: 0.4 }),
      svgText({ x: 612, y: 31, value: `${formatDate(period.fromDate)} — ${formatDate(period.toDate)}`, fill: tokens.mutedText, size: 9, weight: 600, anchor: 'end' }),
    ].join('');
  }
  return [
    svgText({ x: 20, y: 25, value: snapshot.account.login, fill: tokens.primaryText, size: 11, weight: 800 }),
    svgText({ x: 300, y: 25, value: 'ACTIVITY / CONSISTENCY', fill: tokens.mutedText, size: 8, weight: 650, anchor: 'end' }),
    svgText({ x: 20, y: 48, value: formatDate(period.fromDate), fill: tokens.mutedText, size: 8, weight: 600 }),
    line(103, 45, 217, 45, tokens.line),
    svgText({ x: 300, y: 48, value: formatDate(period.toDate), fill: tokens.mutedText, size: 8, weight: 600, anchor: 'end' }),
  ].join('');
}

function renderLegend({ x, baselineY, markSize, tokens }) {
  return svgSequentialLegend({
    colors: tokens.levels,
    legendX: x,
    baselineY,
    markSize,
    fill: tokens.mutedText,
    textSize: 9,
    textWeight: 500,
  });
}

function renderDailyField({
  daily,
  x,
  y,
  cellSize,
  columnGap = 2,
  rowGap = 2,
  bandGap = 8,
  tokens,
  compact,
}) {
  const bands = compact ? splitCalendarBands(daily) : [daily];
  const stepX = cellSize + columnGap;
  const stepY = cellSize + rowGap;
  const bandHeight = 6 * stepY + cellSize;
  const svg = bands.map((band, bandIndex) => positionCalendarDays(band).map((position) => {
    const cellX = x + position.column * stepX;
    const cellY = y + bandIndex * (bandHeight + bandGap) + position.row * stepY;
    const bandAttribute = compact ? ` data-band="${bandIndex + 1}"` : '';
    return `<rect x="${cellX.toFixed(2)}" y="${cellY}" width="${cellSize}" height="${cellSize}" rx="1.5" fill="${tokens.levels[position.day.level]}" data-date="${position.day.date}" data-count="${position.day.count}" data-level="${position.day.level}"${bandAttribute}/>`;
  }).join('')).join('');
  const bandCount = bands.length;
  const bottom = y + bandCount * bandHeight + (bandCount - 1) * bandGap;
  return { svg, bottom };
}

function unit(value, singular, plural) {
  return value === 1 ? singular : plural;
}

function renderWide({ snapshot, contributions, tokens }) {
  const activeSize = contributions.activeDays >= 100 ? 78 : 86;
  const ratioX = contributions.activeDays >= 100 ? 182 : 88;
  const cellSize = 9;
  const field = renderDailyField({
    daily: contributions.daily,
    x: 30,
    y: 195,
    cellSize,
    tokens,
    compact: false,
  });
  return [
    renderHeader({ snapshot, period: contributions.period, layout: 'wide', tokens }),
    svgText({ x: 28, y: 130, value: contributions.activeDays, fill: tokens.primaryText, size: activeSize, weight: 700, family: SANS_FONT, spacing: -4 }),
    svgText({ x: ratioX, y: 88, value: `/ ${contributions.period.days}`, fill: tokens.mutedText, size: 20, weight: 680, family: SANS_FONT }),
    svgText({ x: ratioX, y: 118, value: 'ACTIVE DAYS', fill: tokens.primaryText, size: 11, weight: 700 }),
    line(290, 66, 290, 137, tokens.line),
    svgText({ x: 320, y: 105, value: contributions.currentStreak, fill: tokens.accent, size: 43, weight: 700, family: SANS_FONT }),
    svgText({ x: 320, y: 126, value: `CURRENT STREAK · ${unit(contributions.currentStreak, 'DAY', 'DAYS')}`, fill: tokens.mutedText, size: 8, weight: 650 }),
    svgText({ x: 490, y: 105, value: contributions.longestStreak, fill: tokens.primaryText, size: 43, weight: 700, family: SANS_FONT }),
    svgText({ x: 490, y: 126, value: `LONGEST STREAK · ${unit(contributions.longestStreak, 'DAY', 'DAYS')}`, fill: tokens.mutedText, size: 8, weight: 650 }),
    svgText({ x: 30, y: 176, value: `${NUMBER_FORMAT.format(contributions.totalContributions)} ${unit(contributions.totalContributions, 'CONTRIBUTION', 'CONTRIBUTIONS')} · PAST YEAR`, fill: tokens.primaryText, size: 11, weight: 700 }),
    svgText({ x: 610, y: 176, value: `${contributions.period.days} UTC DAYS · WARMTH IS AMOUNT`, fill: tokens.mutedText, size: 8, weight: 650, anchor: 'end' }),
    field.svg,
    renderLegend({
      x: 30,
      baselineY: field.bottom + FIELD_TO_LEGEND_GAP + cellSize,
      markSize: cellSize,
      tokens,
    }),
    line(30, 305, 610, 305, tokens.line),
    svgText({ x: 30, y: 335, value: 'ACTIVE DAYS AND STREAKS · DERIVED FROM DAILY COUNTS', fill: tokens.mutedText, size: 8, weight: 650 }),
  ].join('');
}

function renderCompact({ snapshot, contributions, tokens }) {
  const activeSize = contributions.activeDays >= 100 ? 68 : 74;
  const ratioX = contributions.activeDays >= 100 ? 170 : 72;
  const cellSize = 8;
  const field = renderDailyField({
    daily: contributions.daily,
    x: 26,
    y: 328,
    cellSize,
    tokens,
    compact: true,
  });
  return [
    renderHeader({ snapshot, period: contributions.period, layout: 'compact', tokens }),
    svgText({ x: 20, y: 124, value: contributions.activeDays, fill: tokens.primaryText, size: activeSize, weight: 700, family: SANS_FONT, spacing: -3 }),
    svgText({ x: ratioX, y: 91, value: `/ ${contributions.period.days}`, fill: tokens.mutedText, size: 18, weight: 680, family: SANS_FONT }),
    svgText({ x: ratioX, y: 118, value: 'ACTIVE DAYS', fill: tokens.primaryText, size: 10, weight: 700 }),
    line(20, 154, 300, 154, tokens.line),
    svgText({ x: 20, y: 202, value: contributions.currentStreak, fill: tokens.accent, size: 42, weight: 700, family: SANS_FONT }),
    svgText({ x: 20, y: 222, value: `CURRENT STREAK · ${unit(contributions.currentStreak, 'DAY', 'DAYS')}`, fill: tokens.mutedText, size: 8, weight: 650 }),
    svgText({ x: 182, y: 202, value: contributions.longestStreak, fill: tokens.primaryText, size: 42, weight: 700, family: SANS_FONT }),
    svgText({ x: 182, y: 222, value: `LONGEST STREAK · ${unit(contributions.longestStreak, 'DAY', 'DAYS')}`, fill: tokens.mutedText, size: 8, weight: 650 }),
    svgText({ x: 20, y: 264, value: NUMBER_FORMAT.format(contributions.totalContributions), fill: tokens.primaryText, size: 28, weight: 680, family: SANS_FONT }),
    svgText({ x: 20, y: 286, value: `${unit(contributions.totalContributions, 'CONTRIBUTION', 'CONTRIBUTIONS')} · PAST YEAR`, fill: tokens.mutedText, size: 8, weight: 650 }),
    svgText({ x: 20, y: 312, value: `${contributions.period.days} UTC DAYS · WARMTH IS AMOUNT`, fill: tokens.mutedText, size: 8, weight: 650 }),
    field.svg,
    renderLegend({
      x: 26,
      baselineY: field.bottom + FIELD_TO_LEGEND_GAP + cellSize,
      markSize: cellSize,
      tokens,
    }),
    svgText({ x: 20, y: 518, value: 'ACTIVE DAYS AND STREAKS · DERIVED FROM DAILY COUNTS', fill: tokens.mutedText, size: 7, weight: 650 }),
  ].join('');
}

export function renderActivityConsistency({ snapshot, colorScheme, layout = 'wide' }) {
  const tokens = ACTIVITY_FORMAT_TOKENS[colorScheme];
  const contributions = snapshot?.datasets?.contributions;
  if (!tokens) throw new TypeError(`unsupported color scheme: ${colorScheme}`);
  if (!['wide', 'compact'].includes(layout)) throw new TypeError(`unsupported layout: ${layout}`);
  if (!contributions || contributions.period?.toDate !== snapshot.asOfDate) {
    throw new TypeError('renderer requires the contributions dataset');
  }
  const body = layout === 'wide'
    ? renderWide({ snapshot, contributions, tokens })
    : renderCompact({ snapshot, contributions, tokens });
  const description = `${contributions.activeDays} active days out of ${contributions.period.days}; ${contributions.currentStreak}-day current streak; ${contributions.longestStreak}-day longest streak; ${NUMBER_FORMAT.format(contributions.totalContributions)} contributions. Each daily mark represents one UTC day and warmth represents contribution amount.`;
  return svgFrame({
    layout,
    colorScheme,
    format: 'activity-consistency',
    tokens,
    title: `${snapshot.account.login} activity consistency · ${layout}`,
    description,
    body,
    metadata: ` data-period-days="${contributions.period.days}"`,
  });
}
