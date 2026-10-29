# Enterprise Admin UI Redesign (Frontend Only)

## Summary
Replace the current "AI-generated" look (gradient tiles, `rounded-2xl/3xl`, `font-extrabold`, colored soft-tint pill buttons, `animate-ping/pulse` badges, `shadow-2xl` dropdowns, uppercase mono micro-labels, verbose nav names) with a consistent enterprise-admin design system: flat white surfaces, hairline `slate-200` borders instead of shadows, 6–8px corners, one brand accent (indigo-600), calm `font-semibold` typography, and semantic color used only for status/danger/warning. Light + dark mode both preserved (Tailwind v4 media-query dark variant, as today). No component logic, state, props, API calls, or file structure changes beyond styling — every handler, validation, and data flow stays exactly as-is.

## Design System Foundation

### `index.html`
- Add Inter font via Google Fonts `<link>` (weights 400/500/600/700, `display=swap`); falls back gracefully offline to the system stack.

### `src/index.css` — tokens + reusable component classes (Tailwind v4 `@theme` / `@layer components`)
Define once, then every file consumes these classes instead of ad-hoc class soup:
- **Theme tokens**: `--font-sans: Inter, system-ui…`; corner radii `rounded-md` (6px) for buttons/inputs/badges, `rounded-lg` (8px) for cards/modals/dropdowns; `--shadow-card` = single subtle `0 1px 2px rgb(0 0 0 / 0.05)` (kills `shadow-2xl`, colored shadows).
- **`.btn`** variants: `.btn-primary` (solid indigo-600, hover indigo-700, white text, rounded-md, h-9, text-sm font-medium), `.btn-secondary` (white + border-slate-300, hover bg-slate-50, text-slate-700), `.btn-danger` (rose-600 solid), `.btn-ghost` (transparent, hover bg-slate-100), `.btn-sm` (h-8 text-xs). All include `disabled:opacity-50`, dark-mode equivalents. No colored tints (emerald/amber/violet/sky button pills are gone).
- **`.card`**: `bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-card`.
- **`.input` / `.select` / `.textarea`**: h-9 rounded-md border-slate-300 bg-white text-sm, focus ring `ring-2 ring-indigo-500/20 border-indigo-500`, no `shadow-inner`; `.label`: `text-xs font-medium text-slate-600` (replaces uppercase mono micro-labels).
- **`.table`**: header `text-xs font-medium text-slate-500 bg-slate-50 border-b`, rows `divide-y divide-slate-100 hover:bg-slate-50/70`, cells `text-[13px]`.
- **`.modal-panel` / `.modal-header` / `.modal-footer`**: rounded-lg, shadow-xl, header/footer hairline borders, `bg-slate-900/50` backdrop (no blur), subtle fade-in only.
- **`.badge`**: rounded-md (not pill), text-xs font-medium, quiet `bg-slate-100 text-slate-600 border-slate-200` default; semantic variants `.badge-success/.badge-warning/.badge-danger/.badge-info` for status only.
- **`.stat-tile`**: `.card` + label `text-xs text-slate-500`, value `text-2xl font-semibold tabular-nums`, small neutral icon chip (`bg-slate-100 text-slate-500 rounded-md`) — no gradient icon boxes.
- Keep the existing `@media print` block and the scanner `pointer-events` rule untouched.

## Shell (4 files)
- **`App.tsx`**: page background `bg-slate-50 dark:bg-slate-950` kept; selection color neutral.
- **`Header.tsx`**: white bar, h-14, `border-b`; brand = solid indigo-600 `rounded-md` tile (no gradient, no colored shadow), name `font-semibold tracking-tight`, "PDAMS" tag → plain `text-[10px] text-slate-400` (no mono uppercase badge); subtitle line removed on <lg. Global search → `.input` with icon. "Scan Tag / QR" → `.btn-primary`; "Batch Relocate" → `.btn-secondary` (drop emerald tint). Notification dot: solid rose-500, **no `animate-ping`**. Dropdowns → rounded-lg, border, shadow-lg, `.badge` counts; persona rows use neutral hover + brand-tinted active state; role shown as plain text (no mono pills).
- **`Sidebar.tsx`**: **light theme** — `bg-white border-r border-slate-200` (dark: slate-900). Nav labels shortened: Dashboard, Locations, Documents, Bundles, Circulation, Retention, Audit Log, Settings. Items: `text-sm text-slate-600`, active = `bg-indigo-50 text-indigo-700 font-medium` with 2px left indigo indicator bar (dark: `bg-indigo-950/50 text-indigo-300`); icons `w-4 h-4` slate-400/indigo. Count badges → quiet `.badge`; only Overdue keeps rose, pending-requests keeps blue, **remove `animate-pulse`** on the settings badge. User card: flat bordered card, initials avatar `bg-indigo-600 rounded-md`, role as plain `text-xs text-slate-500`; Sign Out → `.btn-danger` ghost style; reset-data icon button → `.btn-ghost`. Mobile drawer: white panel, same items.
- **`MobileBottomNav.tsx`**: white bar, `border-t`, neutral icons, active = indigo-600 icon+label, scanner FAB → solid indigo `rounded-lg` (no gradient/ring decorations).

## Shared Components (7 files)
- **`StatusBadge.tsx`**: all four badge families → `rounded-md` compact badges on the new `.badge` semantic palette (keep hue mapping: Available=emerald, Checked Out=amber, Requested=blue, Approved=cyan→**sky** for palette discipline, In Transit=purple→**indigo-outline** w/ static icon, Archived/Disposed=slate, For Disposal/Overdue=rose). Remove **all** `animate-pulse` (Overdue keeps a rose dot icon instead); remove emoji (`⚠`, `❌`) → lucide icons; confidentiality badges lose the shield-icon color soup → text + small neutral icon.
- **`ConfirmModal.tsx`**: modal chrome per `.modal-*`; icon tile → small semantic chip; buttons → `.btn-secondary` / variant `.btn-danger|.btn-primary`.
- **`DocumentTypeCombobox.tsx`**: input → `.input`; dropdown → rounded-lg border shadow-lg; keep existing `bg-indigo-50 dark:bg-indigo-950/60` match-highlight spec (user-mandated) but as the only indigo tint; footer hint text `text-[11px] text-slate-400`.
- **`LocationPathBreadcrumbs.tsx`**, **`PhotoUploader.tsx`**, **`QRBarcodeModal.tsx`**, **`ProfileModal.tsx`**: same class substitutions (cards, buttons, inputs, badges, modal chrome); PhotoUploader dropzone → dashed slate-300 border, neutral hover.

## Pages (9 files)
Apply the shared page pattern to every page: header row (title `text-lg font-semibold`, subtitle `text-sm text-slate-500`, right-aligned actions as `.btn-*`), `.card` sections, `.table` lists, `.stat-tile` metrics, `.input/.select/.label` forms, quiet pagination (`.btn-secondary` chevrons + `text-xs` page info).
- **DashboardPage**: stat tiles de-gradiented; quick-action cards → flat `.card` with neutral icon chips and indigo hover border; recent-activity lists use `.table` row styling.
- **DocumentsPage** (1447 ln): toolbar filters/inputs normalized; bulk-action banner → flat indigo-50 bar with `.btn-sm` neutral buttons (single indigo primary = the confirm action, delete = `.btn-danger`); registration modal + table + pagination restyled.
- **DocumentDetailPage**: metadata sections → `.card` with label/value rows (`text-xs slate-500` / `text-sm slate-900`); action buttons unified; tabs → underline style (`border-b-2 border-indigo-600` active, slate text inactive — replaces pill/rounded tabs).
- **LocationsPage**: tree rows → flat hover, indigo active row tint; type icon chips neutral except functional type colors kept muted.
- **BundlesPage**: **amber theme retired** — bundle cards/rows use `.card` + indigo accent like the rest; amber remains only for warning toasts. Hover-preview behavior unchanged.
- **CheckoutsPage / RetentionPage / AuditLogsPage**: tables + badges + empty states normalized; audit log action-type chips → quiet `.badge` variants.
- **SettingsPage** (2213 ln): section cards, forms, department/user tables, import-export panels all normalized to the class system; tab/sub-nav → underline tabs.

## Feature Modals (7 files)
Unified `.modal-*` chrome + `.btn/.input/.badge` substitutions; scanner modals keep the amber-free palette (tab active = indigo), scan-region hint pills stay translucent; `ScanFillBundleModal`, `BatchRelocateModal`, `CameraQRScannerModal`, `BundleModal`, `EditDocumentModal`, `BulkUpdateModal`, `BulkTagPrintModal` (print CSS output itself unchanged — only the on-screen modal chrome).

## Auth
- **`AuthPage.tsx`**: professional split layout — left brand panel (solid deep navy `bg-slate-900`, product name, 3 short feature lines, no gradients/emoji), right form panel (white, `.input` fields, `.btn-primary` submit, quiet validation text in rose). Login/register/approval flows and all logic untouched.

## Global Style Rules (applied while editing each file)
1. No `font-extrabold` (→ `font-semibold`); no `font-mono` except document numbers, QR/barcode values, and code identifiers.
2. No text below `text-[11px]`; prefer `text-xs`. No `uppercase tracking-widest` micro-labels.
3. No gradients, no colored shadows (`shadow-indigo-500/20` etc.), no `shadow-2xl` on popovers (→ `shadow-lg`), no `backdrop-blur` except the mobile drawer.
4. No `animate-ping`/`animate-pulse`/`animate-bounce`; motion limited to 150ms fades/slides on dropdowns and toasts.
5. One accent (indigo-600); semantic hues (emerald/amber/rose/sky) only for status, validation, and destructive actions.
6. Every `dark:` variant kept in sync with its light rule.

## Execution Order
1. Foundation: `index.html` + `index.css` tokens/component classes.
2. Shell: `App.tsx`, `Header`, `Sidebar`, `MobileBottomNav`.
3. Shared components (7).
4. Pages (9), smallest→largest: Audit, Retention, Checkouts, Dashboard, DocumentDetail, Documents, Locations, Bundles, Settings.
5. Feature modals (7) + AuthPage.
6. Verification pass.

## Test Plan
- `npx tsc --noEmit` → zero errors after each phase (project standing requirement).
- `GetProblems` on every edited file.
- Start `npx tsx server.ts` and smoke-test in browser: all 9 tabs render, modals open/close, scanner overlay containment still correct (footer buttons clickable), dark mode via OS setting, print preview of tag sheet unchanged, mobile width (bottom nav + drawer).
- Grep sweeps to prove consistency: zero remaining `font-extrabold`, `rounded-2xl`/`rounded-3xl`, `gradient-to`, `animate-ping|pulse`, `shadow-2xl` in `src/**/*.tsx`.

## Assumptions
- Indigo-600 stays the brand hue (already in the logo/favicon); no rebrand requested.
- Amber bundle theming is decorative and can be retired without losing function (bundles remain identifiable by name/number/icon).
- No new dependencies except the Google Fonts link (zero runtime risk, system-font fallback offline).
- Backend, context, types, and all component props/handlers are untouched — this is a pure presentation-layer change.