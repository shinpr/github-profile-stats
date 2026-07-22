import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTIVITY_FORMAT_TOKENS,
  COLOR_SCHEME_TOKENS,
  LANGUAGE_FORMAT_TOKENS,
  contrastRatio,
} from '../../src/render/tokens.mjs';

test('should calculate reference WCAG contrast ratios', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(Number(contrastRatio('#FF0000', '#FFFFFF').toFixed(3)), 3.998);
});

test('should keep every approved text and data-mark palette above its contrast threshold', () => {
  const palettes = [
    ...Object.values(COLOR_SCHEME_TOKENS).map((tokens) => ({
      surface: tokens.surface,
      text: [tokens.primaryText, tokens.secondaryText],
      marks: tokens.activity.slice(1),
    })),
    ...Object.values(ACTIVITY_FORMAT_TOKENS).map((tokens) => ({
      surface: tokens.surface,
      text: [tokens.primaryText, tokens.mutedText],
      marks: tokens.levels.slice(1),
    })),
    ...Object.values(LANGUAGE_FORMAT_TOKENS).map((tokens) => ({
      surface: tokens.surface,
      text: [tokens.primaryText, tokens.mutedText],
      marks: tokens.ranks,
    })),
  ];

  for (const palette of palettes) {
    for (const color of palette.text) assert.ok(contrastRatio(color, palette.surface) >= 4.5);
    for (const color of palette.marks) assert.ok(contrastRatio(color, palette.surface) >= 3);
  }
});
