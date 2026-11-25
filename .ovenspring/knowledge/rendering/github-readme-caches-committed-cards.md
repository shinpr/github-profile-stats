# GitHub can serve a cached README card after its committed SVG changes

The GitHub-rendered README on `ovenspring-e2e` points its card images to branch-based `/raw/ovenspring-e2e/assets/` URLs. The wide light Language Composition image at `/shinpr/github-profile-stats/raw/ovenspring-e2e/assets/language-composition-wide-light.svg` redirected to `raw.githubusercontent.com` and returned `Cache-Control: max-age=300`. The branch URL stays the same when the SVG changes, so a cached response can still contain the older card.

Applies when verifying a change to `assets/` on GitHub while the README uses branch-based raw image URLs. If the README still shows the old card, inspect the SVG file at the merge commit to verify what shipped.

Records. The owner’s reply in `state/sources/answers/sprint-20261125-075227-review-21.md` under Answer directs the factory to check the repository file. The raw URL and cache header were checked in `state/board/archive/20261125-102248-agreements-check-sprint-20261125-075227.md` under Result. [README image URL](https://github.com/shinpr/github-profile-stats/raw/ovenspring-e2e/assets/language-composition-wide-light.svg)
