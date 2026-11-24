# Signal Field and Activity Consistency never draw a day with missing data

A card is generated only when GitHub returns every day of the period: `validateDailySeries` in `src/domain/snapshot.mjs` throws when a day is missing or out of order, so generation stops instead of drawing a gap. Every drawn cell is a real day, and a day with zero contributions is drawn with the lowest activity color (`levels[0]` / `theme.activity[0]`, `src/render/tokens.mjs`). The only empty spots in the grid are the positions before the first day and after the last, left undrawn so the weeks line up (`positionCalendarDays`, `src/render/calendar-grid.mjs`).

Applies when an issue, plan, or key result speaks of a "day with no data" on these cards: the only no-data spots are that week padding, and a zero day must stay distinguishable from it (a blank zero day would read as padding). Stops applying if the snapshot starts accepting gaps.

Record: sprint 20261124-180047, NOR-25 requirements question (`state/issues/NOR-25.json`, `resume.question`, Details 1). The sprint's key result for Signal Field assumed such days existed.
