# The profile list in `src/registry/profiles.mjs` is the source of truth; the README and `action.yml` follow it

The owner settled this: the set of profiles is the one in `PROFILE_IDS` (`src/registry/profiles.mjs`). Every other place that names the profiles copies that list, and no test checks the copies against it:
- `action.yml`: `inputs.profile.description` (lists the names and the default) and `inputs.profile.default`.
- `README.md`: the "Profiles and generated files" table and the `profile` row of the "Inputs" table.
- `src/action.mjs`: the fallback profile when the input is empty (`'signal-field'`).
- `src/registry/visual-formats.mjs`: one registered visual format per profile id.

Applies when a change adds, removes, renames, or reorders a profile, or changes the default: change `PROFILE_IDS` first and bring each copy above in line with it in the same change. When a copy disagrees with `PROFILE_IDS`, the copy is wrong. Stops applying if the README and `action.yml` come to be generated from the registry.

Record: the owner's reply to the review of sprint 20261124-180047 (`state/sources/answers/sprint-20261124-180047-review-9.md`): "the profile list in src/registry/profiles.mjs is the source of truth; the README and action.yml follow it." NOR-23 (`afbd689`) had changed the `action.yml` description to list the names by hand.
