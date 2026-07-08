# Contributing to Kamra PMS

Kamra is AGPL-3.0 and welcomes contributions — code, country packs, docs, bug
reports. This file covers the mechanics; see [`README.md`](README.md) for
install/quickstart and [`docs/`](docs/) for architecture.

## Development setup

Follow the **Quickstart (development)** section in the README. In short:
a Frappe bench, `bench get-app` this repo, `bench new-site` + `install-app`,
and `npm run dev` in `frontend/` for the SPA.

## Before you open a PR

- **Frontend:** `cd frontend && npm run build` must pass (typecheck + build).
- **Backend:** if you touched Python, run the eval harness locally —
  `bench --site <site> console`, then
  `from kamra.scripts.eval_harness import execute; execute()` — and confirm
  it still reports all checks passing.
- CI runs both automatically on every PR; a fresh-install check also verifies
  a brand-new site installs cleanly with your change.

## Commit messages

Please use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add occupancy-slab BAR rates
fix: correct GST rounding on split charges
chore: bump frontend deps

BREAKING CHANGE: removes the `Foo` doctype; see CHANGELOG.
```

This keeps `git log` readable and lets us automate changelog/version tooling
later without re-deriving intent from prose commit messages.

## Versioning & releases

Kamra follows [Semantic Versioning](https://semver.org/):

- **MAJOR** — breaks an existing install on `bench migrate` (a doctype is
  removed, a whitelisted API endpoint is removed or its contract changes).
- **MINOR** — new features, additive/backward-compatible doctype changes.
- **PATCH** — fixes with no migration impact.

Every notable change is recorded in [`CHANGELOG.md`](CHANGELOG.md) under
`[Unreleased]` as it lands; a release renames that section to the version
being cut and tags `vX.Y.Z`. Pushing a `v*` tag triggers
`.github/workflows/release.yml`, which publishes a GitHub Release.

If your change removes or renames anything a self-hoster might depend on
(a doctype, a whitelisted method, a config key), call it out explicitly under
a `### Removed (⚠️ breaking)` heading in the changelog entry — that's what
decides the next version is a MAJOR bump.

## Country packs

Localization lives behind the `kamra_localization` hook
(`kamra/localization/`); India ships as the reference pack. A new country
pack implements the same interface (tax calculation, invoice context, locale)
without touching the core. See `kamra/localization/india.py` for the shape.

## Code of conduct

Be respectful, assume good faith, keep discussion technical. Report abuse to
hello@kamrapms.com.
