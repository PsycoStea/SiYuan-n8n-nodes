# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.7] - 2026-09-01

### Fixed
- **Database operations now work on grouped views.** Adding a row to a database whose view is grouped by a field failed with `Row was added but could not be located on re-render.` — after the row had already been created, leaving it in the table with none of its fields set. When a view is grouped, SiYuan moves every row into `view.groups[]` and deliberately empties the top-level `view.rows` while still reporting the full `rowCount`, so the node's row-discovery step found nothing. The client now reassembles the grouped rows into a single list, so **Get**, **Update Row** and **Set Cell** work on grouped views too — previously Get failed outright on a grouped view (an opaque `Unknown error` from `renderAttributeView`, because a grouped view cannot be paged) and Update Row reported the row as not found. Thanks @sofa1780 for the report and for pointing at `srcs[].itemID`. Closes #26.
- **Add Row no longer depends on where the view puts the new row.** The row ID is now chosen up front and passed to SiYuan as `srcs[].itemID` (SiYuan ≥ 3.3.0), instead of being rediscovered by diffing the first page of the view before and after the insert. Fields can no longer be attributed to the wrong row under any view configuration — sorted, grouped, filtered or paginated — which is a stronger guarantee than the diff it replaces.
- **Compatibility with newer SiYuan kernels.** Field writes sent the `rowID` parameter, which upstream renamed to `itemID` (siyuan-note/siyuan#15727) and then made a hard error — in 3.7.0 for `setAttributeViewBlockAttr` (Set Cell) and in 3.7.2 for `batchSetAttributeViewBlockAttrs` (Add Row / Update Row). Both keys are now sent on both endpoints, so field writes work across old and new kernels.
- **Set Cell now finds rows beyond the first page.** It resolved the target row from a single 50-row page, so it failed on larger tables; it now searches all rows, matching Update Row.

### Changed
- **Add Row is faster and no longer slows down as the table grows.** Dropping the two row-discovery renders removes the per-row cost that still scaled with table size after 2.1.6 (measured then at ~38 → ~49 ms/row between ~50 and ~230 rows). A row with no fields to set now costs a single API call. No change to inputs or outputs.

## [2.1.6] - 2026-06-28

### Fixed
- **Database > Get now returns every row, not just the first 50.** SiYuan paginates `/api/av/renderAttributeView` (default page size 50) and the node only ever requested the first page, so Get silently capped at 50 rows. It now pages through to the view's true `rowCount` and returns all rows (in both Split and Single output modes). Closes #24.
- **Notebook > Remove now reports whether the notebook actually existed.** SiYuan's `removeNotebook` is idempotent and returns success even when the notebook is already gone, so repeated deletes all looked like `{"success": true}`. Remove now pre-checks existence and returns `{ success, found, notebookId }` — `found: false` when the notebook was already removed. Closes #23.

### Changed
- **Database > Add Row / Update Row write all fields in one batched call (issue #25).** Setting fields previously issued one `renderAttributeView` call *per field*; they are now collapsed into a single `batchSetAttributeViewBlockAttrs` call. In a benchmark, a 6-field insert into a ~100-row table dropped from ~130 ms to ~61 ms per row (~2×); the more fields per row, the larger the saving. The two row-discovery renders remain, so per-row time still creeps up gradually with total table size (measured ~38 → ~49 ms/row from ~50 to ~230 rows) — reduced, not eliminated. Update Row also now finds rows beyond the first 50 (it pages through all rows). No change to inputs or outputs.

## [2.1.5] - 2026-06-12

### Fixed
- **Notebook > Open → Get Document Tree no longer needs a manual "Wait" node.** Right after a notebook is opened, the SiYuan kernel is still rebuilding its block index and filetree calls (e.g. `getPathByID`, used by Get Document Tree) reject with `indexing` (Code: -1). The API client now retries transient "indexing" responses with exponential backoff (up to ~20s), so Open → Get Document Tree succeeds on its own and adapts to a loaded system. The retry is keyed on the message text, not the code, so genuine errors (auth failure, bad IDs) still fail fast. Closes #22.

### Changed
- **Database > Get — clearer guidance on Output Mode for existence checks.** Field descriptions now explain that **Split** mode emits no item when a filter matches no rows, which silently drops a non-matching input item at batch sizes above 1. For "does this record already exist" lookups inside a loop, use **Single** mode (one item per input, with a `rowCount`) and test `{{ $json.rowCount === 0 }}`. Addresses #20.

## [2.1.0] - 2026-05-17

### Added
- **New `Database` resource** — real SiYuan AttributeView CRUD via `/api/av/*`. Operations: List, Create, Get, Get Schema, Add Row, Remove Row, Add Column, Remove Column, Set Cell. Supports text, number, date, select, multi-select, checkbox, url, email, and phone column types. Closes #2.
- **New `Markdown Table` resource** — refactored from PR #3 (thanks @chaimt). Plain Markdown table CRUD (parses pipe-delimited rows): Create, Get, Add Row, Update Row, Delete Row. Parsing logic moved to `lib/markdownTable.ts`.

### Fixed
- **Document > Get Document Path by ID** and **Get Document ID by Path** now return a well-formed object (`{ id, path, found }` / `{ notebookId, path, ids, count, found, id }`) instead of a raw string / string array. n8n's Schema and Table tabs now render correctly, and downstream IF nodes no longer abort when a document is not found. Also wrapped `Get Storage Path`, `Get Readable Path from Storage Path`, and `Get Content`. Closes #6.

## [2.0.0] - 2026-04-10

### Breaking Changes
- Node version bumped to v2 — the main SiYuan node now uses a **Resource + Operation** pattern instead of a flat operation dropdown.
- Existing workflows using v0.x will need to update their SiYuan node configuration to select a Resource first, then an Operation.
- "List Files in Directory" moved from System resource to Asset resource.
- Removed ExampleNode and HttpBin scaffolding nodes.

### Added
- **Resource-based architecture** — operations organized under 8 resources: Notebook, Document, Block, Attribute, Tag, Search, Asset, System.
- **20+ new operations:**
  - Notebook: Open, Close, Get Configuration, Set Configuration
  - Document: Get Storage Path, Get Readable Path from Storage Path, Get Content (AI-optimized), Get Document Tree
  - Block: Move, Fold, Unfold, Transfer References, Get Content as Markdown
  - Tag (new resource): Add, Remove, Get Tags, List All, Rename, Find Blocks by Tag
  - Search: Full-Text Search, Search by Attribute, Get Recent Changes
  - Asset (new resource): Upload Asset, Get File, Put File, Remove File, Rename File
  - System: Get Current Time, Export Resources
- **4 AI Tool nodes** for use with n8n AI agents:
  - SiYuan Document Tool
  - SiYuan Block Tool
  - SiYuan Search Tool
  - SiYuan Notebook Tool
- **SiYuan Trigger node** — polling-based trigger for document/block changes with notebook filtering.
- **Credential test** — "Test Connection" button verifies API URL and token on save.
- **Structured error handling** — errors include operation context and actionable suggestions for both humans and AI agents.
- **`usableAsTool: true`** on main node for AI agent compatibility.
- **Input validation utilities** — `validateRequiredString`, `validateSiYuanId`, `validatePath`.

### Changed
- Complete codebase restructure: split from single 734-line node file into modular resource-based architecture.
- `SiYuanClient` refactored with full TypeScript typing (no `any` types), JSDoc comments, and 30s request timeout.
- All block operations default to Markdown with DOM available as an advanced option.
- Error messages now include remediation suggestions.
- Updated dependencies: axios 1.15.0, prettier 3.8.2, eslint-plugin-n8n-nodes-base 1.16.6.
- Added `form-data` dependency for multipart asset uploads.
- Added `@types/node` for Buffer type support.

### Removed
- ExampleNode and HttpBin scaffolding from n8n starter template.
- README_TEMPLATE.md.
- ExampleCredentialsApi and HttpBinApi credential files.

## [0.4.0] - 2025-05-11

### Added
- Notebook Management: Create, Rename, Remove Notebook.
- Get Child Blocks operation.
- Export Document Markdown operation.
- List Files in Directory operation.

## [0.3.1] - 2025-05-11

### Changed
- Improved operation and parameter descriptions.
- Minor lint fixes.

## [0.3.0] - 2025-05-10

### Added
- List Documents in Notebook operation (with titles).
- List Notebooks operation.

## [0.2.0] - 2025-05-10

### Changed
- Consolidated all functionality into a single SiYuan node with operation selector.
- Removed "AI" branding from node name.
- Updated dependencies and resolved build/lint issues.

## [0.1.x]

- Initial experimental versions with individual tool nodes (deprecated).
