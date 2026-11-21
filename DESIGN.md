---
name: Infynix OS
description: A quiet, paper-like workspace for running a company.
colors:
  ink-green: "#017c5f"
  ink-green-lit: "#03936f"
  ink-green-deep: "#016a51"
  ink-green-wash: "#e9f2eb"
  stone-ground: "#f3f0e8"
  paper: "#fbf9f4"
  paper-hover: "#ede9df"
  ink: "#1b1915"
  ink-2: "#4b4740"
  ink-3: "#6b665c"
  hairline: "#e3ded2"
  hairline-strong: "#d0c9ba"
  danger: "#c4321f"
  danger-wash: "#f9e9e3"
  night-ground: "#0c0d0e"
  night-paper: "#141517"
  night-paper-hover: "#1c1d20"
  night-ink: "#f4f4f5"
  night-ink-2: "#b9bac1"
  night-ink-3: "#8e8f98"
  night-hairline: "#26272b"
  night-hairline-strong: "#35363b"
  night-ink-green: "#3fbf94"
  night-ink-green-wash: "#0f2a22"
typography:
  display-lg:
    fontFamily: "Figtree Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  display:
    fontFamily: "Figtree Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  display-sm:
    fontFamily: "Figtree Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Figtree Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "-0.01em"
  body-lg:
    fontFamily: "Figtree Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
  body:
    fontFamily: "Figtree Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "21px"
  label:
    fontFamily: "Figtree Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "20px"
  caption:
    fontFamily: "Figtree Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  micro:
    fontFamily: "Figtree Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "10": "40px"
  sidebar: "248px"
  header: "52px"
  drawer: "280px"
  sheet: "440px"
components:
  button-primary:
    backgroundColor: "{colors.ink-green}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.ink-green-lit}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  field-input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "40px"
  card-surface:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    padding: "0"
  card-raised:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    padding: "16px"
  nav-item:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "32px"
  nav-item-active:
    backgroundColor: "{colors.ink-green-wash}"
    textColor: "{colors.ink-green}"
  role-chip:
    backgroundColor: "{colors.ink-green-wash}"
    textColor: "{colors.ink-green}"
    rounded: "{rounded.md}"
    padding: "2px 6px"
---

# Design System: Infynix OS

## Overview

**Creative North Star: "The Paper Desk"**

Infynix OS should feel like a well-kept desk in a quiet office: a warm stone ground, paper-white panels laid on top, dark ink for everything that matters, and one green mark that says "this is live." The palette is deliberately warm rather than clinical, and the single accent is deliberately rare. This is a tool for running a company, not a brand surface; familiarity, density and calm outrank expression.

The system is Swiss in its structure and paper in its material. A 4px grid, hairlines instead of boxes, and a compact Figtree scale carry the page. Depth is a warm, short shadow under a sheet of paper, never a grey glow. Every screen uses the same control vocabulary, the same focus ring and the same green for the current thing, so a manager can move from invoices to users without relearning the interface.

`src/styles/tokens.css` is the normative source of values; this document explains how to use them. If the two disagree, the tokens file wins.

**Key Characteristics:**
- Warm stone and paper neutrals in light; near-black paper in dark.
- One accent: ink green (#017c5f), used for action, selection and state, never decoration.
- Hairline structure: 1px warm borders and rings instead of heavy containers.
- Compact working type: weight first, size second, 11–34px only.
- Flat by default; warm Lift for panels, Raised (the secondary button's subtle bevel) for cards you handle, Dialog for overlays, Well for segmented controls.
- Sentence-case controls, counted and tabular wherever numbers appear.

## Colors

A warm neutral field with one green signal; both themes are first-class.

### Primary
- **Ink Green** (#017c5f): the only accent. Primary buttons, active navigation, links, focus rings, owner/manager chips, selected rows. Its lifted top (#03936f) and deep ring (#016a51) exist only inside the button bevel.
- **Ink Green Wash** (#e9f2eb): the quiet fill behind the current navigation item and role chips. Never a full-page background.
- **Ink Green Lifted for Text** (#3fbf94): the dark-theme replacement for green text, where #017c5f would not reach contrast.

### Neutral
- **Stone Ground** (#f3f0e8): the app canvas behind panels, drawers and dialogs.
- **Paper** (#fbf9f4): panels, fields, tables and the sidebar. The brightest surface in light mode.
- **Paper Hover** (#ede9df): row and control hover in light mode.
- **Ink** (#1b1915): primary text.
- **Ink 2** (#4b4740): secondary text, labels, navigation at rest.
- **Ink 3** (#6b665c): metadata, placeholders, de-emphasised text.
- **Hairline** (#e3ded2): dividers inside panels.
- **Strong Hairline** (#d0c9ba): panel edges and field rings.
- **Danger** (#c4321f): destructive actions and errors; **Danger Wash** (#f9e9e3) is its banner background.

### Dark theme
- **Night Ground** (#0c0d0e) and **Night Paper** (#141517) replace the stone and paper roles; **Night Paper Hover** (#1c1d20) replaces hover.
- **Night Ink** (#f4f4f5), **Night Ink 2** (#b9bac1), **Night Ink 3** (#8e8f98).
- **Night Hairline** (#26272b) and **Night Hairline Strong** (#35363b).
- **Night Ink Green** (#3fbf94) for green text; **Night Ink Green Wash** (#0f2a22) for selected fills.

### Named Rules
**The One Green Rule.** Ink green covers at most a tenth of any screen. It marks the primary action, the current navigation item, a role chip, a link or a focus ring — nothing else. If a decoration wants green, it gets ink or a hairline instead.

**The Warm Paper Rule.** Light surfaces are warm off-white; dark surfaces are warm near-black. Pure `#fff`, pure `#000` and cool grey shadows are outside the system.

**The Named State Rule.** Green means live or selected; red means destructive or failed; ink-3 means unavailable. Never use colour without a state meaning.

## Typography

**Display Font:** Figtree Variable (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** the same family
**Label Font:** the same family
**Accent Font:** Caveat Variable (handwriting; only the OS in the sidebar wordmark)

**Character:** One compact working sans, chosen for density and calm. Weight carries rank before size does, so a 16px title at 600 can sit above 14px body without a jump in scale.

### Hierarchy
- **Display LG** (600, 34px/1.12, -0.025em): page headings at 640px and up.
- **Display** (600, 30px/1.15, -0.025em): page headings on phones.
- **Display SM** (600, 26px/1.15, -0.02em): sign-in and sign-up headings.
- **Title** (600, 16px/24px, -0.01em): dialog and drawer titles, empty-state headings.
- **Body** (400, 14px/21px): the default UI text, buttons, inputs and table cells.
- **Body LG** (400, 15px/22px): page sublines and longer supporting copy.
- **Label** (500, 13px/20px): form labels, small buttons, notes and table headers.
- **Caption** (400, 12px/16px): metadata, hints and field errors.
- **Micro** (600, 11px/16px): role chips and the smallest status tags.

### Named Rules
**The Weight-First Rule.** To make something louder, raise its weight or move it from ink-2 to ink before adding a size. Never introduce a new size for emphasis.

**The Tabular Rule.** Dates, counts, page numbers, last sign-in and any column that compares figures use `tabular-nums`. Prose never does.

**The Sentence-Case Rule.** Buttons, labels and menu items are sentence case ("Add user", "Save changes", "Payments & Budget"). No title case, no all-caps except a semantic tag already defined as micro and the AGENCY wordmark.

## Layout

A fixed working shell: a 248px sidebar on the left at `lg` (collapsible to a 64px icon rail from its header), a 52px header across the top, and content that scrolls inside `<main>` while the shell stays put. Content takes 20px side padding on phones and 40px from `sm` up; reading surfaces stop at 64rem (`max-w-5xl`), while tables and panels fill the available width.

The spacing rhythm is a 4px base with 8, 12, 16, 20, 24 and 40 as the working steps. Related controls sit 8–12px apart; a new group starts at 16–24px; a new section starts at 24–40px. More space goes above a heading than below it. Navigation rows are 32px tall, buttons 36px, inputs 40px, page actions 32px when compact.

Below `lg` the sidebar becomes a 280px drawer with a scrim; tables become one card per row; pagination pins to the bottom of the viewport. Above `sm` the app shell is exactly one viewport tall and only the content area scrolls. Dialogs are 420px wide by default, side drawers 440px, and the auth column 380px.

## Elevation & Depth

Hybrid: tonal layering plus a warm 1px ring plus a short, soft shadow. Surfaces are flat at rest; a panel earns Lift because it holds content, not because it is a card. A card that is an object you pick, open, drag or act on earns **Raised**: the same subtle bevel as the secondary button, so it reads as something you can handle. Overlays earn Dialog because they leave the page. The segmented control is the only element that goes inward, with the Well shadow.

The 3D is deliberately subtle: a two-stop paper gradient, a hairline ring, a one-pixel lit or shaded edge and a short drop. It should read as "slightly raised paper", never as a glossy or bulging button.

### Shadow Vocabulary
- **Lift** (`0 0 0 1px rgb(43 36 24 / 0.07), 0 1px 2px -1px rgb(43 36 24 / 0.08), 0 4px 12px -2px rgb(43 36 24 / 0.06)`): panels, tables, empty-state icon tiles.
- **Dialog** (`0 0 0 1px rgb(43 36 24 / 0.07), 0 8px 16px -4px rgb(43 36 24 / 0.1), 0 24px 48px -12px rgb(43 36 24 / 0.18)`): dialogs, drawers and their backdrops.
- **Well** (`inset 0 1px 3px rgb(43 36 24 / 0.1), inset 0 -1px 0 rgb(255 255 255 / 0.55), inset 0 0 0 1px rgb(43 36 24 / 0.09)`): the groove a segmented control sits in.
- **Button bevel** (`0 0 0 1px <deep>, inset 0 1px 0 rgb(255 255 255 / 0.2), 0 1px 2px …, 0 2px 6px -2px …`): the lit top edge of primary, secondary and danger buttons.
- **Raised** (the `card-3d` class in `src/index.css`): `--btn-secondary-bg` gradient (#fdfbf7 to #f2eee5) with `--btn-secondary-shadow` (warm ring, shaded bottom edge, 1–2px drop). In dark theme the same tokens give a near-black gradient with a lit top edge. Used on CRM action cards, kanban cards, kanban stage headers, and the pipeline and stage rows in the management drawers. A clickable raised card (a `<button>`) also takes the button's hover brightness and its 0.5px press.

Dark theme replaces the Lift with a white hairline ring and the Dialog with a deeper black falloff; the Well keeps its inset logic.

### Named Rules
**The Flat-by-Default Rule.** A surface is flat until it needs to float: panels get Lift, handled cards get Raised, overlays get Dialog, nothing else gets a shadow.

**The Raised-Card Rule.** Use Raised (`card-3d`) for any new card that is an object in its own right: something you open, choose, drag, reorder or act on (action cards, board cards, list items in a management drawer, column headers that belong with them). Always apply it through `card-3d`, never by copying the values, so cards follow the buttons when the tokens change. Keep it subtle: no extra gradients, glows, thicker drops or hover lifts beyond the button's own brightness and press. A raised element that is not itself clickable gets the surface only; its buttons keep their own effects. Panels that hold content (tables, details, forms) stay on Lift.

**The One-Shadow Rule.** A raised card's depth lives in `box-shadow`, so never add a Tailwind `ring-*` or `shadow-*` to it except the Dialog shadow on the copy being dragged: a ring replaces the bevel and flattens the card. Show selection, focus or a highlight with an `outline` (for example `outline-2 outline-secondary`) instead.

**The Recessed-Segment Rule.** The Well is reserved for segmented controls. Never put an inset shadow on an input, a card, a navigation item or a container. Recessed trays for kanban columns ("slots") were tried on 20 Nov 2026 and rejected: raised cards sit on the plain hairline column, not in a sunken well. The system is subtle raise, not full skeuomorphism.

## Shapes

Rectangles with gently curved corners, sized by role: 8px for buttons and inputs, 6px for navigation rows and chips, 12px for panels and drawers, 4px for the smallest tags. Borders are 1px warm hairlines, often delivered as a ring-like shadow rather than a `border`.

Circular shapes are reserved for status dots and the header theme toggle; avatars are 6px squares with initials, not circles. No pills for containers, no cut corners, no hard offset shadows, no decorative clipping.

## Components

### Buttons
- **Shape:** 8px radius; 32/36/40px heights for small, default and large; 12–14px horizontal padding.
- **Primary:** ink-green gradient from #03936f to #017c5f, white text, deep ring and a 1–2px drop. One per view where possible.
- **Secondary:** paper gradient from #fdfbf7 to #f2eee5, ink text, warm ring. The default for Cancel, View and toolbar actions.
- **Danger:** red gradient, white text; used only for sign-out, deactivate, delete and their confirmations.
- **Hover / Focus:** hover raises brightness slightly; press translates 0.5px and flattens to the pressed inset; focus is the global 2px ink-green ring at 2px offset. Disabled is 60% opacity with a not-allowed cursor.

### Role chips
- **Style:** 6px radius, 11px/600 text, 2px by 6px padding. Owner and manager use the green wash with green text; staff uses paper-hover with ink-2.
- **Rule:** A chip names a role, not an action. Never make a chip clickable unless it is a filter.

### Tabs
- **Style:** a recessed Well groove holds the choices: 32px segments, one selected with the primary button treatment, the rest label-weight ink-2 with a paper-hover hover. The control hugs its labels and sits left-aligned, not stretched.
- **Rule:** sentence-case names, one selected at a time, only its panel shown. Arrow keys move between tabs and the panel is labelled by its tab.

### Cards / Panels
- **Two kinds.** A *panel* holds content (tables, detail sheets, forms, checklists) and uses Lift. A *card* is an object you handle (an action, a deal, a stage, a pipeline row) and uses Raised. If you are unsure, ask whether the user acts on the thing itself (card) or reads what is inside it (panel).
- **Corner Style:** 12px for cards and panels; 8px for compact rows inside a drawer list.
- **Background:** panels are paper with a header strip at canvas/50; cards take the Raised gradient from `card-3d`.
- **Shadow Strategy:** panels Lift only; cards Raised only (Dialog while being dragged).
- **Border:** panels use a 1px hairline between header and body and hairline-divided rows. Cards have no extra border: the Raised ring is the edge.
- **Internal Padding:** 12–16px for panels and board cards, 20px for action cards; a details grid uses a 6.5rem label column and a 12px gap.

### Kanban board
- **Stage header:** a Raised card with the 01-style stage number, the name, a count badge and a thin share bar.
- **Column (slot):** a flat container with a 1px hairline border and a faint paper fill; while a card is dragged over it, the border strengthens and the fill moves to paper-hover. No inset shadow (see the Recessed-Segment Rule).
- **Deal card:** a Raised card; the whole card is the drag handle, so it has no hover or press of its own; its View and options buttons carry the button effects. Selection and the search highlight are a 2px ink-green outline. The copy under the pointer while dragging tilts 1.5° and swaps to the Dialog shadow.
- **Loading more:** a small spinning circle (lucide `Loader2`, ink-3) at the foot of the column, not the bar loader.

### Inputs / Fields
- **Style:** 40px tall, 8px radius, paper background, inset 1px strong-hairline ring, 12px inline padding, 14px body text.
- **Focus:** the ring switches to 1.5px ink green, no glow.
- **Error / Disabled:** `aria-invalid` switches the ring to 1.5px danger; disabled uses the browser's muted treatment and never removes the label.
- **Labels:** 13px/500 ink-2, 6px below; a hint or error follows at 12px.

### Navigation
- **Sidebar:** paper, 248px, 32px rows with 6px radius, 16px icons at 1.9 stroke, 14px/500 ink-2. Hover moves to paper-hover and ink; the selected row uses the primary button treatment (gradient, bevel, on-primary text). The list starts 16px below the header hairline, rows carry 4px vertical padding around a 1px hairline between destinations.
- **Sections:** a 12px caption label in ink-3, 20px above the list.
- **Footer utility:** owner-only destinations (System) pin above the account block in the sidebar footer. They keep the normal 32px row and no section caption, separated from the account block by a full-bleed hairline.
- **Header:** 52px, paper, hairline bottom running across the content and the sidebar; the page title is 16px/600 ink, not a second heading. The sidebar header holds the AGENCY wordmark (Azonix) with “OS” in Candy Cane. The product is named **AgencyOS** in the UI (sidebar, sign-in, 404); the code, repos and storage keys still say infynix.
- **Mobile:** the sidebar becomes a 280px drawer with a scrim and a close button; no off-canvas hover states.

### Drawers & Dialogs
- **Drawer:** 440px wide sheet from the right, paper, Dialog shadow, header with a recessed tab control and Close at the right, then a scrollable canvas body and a pinned footer. The Details tab pins Deactivate/Edit/Delete there; the Permissions tab swaps them for its Save access action. Destructive actions sit left; primary on the right.
- **Dialog:** 420px default width, 12px radius, Dialog shadow, title 16px/600, description body-lg ink-2, actions right-aligned. Use `<dialog>` and native focus behaviour.
- **Alert dialog:** destructive confirmations (sign out, delete user, delete client) use the compact width by default: 24px side gutters, a 20rem cap and a 14px/600 title on phones, widening to the standard dialog at `sm`. Every confirmation shares this so none look oversized on mobile.

### Empty state
- **Shape:** one 40px paper icon tile with Lift, a 16px/600 heading 16px below, and one body sentence in ink-2. Centred, max 24rem wide, no card around it.
- **Rule:** say what belongs here and what will happen, in the product's language. Never "Nothing here" and never a fake action.

### Access checklist
- **Shape:** a paper panel with the same header strip as every other panel; one divided row per menu, 40px tall, with a native checkbox (16px, ink-green accent) and a 14px label.
- **Footer:** a caption count ("3 of 7 menus") on the left and a small primary Save button on the right; the count is an `aria-live` status and appends "· Saved" after a successful save.
- **Owner:** no checkboxes; a shield icon and one sentence ("Owners can open every menu."). The owner is never listed as a toggle.

### Loader
- Four ink-green bars that grow in turn, 6px wide, 23px tall, 5px apart, 1s ease-in-out with a 0.15s stagger. One loader, used wherever content is pending.

## Do's and Don'ts

### Do:
- **Do** read values from `src/styles/tokens.css`; use the generated Tailwind utilities (`bg-surface`, `text-ink-2`, `shadow-lift`, `ease-out-expo`) rather than raw hex.
- **Do** keep the accent rare: primary action, active navigation, role, focus, selection.
- **Do** use hairlines and warm shadows to separate surfaces; let the paper do the work.
- **Do** give every new handled card (actions, board items, reorderable rows) the Raised surface via `card-3d`, so the whole product shares one subtle 3D language with its buttons.
- **Do** write sentence-case labels that name the action ("Save access", "Try again") and errors that name the problem and the recovery.
- **Do** show hover, focus, disabled, loading and empty states for every control you add.
- **Do** use `tabular-nums` for dates, counts and anything compared in a column.

### Don't:
- **Don't** add a second accent, a gradient text fill, glass, or decorative blur.
- **Don't** use pure white or pure black; the palette stays warm in both themes.
- **Don't** put a shadow on a flat row, a nav item or an input; Lift belongs to panels, Raised to handled cards, Dialog to overlays, Well to segmented controls.
- **Don't** hand-roll a 3D card with your own gradient or shadow, stack a `ring-*` on a raised card, or make the bevel louder; use `card-3d` as it is.
- **Don't** sink containers into the page (inset trays, recessed columns); only segmented controls go inward.
- **Don't** use pills for containers or circles for avatars; dots are the only circles.
- **Don't** use all-caps or a display face for labels, buttons or data.
- **Don't** introduce a modal for an inline task, or a card for every block on the page.
