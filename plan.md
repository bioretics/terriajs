# Merge Reconciliation Plan — `upstream/main` → `rer3d_to_8.12.4`

> This is the plan-mode deliverable. On approval + exit plan mode, the first execution
> action copies this to **`terriajs/plan.md`** at the repo root and seeds
> **`terriajs/MERGE_LOG.md`** from the tracking template. Repo: `e:\Download\claude_skills\terriajs`.

## Coordinates

```
UPSTREAM_REMOTE:  upstream            (https://github.com/TerriaJS/terriajs)
UPSTREAM_BRANCH:  main                (MERGE_HEAD ad6ebb822, 2026-07-01)
LEGACY_BRANCH:    rer3d_to_8.12.4     (HEAD bfb73fdf0, 2026-07-03)  fork: bioretics/rer3d
MERGE_BASE:       1217b825f           (2024-11-15, TerriaJS ~8.12.4-era, flat lib/)
NODE:             v24.18.0            (.nvmrc = theirs; engines.node >= 24)
BUILD_COMMAND:    yarn build          (turbo run build → terriajs assets + terriamap gulp build)
TEST_COMMAND:     yarn test           (turbo → gulp test; CI: yarn workspace terriajs gulp test-firefox via xvfb)
LINT_COMMAND:     yarn lint           (turbo → gulp lint)  +  yarn prettier-check
README GATE:      yarn sync-readme && git diff --exit-code -- README.md
```

## Context — why this plan exists

`rer3d_to_8.12.4` is a Bioretics/RER fork of TerriaJS that split from upstream at ~8.12.4
(Nov 2024) and added a large domain feature set (measurement/measurable-geometry, viewshed,
seismic microzonation, Cesium-2D, globe clipping, RER geocoder, login, Italian localization,
…). Upstream then moved **3,421 commits** over ~20 months and, crucially, **restructured into a
Turborepo monorepo** (`packages/terriajs` + `apps/terriamap`). The fork _also_ just did its own
monorepo move (flat `lib/` → `packages/terriajs/lib/`, HEAD commit `bfb73fdf0`).

A `git merge upstream/main` is already in progress with **510 unmerged paths**. The dominant
signal is **not** deep logic conflict — it is a **double-migration path collision**: both sides
independently relocated the same 8.12.4 files into `packages/terriajs/`. Blob-SHA analysis shows
**~450 of 510 conflicts are mechanical** (one side is a byte-identical relocated copy of the
old base), leaving **~60 genuine 3-way merges, ~10–12 genuinely hairy**. The real danger is the
**silent** layer: files that merged clean or auto-resolved but break semantically (stale import
paths, `.tsx`-shadows-`.jsx` feature drops, a new-file fork feature that got zero merge scrutiny).

**Intended outcome:** land on upstream's monorepo shape at current `main`, with every fork
feature still present and working, proven by green repo CI + a terriamap smoke build.

## Decisions locked (this session)

1. **Target shape = upstream's Turborepo monorepo.** Incoming structure is canonical; fork value
   (all under `packages/terriajs`) is re-integrated on top. Keep upstream-added `apps/terriamap`,
   `MONOREPO.md`, `SECURITY.md`, `turbo.json`, `.github/dependabot.yml` (clean adds).
2. **Node = theirs** (`.nvmrc` v24.18.0). Fork's 8.12.4-era node is obsolete for upstream's toolchain.
3. **Lockfiles = regenerate, never hand-merge.** After the root `package.json` is reconstructed,
   `yarn install` at repo root produces one hoisted root `yarn.lock`.
4. **Parallel-invention collisions → adopt upstream, flag gaps.** Where upstream independently
   built what the fork also built (Related Maps, Nominatim, GeoJSON clustering, COG/GeoTIFF), take
   upstream's implementation; keep fork's only where it adds behavior upstream lacks, and mark any
   behavior gap `needs-review`.
5. **Done bar = repo CI green + smoke.** `yarn lint` + `yarn build` (terriajs + terriamap) +
   `gulp test-firefox` + `yarn prettier-check` + `sync-readme` parity. (`rer3d-map` downstream
   verification is explicitly out of scope for this merge.)

## Conflict landscape (510 unmerged)

| Code | Count | Meaning                                      | Branch | Default disposition                                             |
| ---- | ----- | -------------------------------------------- | ------ | --------------------------------------------------------------- |
| AA   | 214   | both created `packages/terriajs/…`           | B      | 190 take-theirs (ours==base) · 24 real (14 merge + 10 trivial)  |
| UD   | 194   | ours relocated / theirs deleted-or-converted | E      | 189 accept-deletion (ours==base) · **5 traps** carry fork edits |
| UU   | 41    | both modified                                | B      | **all genuine 3-way** union preserving fork                     |
| AU   | 19    | added-by-us (`.js/.jsx`, old analytics)      | C      | take theirs `.ts/.tsx`, drop ours (byte-identical)              |
| UA   | 19    | added-by-them (`.ts/.tsx`)                   | C      | keep theirs (pairs with AU)                                     |
| DD   | 21    | both deleted (old flat paths)                | E      | accept deletion                                                 |
| DU   | 2     | deleted-by-us / modified-by-them             | E      | take theirs (`.nvmrc`, `MeasureTool.ts`)                        |

Guard for the mechanical bulk: a file is mechanical **iff `git show :2:<path>` (ours) SHA equals
`git show <merge-base>:<flat-path>` SHA**. Only then is take-theirs / accept-deletion safe. The 5
UD traps and 24 real AAs fail this guard and route to the semantic batch.

## Fork feature inventory (preserve list)

Class: (a) trivial · (b) clear · (c) structural · (d) fundamental. Risk = risk of silently losing it.

| #   | Feature                                                                                                                                            | Key files (under `packages/terriajs/`)                                                                                                                                     | New/Mod | Class | Risk     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | -------- |
| 1   | **Measurable geometry / measurement** (flagship, ~60 commits)                                                                                      | `ModelMixins/MeasurableGeometryMixin.ts`, `ViewModels/MeasurableGeometry/*`, `ReactViews/MeasurableGeometry/*`, `ReactViews/Custom/Chart/MeasurableGeometryChartPanel.tsx` | New     | d     | HIGH     |
| 2   | **Play Path** (fly-through)                                                                                                                        | `ReactViews/Custom/PlayPath.ts`, `MeasurableGeometry/PlayPathPanel.tsx`, `ReactViewModels/defaultPlayPathTourPoints.ts`                                                    | New     | c     | HIGH     |
| 3   | **Viewshed / line-of-sight**                                                                                                                       | `Models/UserDrawingViewshed.ts`, `ReactViews/Viewshed/ViewshedPanel.tsx`, `Map/MapNavigation/Items/ViewshedTool.ts`                                                        | New     | d     | HIGH     |
| 4   | **Microzonation** (RER seismic)                                                                                                                    | `ReactViews/Microzonation/*`, `Map/MenuBar/MicrozonationButton/*`, `Map/MenuBar/EmergencyPlansButton/*`                                                                    | New     | d     | HIGH     |
| 5   | **Login / user profile**                                                                                                                           | `ReactViews/Login/LoginPanel.tsx`, `Map/MenuBar/LoginButton/*`                                                                                                             | New     | c     | MED-HIGH |
| 6   | **Color-by-elevation**                                                                                                                             | `ReactViews/Map/Panels/ColorPanel/ColorPanel.tsx`                                                                                                                          | New     | c     | MED-HIGH |
| 7   | **Coordinates panel**                                                                                                                              | `ReactViews/Map/Panels/CoordsPanel/CoordsPanel.tsx`                                                                                                                        | New     | b     | MED      |
| 8   | **RER geocoder** (+ fork Nominatim)                                                                                                                | `Models/SearchProviders/RerSearchProvider.ts`, `NominatimSearchProvider.ts`, `Map/Geocoder/AddressGeocoder.js`                                                             | New/Mod | d     | HIGH     |
| 9   | **Related Maps** ⚠ upstream also built                                                                                                             | `Models/RelatedMaps.ts`, `ReactViews/RelatedMaps/RelatedMaps.tsx`                                                                                                          | Mod     | c     | MED-HIGH |
| 10  | **Configurable branding/theme**                                                                                                                    | `Models/InitSource.ts`, `ReactViews/SidePanel/Branding.tsx`, `Sass/**/_variables*.scss`                                                                                    | Mod     | b     | MED      |
| 11  | **Google Tile Maps catalog item**                                                                                                                  | `Models/Catalog/CatalogItems/GoogleTileMapsCatalogItem.ts` (+Traits)                                                                                                       | New     | b     | MED      |
| 12  | **Globe clipping** (GeoJSON clip planes)                                                                                                           | `ModelMixins/GlobeClippingMixin.ts` (+Traits), hooks in `GeojsonMixin.ts`/`Cesium.ts`                                                                                      | New     | d     | HIGH     |
| 13  | **Cesium-2D (SCENE2D) mode** + `mapViewers`                                                                                                        | `Models/Cesium.ts`, `Models/ViewerMode.ts`, `ReactViews/Map/Panels/SettingPanel.tsx`                                                                                       | Mod     | d     | HIGH     |
| 14  | **GeoJSON clustering + COG** ⚠ upstream also built                                                                                                 | `Traits/ClusteringTraits.ts`, `Core/getDataType.ts`, `Models/Catalog/addUserFiles.ts`                                                                                      | Mod     | b     | MED      |
| 15  | **MenuBar wiring** (carries #4–7)                                                                                                                  | `ReactViews/Map/MenuBar/MenuBar.jsx` → upstream `MenuBar.tsx`                                                                                                              | Mod     | c     | HIGH     |
| 16  | **Import/Export map** (share file)                                                                                                                 | `ReactViews/Map/Panels/SharePanel/ShareUrl/ShareUrl.tsx`                                                                                                                   | Mod     | c     | MED-HIGH |
| 17  | **WMS trait extensions** (`stylesToUse`, …)                                                                                                        | `Traits/TraitsClasses/WebMapServiceCatalogItemTraits.ts`                                                                                                                   | Mod     | b     | MED      |
| 18  | **Italian localization + Titillium font**                                                                                                          | `wwwroot/languages/{en,it}/translation.json`                                                                                                                               | Mod     | d     | HIGH     |
| 19  | Smaller UX (clamp-to-ground, ArcGIS scale, copy-layer-from-split, keyboard nav, mobile 2-row workbench, config-from-init, FeatureInfo copy/coords) | scattered UU/AA hosts                                                                                                                                                      | Mod     | b–c   | MED      |

**Corrected non-features (do not chase):** analytics (`Core/GoogleAnalytics.ts` etc.) is standard
TerriaJS, only path-moved by upstream; AR `ar-*.svg` / `AugmentedVirtuality.ts` is upstream-standard.
The `customizable/*` files (`Groups/MenuItem/MenuPanel`) have **zero** fork diff — safe take-theirs.

## Silent-conflict register (no markers, will break at runtime — verified)

| S   | Issue                                                                                                                                                                                                                                                             | Fix                                                                                                                            | Batch |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----- |
| S1  | **Root `package.json` missing** — trapped as two interleaved manifests inside `packages/terriajs/package.json` (`terria-monorepo` + `terriajs`). yarn/turbo cannot resolve.                                                                                       | Split into root `package.json` (monorepo) + library manifest; union fork dep additions into library.                           | 0     |
| S2  | **Analytics duplication** — old fork paths (`Core/GoogleAnalytics.ts`, `Core/AnalyticEvents/*`, `Core/ConsoleAnalytics.*`) coexist byte-identical with upstream `Core/Analytics/*`; **6 files still import old path**, 28 import new. Deleting dups breaks the 6. | Canonicalize on `Core/Analytics/`; repoint the 6 imports; delete 4 fork duplicates.                                            | 3     |
| S3  | **`MenuBar.jsx` shadowed by `.tsx`** — both present (+`.d.ts`); webpack resolves `.tsx` first → silently drops fork buttons Emergency/Login/Microzonation (subdirs confirmed present).                                                                            | Port fork buttons into `MenuBar.tsx`; delete `MenuBar.jsx`/`.d.ts`.                                                            | 4d    |
| S4  | **`UserDrawingViewshed.ts` mis-paired rename** — git paired fork viewshed against upstream `UserDrawing.ts` (stage2==stage3 blob). Markers interleave fork viewshed with 20 mo of upstream drift.                                                                 | Treat viewshed as fork-owned; port only shared API drift from upstream `UserDrawing.ts`. Resolve together with #2 UserDrawing. | 4c    |
| S5  | **`RerSearchProvider.ts` clean-added → zero scrutiny** — imports old analytics path; extends `LocationSearchProviderMixin` whose `doSearch`/`logEvent` signatures may have drifted.                                                                               | Fix analytics import; smoke-test against upstream mixin; re-register in rewritten `registerSearchProviders.ts`.                | 4a    |
| S6  | **`customizable/MenuButton.jsx` ≠ `.tsx`** (others byte-identical)                                                                                                                                                                                                | Verify no lost fork logic before deleting `.jsx`.                                                                              | 3     |

## Batches (execution order)

Order = **build-bootstrap first**, then merge-conflict-priority phases (images → JS/TS → JSON →
other → deletions), with structural/rename (C/D) before content (B), and dependency-ordered within
the semantic batch (search/analytics → core hosts → mixins → wiring → catalog → UI → chart ports).

### Batch 0 — Workspace bootstrap _(blocker; class c)_

- **S1**: split `packages/terriajs/package.json` → recreate root `package.json` (`terria-monorepo`
  block: `workspaces:["packages/*","apps/*"]`, turbo/husky/prettier devDeps) + keep library manifest;
  **union the fork's dep/name changes** (+44/−18) into the library manifest deliberately.
- Resolve `.nvmrc` **take theirs** (v24.18.0); accept upstream `apps/terriamap`, `MONOREPO.md`,
  `SECURITY.md`, `turbo.json`, `.github/dependabot.yml` (already staged clean adds).
- Regenerate root `yarn.lock`: `yarn install` at repo root.
- **Verify:** `yarn install` resolves workspaces; `yarn turbo run build --dry` lists tasks. Unblocks all later verification.

### Batch 1 — Images & SVG _(Phase 1; class a)_

- Take incoming for all conflicted `.png/.svg`. SVG renames: take theirs `pulling-away-layers.svg`,
  `take-the-tour.svg`; drop ours `*-icon.svg`. `git add`.

### Batch 2 — Mechanical relocation bulk _(~379; class a)_

- **AA-untouched (190): resolve to theirs.** **UD-mechanical (189): accept deletion.**
- Scripted, **guarded** by `ours(:2) SHA == merge-base:flat SHA` per file; any file failing the
  guard is excluded and routed to Batch 4. Includes ~100 generated `.d.ts`/`.scss.d.ts` stubs.
- **Verify:** `yarn workspace terriajs gulp lint` parses; `tsc -b` progresses (expect remaining
  errors only from not-yet-merged semantic files).

### Batch 3 — Type-change & rename collisions _(Branch C/D, ~60; class b/c)_

- **AU/UA byte-identical pairs:** `git checkout --theirs` the `.ts/.tsx`; `git rm` ours `.js/.jsx`
  (`sortedIndices`, `supportsWebGL`, `Editor`, `Groups`, `MenuItem`, `MenuPanel`, `Tour*`, `FadeIn`,
  `SlideUpFadeIn`). **MenuBar AU/UA is NOT here** — deferred to 4d (carries features).
- **S2 analytics reorg:** drop fork `Core/` old analytics; take `Core/Analytics/*`; repoint the 6
  stale imports; delete the 4 duplicates.
- **S6:** diff `customizable/MenuButton.jsx` vs `.tsx`; delete `.jsx` after parity confirmed.
- **DD** accept deletions; **DU** `MeasureTool.ts` take theirs (confirm not intentionally fork-disabled).
- Keep unpaired: `ArcGisFeatureServerStratum.ts` (theirs, upstream-new).
- **Verify:** grep confirms zero remaining `Core/GoogleAnalytics|AnalyticEvents/analyticEvents` imports; `gulp lint`.

### Batch 4 — JS/TS semantic 3-way _(Branch B, ~50; class c/d — the real work)_

Dependency-ordered sub-batches, each `git add` + scoped typecheck before next:

- **4a Search + analytics foundation:** `SearchProviderMixin.ts`, `registerSearchProviders.ts`
  (re-register: **Nominatim→theirs** per decision-4, **Rer→port fork**), `SearchBarModel.ts`,
  `SearchState.ts`, **S5** `RerSearchProvider.ts` scrutiny.
- **4b Core hosts:** `Terria.ts` (union fork config params + managers with upstream `StartData`/
  `FeedbackService`), `Cesium.ts` + `ViewerMode.ts` **(Cesium-2D — class d)**, `ViewState.ts`.
- **4c Mixins/feature hosts:** `GeojsonMixin.ts` (+ GlobeClipping hooks — class d), **S4**
  `UserDrawing.ts` + `UserDrawingViewshed.ts` together, `FeatureInfoSection.tsx` (12 hunks, biggest),
  `FeatureInfoPanel.tsx`, `MouseCoords.ts`, `MapColumn.tsx`.
- **4d MenuBar (S3):** port fork buttons (Emergency/Login/Microzonation/Coords/Color) into upstream
  `MenuBar.tsx`; delete `MenuBar.jsx`/`.d.ts`; verify fork button subdirs stay wired.
- **4e Catalog:** `Kml/Gpx/ArcGisFeatureServer(+Stratum)/CartoMapV3/Csv/GeoJson/WFS/WMTS/
ArcGisMapServer`; `registerCatalogMembers.ts` (**union**: fork GoogleTileMaps + upstream TileMapService);
  clustering→theirs, COG→theirs (decision-4).
- **4f Remaining UU + substantive AA:** `registerMapNavigations.tsx` (viewshed/measure tools),
  `ViewingControls.tsx`, `SettingPanel.tsx`, `SidePanel.tsx`/`SidePanelContainer.tsx`
  (**RelatedMaps→theirs**, port fork positioning if unique), `Story.tsx`, `StandardUserInterface.tsx`,
  `ShareUrl.tsx` (import/export map), `BottomBar/BottomLeftBar/WorkbenchItemControls/WorkbenchList/
ZoomControl/PedestrianMode/LocationSearchResults/highlightKeyword`, `Reproject.ts` (proj4 API),
  `EarthGravityModel1996.js`, `MobileHeader/MobileModalWindow.jsx`.
- **4g UD-real ports:** **`BottomDockChart.jsx` (+297 lines → onto upstream `.tsx`)**,
  `SearchBoxAndResults.jsx`→`.tsx`, `ZoomX.jsx`→`.tsx`.
- **Verify:** `tsc -b tsconfig-node.json` clean; `gulp lint build` on terriajs.

### Batch 5 — JSON _(class b/d)_

- **`en/it/translation.json` UU: union** preserving fork keys + fork Italian strings (class d for `it`).
- `lo/lzh` take theirs (trivial). Magda/test-fixture map-config JSON take theirs.
- **Verify:** JSON parses; i18n keys referenced by fork components resolve (grep feature keys).

### Batch 6 — Other (SCSS/docs) + regenerate `.scss.d.ts` _(class b)_

- Theme: `_variables.scss`, `_variables-export.scss`, `Icon.tsx`, `related-maps.scss` — keep-ours
  branding / small union. Content scss (`add-data`, `help-panel`, `mobile-header`) union. `skinning.md`.
- **Regenerate all `.scss.d.ts`** from merged `.scss` (build artifact — never hand-merge).
- **Verify:** `gulp build` produces styles; no `.scss.d.ts` drift after regenerate.

### Batch 7 — Deletion sweep & silent audit _(Phase 3; class a/c)_

- Confirm all DD/UD deletions applied; no orphan `.jsx`/`.d.ts` duplicates remain (MenuBar,
  customizable, analytics). Grep old paths repo-wide → zero hits.
- **Feature-preservation cross-check:** walk the 19-row inventory; every feature marked
  `present-already` / `merged-forward` / `ported` in MERGE_LOG.md — none silently dropped.

## Class-(d) — require human sign-off before finalize

1. `UserDrawing.ts` + `UserDrawingViewshed.ts` (viewshed) — S4 mis-pair.
2. `Terria.ts` — fork config params/managers vs upstream lifecycle.
3. `Cesium.ts` + `ViewerMode.ts` — Cesium-2D mode (threads through measure/playpath 2D).
4. `GeojsonMixin.ts` (+ GlobeClipping) — paintRules refactor overlap.
5. `FeatureInfoSection.tsx` — 12-hunk overlap.
6. `en`/`it` `translation.json` union.
7. `RerSearchProvider` API-contract against upstream `LocationSearchProviderMixin`.
8. Parallel-invention behavior gaps (RelatedMaps / Nominatim / clustering / COG) where fork behavior
   differs from adopted-upstream — flagged `needs-review` per decision-4.

## Multi-session estimate (~4 sessions)

| Session | Batches          | Outcome                                                                     |
| ------- | ---------------- | --------------------------------------------------------------------------- |
| 1       | 0–3              | ~450 files resolved; workspaces resolve; lint parses; mechanical bulk done  |
| 2       | 4a–4d            | Search/core/mixins/MenuBar; viewshed + Cesium-2D reconciled; tsc-node clean |
| 3       | 4e–4g, 5, 6      | Catalog/UI/chart ports; translations union; scss + regen                    |
| 4       | 7 + verification | Silent audit, feature cross-check, full CI, commit prep                     |

## Verification / definition of done (decision-5)

1. `yarn install` (root) clean; `yarn lint` (turbo) clean; `yarn prettier-check` clean.
2. `yarn build` — terriajs assets **and** `apps/terriamap` build.
3. `yarn workspace terriajs gulp test-firefox` (xvfb) — full suite green (broad suite at end;
   scoped specs per batch during execution).
4. `yarn sync-readme && git diff --exit-code -- README.md` — README parity.
5. **Manual smoke** in terriamap: measurement + play-path, viewshed, microzonation button,
   login button, color/coords panels, Cesium-2D toggle, RER search, related maps, Italian locale.
6. `grep -R '<<<<<<<\|>>>>>>>\|=======' packages/terriajs/lib` → zero markers.
7. MERGE_LOG.md: every `git status` path has an index row; feature inventory fully accounted.

## Guardrails (binding — `.claude/rules/merge-conflicts.md`)

- Never wholesale-pick ours/theirs on a semantic file without reading both sides. (The scripted
  take-theirs bulk in Batch 2 is gated by the byte-identical blob guard — not a blind pick.)
- Never drop a fork feature to clear a conflict; union or mark `needs-review`.
- No destructive git (`merge --abort`, `reset --hard`, force-push) without explicit approval.
- Single merge commit only after Phase-5 verification passes; human go-ahead before commit
  (draft message via caveman-commit).
- Update MERGE_LOG.md after **every** file; `git add` a path only once its scope is green.

```

```
