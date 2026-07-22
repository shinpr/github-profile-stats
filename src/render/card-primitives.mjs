export const SANS_FONT = 'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
export const MONO_FONT = 'ui-monospace,SFMono-Regular,Consolas,Liberation Mono,monospace';

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function svgText({
  x,
  y,
  value,
  fill,
  size,
  weight = 500,
  family = MONO_FONT,
  anchor,
  spacing,
  textLength,
}) {
  const anchorAttribute = anchor ? ` text-anchor="${anchor}"` : '';
  const spacingAttribute = spacing === undefined ? '' : ` letter-spacing="${spacing}"`;
  const lengthAttribute = textLength === undefined
    ? ''
    : ` textLength="${textLength}" lengthAdjust="spacingAndGlyphs"`;
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}"${anchorAttribute}${spacingAttribute}${lengthAttribute}>${escapeXml(value)}</text>`;
}

export function svgSequentialLegendMarks({ colors, x, y, size, gap = 2, radius = 2 }) {
  return colors.map((color, index) => (
    `<rect x="${x + index * (size + gap)}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="${color}" data-legend-level="${index}"/>`
  )).join('');
}

export function svgSequentialLegend({
  colors,
  legendX,
  marksX,
  baselineY,
  markSize,
  fill,
  textSize,
  textWeight,
  labelGap = 10,
  labelOffsetY = -1,
  markGap = 2,
}) {
  const labelWidth = Number((textSize * 2.4).toFixed(2));
  const resolvedMarksX = marksX ?? legendX + labelWidth + labelGap;
  const resolvedLegendX = legendX ?? resolvedMarksX - labelGap - labelWidth;
  const marksWidth = colors.length * markSize + (colors.length - 1) * markGap;
  return [
    svgText({
      x: resolvedLegendX,
      y: baselineY + labelOffsetY,
      value: 'LESS',
      fill,
      size: textSize,
      weight: textWeight,
      textLength: labelWidth,
    }),
    svgSequentialLegendMarks({
      colors,
      x: resolvedMarksX,
      y: baselineY - markSize,
      size: markSize,
      gap: markGap,
    }),
    svgText({
      x: resolvedMarksX + marksWidth + labelGap,
      y: baselineY + labelOffsetY,
      value: 'MORE',
      fill,
      size: textSize,
      weight: textWeight,
      textLength: labelWidth,
    }),
  ].join('');
}

export function svgFrame({ layout, colorScheme, format, tokens, title, description, body, metadata = '' }) {
  const geometry = layout === 'wide' ? { width: 640, height: 360 } : { width: 320, height: 528 };
  const titleId = `title-${format}-${layout}-${colorScheme}`;
  const descriptionId = `desc-${format}-${layout}-${colorScheme}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geometry.width} ${geometry.height}" width="${geometry.width}" height="${geometry.height}" data-format="${format}"${metadata} role="img" aria-labelledby="${titleId} ${descriptionId}">`,
    `<title id="${titleId}">${escapeXml(title)}</title>`,
    `<desc id="${descriptionId}">${escapeXml(description)}</desc>`,
    `<rect width="${geometry.width}" height="${geometry.height}" fill="${tokens.surface}"/>`,
    `<rect x="0.5" y="0.5" width="${geometry.width - 1}" height="${geometry.height - 1}" fill="none" stroke="${tokens.line}"/>`,
    body,
    '</svg>\n',
  ].join('');
}
