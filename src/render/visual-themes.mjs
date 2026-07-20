import { renderSignalField } from './signal-field.mjs';

export const LAYOUTS = Object.freeze(['compact', 'wide']);
export const COLOR_SCHEMES = Object.freeze(['dark', 'light']);

const VISUAL_THEME_RENDERERS = Object.freeze({
  'signal-field': renderSignalField,
});

export function assertRegisteredVisualTheme(visualTheme) {
  if (typeof visualTheme !== 'string' || !VISUAL_THEME_RENDERERS[visualTheme]) {
    throw new TypeError(`unsupported visual theme: ${visualTheme}`);
  }
}

export function renderVisualTheme({ visualTheme, snapshot, layout, colorScheme }) {
  assertRegisteredVisualTheme(visualTheme);
  return VISUAL_THEME_RENDERERS[visualTheme]({ snapshot, layout, colorScheme });
}
