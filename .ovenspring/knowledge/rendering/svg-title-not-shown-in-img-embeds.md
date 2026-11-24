# An SVG `<title>` tooltip does not show where the cards are embedded

The cards reach readers as images: the README embeds them with `<img>`/`<picture>`, as does the preview page, and a GitHub profile README does the same. An SVG loaded as an image is not interactive, so its `<title>` hover tooltip does not appear there. Inferred from how browsers treat SVG-as-image; not tested in a browser.

Applies when a request asks for hover text, links, or other interaction inside a card: say before building it that readers will not see it where the cards are used. The `<title>` per language bar added in NOR-24 (`src/render/language-composition.mjs`) is in this case.

Record: sprint 20261124-180047, NOR-24 review-response result, "Make visible" (`state/board/archive/20261124-213118-review-response-NOR-24.md`).
