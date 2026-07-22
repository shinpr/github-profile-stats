import { renderActivityConsistency } from '../render/activity-consistency.mjs';
import { renderLanguageComposition } from '../render/language-composition.mjs';
import { renderSignalField } from '../render/signal-field.mjs';
import {
  validateActivityConsistencySvg,
  validateLanguageCompositionSvg,
  validateSignalFieldSvg,
} from '../render/validate-svg.mjs';

export const LAYOUTS = Object.freeze(['compact', 'wide']);
export const COLOR_SCHEMES = Object.freeze(['dark', 'light']);

const VISUAL_FORMATS = Object.freeze({
  'signal-field': Object.freeze({
    id: 'signal-field',
    requiredDatasetIds: Object.freeze([
      'contributions',
      'totalStars',
      'authoredPullRequests',
      'authoredIssues',
    ]),
    render: renderSignalField,
    validate: validateSignalFieldSvg,
  }),
  'activity-consistency': Object.freeze({
    id: 'activity-consistency',
    requiredDatasetIds: Object.freeze(['contributions']),
    render: renderActivityConsistency,
    validate: validateActivityConsistencySvg,
  }),
  'language-composition': Object.freeze({
    id: 'language-composition',
    requiredDatasetIds: Object.freeze(['repositoryLanguages']),
    render: renderLanguageComposition,
    validate: validateLanguageCompositionSvg,
  }),
});

export function getVisualFormat(id) {
  const format = VISUAL_FORMATS[id];
  if (!format) throw new TypeError(`unsupported visual format: ${id}`);
  return format;
}
