import { buildLanguageDisplayGroups } from '../domain/repository-languages.mjs';
import { LANGUAGE_FORMAT_TOKENS } from './tokens.mjs';
import { escapeXml, SANS_FONT, svgFrame, svgText } from './card-primitives.mjs';

function truncateLabel(name, maxCharacters) {
  return name.length > maxCharacters ? `${name.slice(0, maxCharacters)}…` : name;
}

function renderRail({ groups, tokens, x, y, width, height }) {
  let cursor = x;
  return groups.map((group, index) => {
    const segmentWidth = width * group.bytes / groups.reduce((sum, item) => sum + item.bytes, 0);
    const mark = `<rect data-rail-rank="${index + 1}" x="${cursor}" y="${y}" width="${segmentWidth}" height="${height}" fill="${tokens.ranks[index]}" shape-rendering="crispEdges"/>`;
    cursor += segmentWidth;
    return mark;
  }).join('');
}

function renderRows({ groups, tokens, x, width, startY, gap, barHeight, labelSize, maxCharacters }) {
  return groups.map((group, index) => {
    const y = startY + index * gap;
    return [
      svgText({
        x,
        y,
        value: truncateLabel(group.name, maxCharacters),
        fill: tokens.primaryText,
        size: labelSize,
        weight: 600,
        family: SANS_FONT,
      }),
      svgText({
        x: x + width,
        y,
        value: `${group.percentage}%`,
        fill: tokens.primaryText,
        size: labelSize + 2,
        weight: 700,
        family: SANS_FONT,
        anchor: 'end',
      }),
      `<rect x="${x}" y="${y + 10}" width="${width}" height="${barHeight}" fill="${tokens.line}"/>`,
      `<rect data-row-rank="${index + 1}" x="${x}" y="${y + 10}" width="${width * group.bytes / groups.reduce((sum, item) => sum + item.bytes, 0)}" height="${barHeight}" fill="${tokens.ranks[index]}"/>`,
    ].join('');
  }).join('');
}

function renderComplete({ snapshot, dataset, groups, tokens, layout }) {
  const count = dataset.repositoryScope.includedRepositoryCount;
  const identity = `${snapshot.account.login} · AS OF ${snapshot.asOfDate}`;
  const scope = `GITHUB-REPORTED BYTES · ${count} OWNED PUBLIC NON-FORK REPOS`;
  if (layout === 'compact') {
    return [
      svgText({ x: 20, y: 29, value: identity, fill: tokens.mutedText, size: 9, weight: 600, spacing: 0.5 }),
      renderRail({ groups, tokens, x: 20, y: 52, width: 280, height: 16 }),
      svgText({ x: 20, y: 118, value: 'LANGUAGE', fill: tokens.primaryText, size: 40, weight: 700, family: SANS_FONT, spacing: -1.2 }),
      svgText({ x: 20, y: 157, value: 'COMPOSITION', fill: tokens.primaryText, size: 40, weight: 700, family: SANS_FONT, spacing: -1.2 }),
      svgText({ x: 20, y: 181, value: scope, fill: tokens.mutedText, size: 7, weight: 600, spacing: 0.15 }),
      renderRows({ groups, tokens, x: 20, width: 280, startY: 220, gap: 56, barHeight: 10, labelSize: 16, maxCharacters: 23 }),
    ].join('');
  }
  return [
    svgText({ x: 28, y: 31, value: identity, fill: tokens.mutedText, size: 10, weight: 600, spacing: 0.6 }),
    renderRail({ groups, tokens, x: 28, y: 52, width: 584, height: 16 }),
    svgText({ x: 28, y: 127, value: 'LANGUAGE', fill: tokens.primaryText, size: 42, weight: 700, family: SANS_FONT, spacing: -1.3 }),
    svgText({ x: 28, y: 168, value: 'COMPOSITION', fill: tokens.primaryText, size: 42, weight: 700, family: SANS_FONT, spacing: -1.3 }),
    renderRows({ groups, tokens, x: 350, width: 262, startY: 106, gap: 45, barHeight: 8, labelSize: 16, maxCharacters: 19 }),
    svgText({ x: 28, y: 333, value: scope, fill: tokens.mutedText, size: 9, weight: 600, spacing: 0.3 }),
  ].join('');
}

function renderEmpty({ snapshot, dataset, tokens, layout }) {
  const count = dataset.repositoryScope.includedRepositoryCount;
  const scope = `GITHUB-REPORTED BYTES · ${count} OWNED PUBLIC NON-FORK REPOS`;
  const x = layout === 'wide' ? 28 : 20;
  return [
    svgText({ x, y: layout === 'wide' ? 31 : 29, value: `${snapshot.account.login} · AS OF ${snapshot.asOfDate}`, fill: tokens.mutedText, size: layout === 'wide' ? 10 : 9, weight: 600, spacing: 0.5 }),
    svgText({ x, y: layout === 'wide' ? 112 : 112, value: 'LANGUAGE', fill: tokens.primaryText, size: layout === 'wide' ? 42 : 40, weight: 700, family: SANS_FONT, spacing: -1.2 }),
    svgText({ x, y: layout === 'wide' ? 153 : 151, value: 'COMPOSITION', fill: tokens.primaryText, size: layout === 'wide' ? 42 : 40, weight: 700, family: SANS_FONT, spacing: -1.2 }),
    `<line x1="${x}" y1="${layout === 'wide' ? 202 : 222}" x2="${layout === 'wide' ? 612 : 300}" y2="${layout === 'wide' ? 202 : 222}" stroke="${tokens.line}"/>`,
    svgText({ x, y: layout === 'wide' ? 248 : 278, value: 'NO GITHUB-REPORTED LANGUAGE BYTES', fill: tokens.primaryText, size: layout === 'wide' ? 18 : 14, weight: 650, family: SANS_FONT }),
    svgText({ x, y: layout === 'wide' ? 333 : 500, value: scope, fill: tokens.mutedText, size: layout === 'wide' ? 9 : 7, weight: 600, spacing: 0.2 }),
  ].join('');
}

export function renderLanguageComposition({ snapshot, colorScheme, layout = 'wide' }) {
  const tokens = LANGUAGE_FORMAT_TOKENS[colorScheme];
  if (!tokens) throw new TypeError(`unsupported color scheme: ${colorScheme}`);
  if (layout !== 'wide' && layout !== 'compact') throw new TypeError(`unsupported layout: ${layout}`);
  const dataset = snapshot?.datasets?.repositoryLanguages;
  if (!dataset || dataset.asOfDate !== snapshot.asOfDate) {
    throw new TypeError('language composition requires a matching repositoryLanguages dataset');
  }
  const groups = buildLanguageDisplayGroups(dataset);
  const count = dataset.repositoryScope.includedRepositoryCount;
  const description = groups.length === 0
    ? `No GitHub-reported language bytes across ${count} owned public non-fork repositories as of ${snapshot.asOfDate}.`
    : `GitHub-reported language bytes across ${count} owned public non-fork repositories as of ${snapshot.asOfDate}: ${groups.map((group) => `${group.name} ${group.percentage}%`).join(', ')}.`;
  const body = groups.length === 0
    ? renderEmpty({ snapshot, dataset, tokens, layout })
    : renderComplete({ snapshot, dataset, groups, tokens, layout });
  return svgFrame({
    layout,
    colorScheme,
    format: 'language-composition',
    tokens,
    title: `Language composition for ${snapshot.account.login}`,
    description,
    body,
    metadata: ` data-language-groups="${groups.length}" data-total-bytes="${dataset.totalBytes}"`,
  });
}
