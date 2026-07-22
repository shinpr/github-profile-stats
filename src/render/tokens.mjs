function freezeColorScheme(tokens) {
  Object.freeze(tokens.activity);
  Object.freeze(tokens.rail);
  return Object.freeze(tokens);
}

export const COLOR_SCHEME_TOKENS = Object.freeze({
  light: freezeColorScheme({
    canvas: '#F4F0E8',
    surface: '#FCFAF5',
    primaryText: '#17171B',
    secondaryText: '#5E5B63',
    hairline: '#D8D2C7',
    coral: '#DE4F44',
    activity: ['#E7E1D7', '#7967C9', '#654FC2', '#5036AA', '#382077'],
    rail: ['#DE4F44', '#918A21', '#1D97A3', '#906AE5'],
  }),
  dark: freezeColorScheme({
    canvas: '#0E1015',
    surface: '#151821',
    primaryText: '#F7F3EA',
    secondaryText: '#AAA8B4',
    hairline: '#303543',
    coral: '#F9786A',
    activity: ['#262A35', '#7768C7', '#927EE7', '#B29AFF', '#D5C5FF'],
    rail: ['#F9786A', '#B0A946', '#48B7C2', '#AB91F2'],
  }),
});

function freezeFormatTokens(tokens) {
  if (tokens.levels) Object.freeze(tokens.levels);
  if (tokens.ranks) Object.freeze(tokens.ranks);
  return Object.freeze(tokens);
}

export const ACTIVITY_FORMAT_TOKENS = Object.freeze({
  light: freezeFormatTokens({
    surface: '#FCFAF5',
    primaryText: '#17171B',
    mutedText: '#5E5B63',
    line: '#D8D2C7',
    accent: '#C54B32',
    levels: ['#E7E1D7', '#C27F5D', '#B96B45', '#A64E2E', '#7F2F22'],
  }),
  dark: freezeFormatTokens({
    surface: '#151821',
    primaryText: '#F7F3EA',
    mutedText: '#AAA8B4',
    line: '#303543',
    accent: '#F08A5B',
    levels: ['#262A35', '#A85D42', '#C56D47', '#DF8050', '#F59B69'],
  }),
});

export const LANGUAGE_FORMAT_TOKENS = Object.freeze({
  light: freezeFormatTokens({
    surface: '#FCFAF5',
    primaryText: '#17171B',
    mutedText: '#5E5B63',
    line: '#D8D2C7',
    ranks: ['#59622D', '#606933', '#687038', '#70783E', '#788044'],
  }),
  dark: freezeFormatTokens({
    surface: '#151821',
    primaryText: '#F7F3EA',
    mutedText: '#AAA8B4',
    line: '#303543',
    ranks: ['#BAC37C', '#A9B16D', '#98A05F', '#879052', '#778045'],
  }),
});

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}
