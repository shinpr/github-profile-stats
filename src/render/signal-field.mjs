import { COLOR_SCHEME_TOKENS } from './tokens.mjs';
import { svgSequentialLegend } from './card-primitives.mjs';
import { positionCalendarDays, splitCalendarBands } from './calendar-grid.mjs';

const SANS_FONT = 'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
const MONO_FONT = 'ui-monospace,SFMono-Regular,Consolas,Liberation Mono,monospace';
const NUMBER_FORMAT = new Intl.NumberFormat('en-US');
const COMPACT_LOGIN_CHARACTERS = 22;
const MONTHS = Object.freeze(['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']);
const GEOMETRY = Object.freeze({
  wide: Object.freeze({ width: 640, height: 360, rail: [141, 141, 154, 204] }),
  compact: Object.freeze({ width: 320, height: 528 }),
});

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function dateParts(date) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

function formatWideDate(date) {
  return date.replaceAll('-', '.');
}

function formatCompactDate(date) {
  const { year, month, day } = dateParts(date);
  return `${MONTHS[month - 1]} ${String(day).padStart(2, '0')}, ${year}`;
}

function formatBandDate(date) {
  const { month, day } = dateParts(date);
  return `${MONTHS[month - 1]} ${String(day).padStart(2, '0')}`;
}

function formatCompactLogin(login) {
  if (login.length <= COMPACT_LOGIN_CHARACTERS) return login;
  return `${login.slice(0, COMPACT_LOGIN_CHARACTERS - 1)}…`;
}

function text({ x, y, value, fill, size, weight = 500, family = MONO_FONT, anchor }) {
  const anchorAttribute = anchor ? ` text-anchor="${anchor}"` : '';
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}"${anchorAttribute}>${escapeXml(value)}</text>`;
}

function renderRail(colors, widths) {
  let x = 0;
  return widths.map((width, index) => {
    const segment = `<rect x="${x}" y="0" width="${width}" height="5" fill="${colors[index]}"/>`;
    x += width;
    return segment;
  }).join('');
}

function renderFrame({ layout, theme, content }) {
  const { width, height, rail } = GEOMETRY[layout];
  return [
    `<rect width="${width}" height="${height}" fill="${theme.surface}"/>`,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="${theme.hairline}"/>`,
    rail ? renderRail(theme.rail, rail) : '',
    content,
  ].join('');
}

function renderLegend({ marksX, y, theme, markSize }) {
  return svgSequentialLegend({
    colors: theme.activity,
    marksX,
    baselineY: y,
    markSize,
    fill: theme.secondaryText,
    textSize: 9,
    textWeight: 500,
  });
}

function renderActivityCells({ activity, x, y, size, step, theme, band }) {
  return positionCalendarDays(activity).map(({ day, column, row }) => {
    const cellX = x + column * step;
    const cellY = y + row * step;
    const bandAttribute = band ? ` data-band="${band}"` : '';
    return `<rect x="${cellX}" y="${cellY}" width="${size}" height="${size}" rx="2" fill="${theme.activity[day.level]}" data-date="${day.date}" data-count="${day.count}" data-level="${day.level}"${bandAttribute}/>`;
  }).join('');
}

function renderWideMetric({ x, value, label, theme }) {
  return [
    `<path d="M${x} 73h86" stroke="${theme.hairline}"/>`,
    text({ x, y: 108, value: NUMBER_FORMAT.format(value), fill: theme.primaryText, size: 26, weight: 620, family: SANS_FONT }),
    text({ x, y: 132, value: label, fill: theme.secondaryText, size: 12, weight: 550 }),
  ].join('');
}

function renderWide(snapshot, theme) {
  const contributions = snapshot.metrics.contributionsPastYear.value;
  const content = [
    text({ x: 30, y: 35, value: `${snapshot.account.login} · GITHUB ACTIVITY`, fill: theme.primaryText, size: 11, weight: 700 }),
    text({ x: 610, y: 35, value: `${formatWideDate(snapshot.period.fromDate)} — ${formatWideDate(snapshot.period.toDate)}`, fill: theme.secondaryText, size: 11, anchor: 'end' }),
    text({ x: 30, y: 109, value: NUMBER_FORMAT.format(contributions), fill: theme.primaryText, size: 64, weight: 650, family: SANS_FONT }),
    `<rect x="30" y="132" width="20" height="2" fill="${theme.coral}"/>`,
    text({ x: 59, y: 137, value: 'CONTRIBUTIONS · PAST YEAR', fill: theme.primaryText, size: 11, weight: 600 }),
    renderWideMetric({ x: 284, value: snapshot.metrics.totalStars.value, label: 'STARS', theme }),
    renderWideMetric({ x: 390, value: snapshot.metrics.authoredPullRequests.value, label: 'PULL REQUESTS', theme }),
    renderWideMetric({ x: 496, value: snapshot.metrics.authoredIssues.value, label: 'ISSUES', theme }),
    text({ x: 30, y: 179, value: 'DAILY ACTIVITY · PAST YEAR', fill: theme.primaryText, size: 12, weight: 550 }),
    renderLegend({ marksX: 517, y: 179, theme, markSize: 9 }),
    renderActivityCells({ activity: snapshot.activity, x: 30, y: 199, size: 9, step: 11, theme }),
    `<path d="M30 288h580" stroke="${theme.hairline}"/>`,
    text({ x: 30, y: 330, value: 'SOURCE · GITHUB GRAPHQL CONTRIBUTION CALENDAR', fill: theme.secondaryText, size: 10 }),
    text({ x: 610, y: 330, value: `CONTRIBUTIONS THROUGH · ${formatCompactDate(snapshot.period.toDate)}`, fill: theme.secondaryText, size: 10, anchor: 'end' }),
  ].join('');
  return renderFrame({ layout: 'wide', theme, content });
}

function renderCompactMetric({ x, value, label, theme }) {
  return [
    `<path d="M${x - 42} 173h84" stroke="${theme.hairline}"/>`,
    text({ x, y: 206, value: NUMBER_FORMAT.format(value), fill: theme.primaryText, size: 22, weight: 650, family: SANS_FONT, anchor: 'middle' }),
    text({ x, y: 227, value: label, fill: theme.primaryText, size: 9, weight: 600, anchor: 'middle' }),
  ].join('');
}

function renderCompactBand({ activity, y, theme, band }) {
  const label = `${formatBandDate(activity[0].date)} — ${formatBandDate(activity.at(-1).date)}`;
  return [
    text({ x: 22, y, value: label, fill: theme.secondaryText, size: 9, weight: 600 }),
    renderActivityCells({ activity, x: 26, y: y + 11, size: 8, step: 10, theme, band }),
  ].join('');
}

function renderCompact(snapshot, theme) {
  const contributions = snapshot.metrics.contributionsPastYear.value;
  const [firstBand, secondBand] = splitCalendarBands(snapshot.activity);
  const content = [
    text({ x: 22, y: 27, value: formatCompactLogin(snapshot.account.login), fill: theme.primaryText, size: 13, weight: 800 }),
    text({ x: 298, y: 27, value: 'GITHUB ACTIVITY', fill: theme.secondaryText, size: 9, weight: 650, anchor: 'end' }),
    text({ x: 22, y: 53, value: formatCompactDate(snapshot.period.fromDate), fill: theme.secondaryText, size: 9, weight: 650 }),
    `<path d="M106 50h108" stroke="${theme.hairline}"/>`,
    text({ x: 298, y: 53, value: formatCompactDate(snapshot.period.toDate), fill: theme.secondaryText, size: 9, weight: 650, anchor: 'end' }),
    text({ x: 160, y: 124, value: NUMBER_FORMAT.format(contributions), fill: theme.primaryText, size: 54, weight: 680, family: SANS_FONT, anchor: 'middle' }),
    `<rect x="150" y="141" width="20" height="2" fill="${theme.coral}"/>`,
    text({ x: 160, y: 160, value: 'CONTRIBUTIONS · PAST YEAR', fill: theme.primaryText, size: 11, weight: 650, anchor: 'middle' }),
    renderCompactMetric({ x: 66, value: snapshot.metrics.totalStars.value, label: 'STARS', theme }),
    renderCompactMetric({ x: 160, value: snapshot.metrics.authoredPullRequests.value, label: 'PULL REQUESTS', theme }),
    renderCompactMetric({ x: 254, value: snapshot.metrics.authoredIssues.value, label: 'ISSUES', theme }),
    text({ x: 22, y: 267, value: 'DAILY ACTIVITY', fill: theme.primaryText, size: 11, weight: 650 }),
    renderLegend({ marksX: 218, y: 267, theme, markSize: 8 }),
    renderCompactBand({ activity: firstBand, y: 291, theme, band: 1 }),
    renderCompactBand({ activity: secondBand, y: 397, theme, band: 2 }),
    `<path d="M22 493h276" stroke="${theme.hairline}"/>`,
    text({ x: 160, y: 512, value: 'GITHUB GRAPHQL CONTRIBUTION CALENDAR', fill: theme.secondaryText, size: 9, weight: 650, anchor: 'middle' }),
  ].join('');
  return renderFrame({ layout: 'compact', theme, content });
}

export function renderSignalField({ snapshot, colorScheme, layout = 'wide' }) {
  const theme = COLOR_SCHEME_TOKENS[colorScheme];
  if (!theme) throw new TypeError(`unsupported color scheme: ${colorScheme}`);
  if (!GEOMETRY[layout]) throw new TypeError(`unsupported layout: ${layout}`);
  const contributions = snapshot?.datasets?.contributions;
  const totalStars = snapshot?.datasets?.totalStars;
  const authoredPullRequests = snapshot?.datasets?.authoredPullRequests;
  const authoredIssues = snapshot?.datasets?.authoredIssues;
  if (contributions?.daily?.length !== contributions?.period?.days
    || ![365, 366].includes(contributions?.period?.days)
    || !totalStars || !authoredPullRequests || !authoredIssues) {
    throw new TypeError('renderer requires the Signal Field datasets');
  }
  const view = {
    account: snapshot.account,
    period: contributions.period,
    metrics: {
      contributionsPastYear: { value: contributions.totalContributions },
      totalStars,
      authoredPullRequests,
      authoredIssues,
    },
    activity: contributions.daily,
  };
  const contributionTotal = contributions.totalContributions;
  const description = `${NUMBER_FORMAT.format(contributionTotal)} contributions in the past year; ${NUMBER_FORMAT.format(totalStars.value)} stars; ${NUMBER_FORMAT.format(authoredPullRequests.value)} authored public pull requests reported by GitHub REST Search; ${NUMBER_FORMAT.format(authoredIssues.value)} authored public issues reported by GitHub REST Search. ${contributions.period.days} daily activity marks from ${contributions.period.fromDate} through ${contributions.period.toDate}, inclusive.`;
  const geometry = GEOMETRY[layout];
  const body = layout === 'wide' ? renderWide(view, theme) : renderCompact(view, theme);
  const titleId = `title-${layout}-${colorScheme}`;
  const descriptionId = `desc-${layout}-${colorScheme}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geometry.width} ${geometry.height}" width="${geometry.width}" height="${geometry.height}" data-period-days="${contributions.period.days}" role="img" aria-labelledby="${titleId} ${descriptionId}">`,
    `<title id="${titleId}">${escapeXml(snapshot.account.login)} GitHub activity summary · ${layout}</title>`,
    `<desc id="${descriptionId}">${escapeXml(description)}</desc>`,
    body,
    '</svg>\n',
  ].join('');
}
