# Light-Mode Color Palette

## Purpose

This document records the current light-mode colors and their use across the Priority Handling Logistics performance evaluation system. The theme tokens are defined in `src/styles.css`; component-specific behavior is implemented in the UI primitives and shared components.

## Brand Colors

| Name | Hex | Intended use |
| --- | --- | --- |
| Primary brand blue | `#0000FE` | Logo mark, primary actions, selected navigation, table headers, and focus indicators |
| Brand navy | `#080B3D` | Primary text, headings, and high-emphasis content |
| Supporting blue | `#3B82F6` | Secondary brand accents and chart data |
| Soft brand background | `#F8FAFC` | Main application background |
| White | `#FFFFFF` | Logo contrast, surfaces, and foreground text on primary controls |

The application sidebar displays the logo from `public/logo-optimized.webp` alongside the organization name.

## Core Interface Tokens

| Token | Hex | Application role |
| --- | --- | --- |
| `--background` | `#F8FAFC` | Main page background |
| `--foreground` | `#080B3D` | Default text color |
| `--surface` | `#FFFFFF` | Standard surfaces, including form controls |
| `--surface-elevated` | `#FFFFFF` | Elevated surfaces |
| `--surface-muted` | `#F1F5F9` | Muted surfaces, selected rows, and hover backgrounds |
| `--card` | `#FFFFFF` | Card background |
| `--popover` | `#FFFFFF` | Popover and menu background |
| `--muted` | `#F1F5F9` | Muted backgrounds |
| `--muted-foreground` | `#475569` | Supporting text and placeholders |
| `--secondary` | `#EFF6FF` | Secondary control background |
| `--secondary-foreground` | `#080B3D` | Text on secondary controls |
| `--accent` | `#EFF6FF` | Hover and active accent background |
| `--accent-foreground` | `#0000FE` | Text and icons on accent backgrounds |
| `--border` | `#E2E8F0` | Standard borders and separators |
| `--border-subtle` | `#F1F5F9` | Low-emphasis borders |
| `--input` | `#E2E8F0` | Form-control borders |
| `--ring` | `#0000FE` | Keyboard focus ring |

## Buttons

The shared button component supports the following variants:

| Variant | Light-mode appearance |
| --- | --- |
| Default | `#0000FE` background with `#FFFFFF` text; hover applies 90% opacity to the primary background |
| Destructive | `#DC2626` background with `#FFFFFF` text; hover applies 90% opacity |
| Outline | `#FFFFFF` background with `#E2E8F0` border; hover uses the accent background and foreground |
| Secondary | `#EFF6FF` background with `#080B3D` text; hover applies 80% opacity |
| Ghost | Transparent background; hover uses the accent background and foreground |
| Link | Primary blue text with an underline on hover |

Buttons use the primary ring color for keyboard focus. Disabled controls reduce opacity and do not respond to pointer events.

## Tables

| Table element | Light-mode appearance |
| --- | --- |
| Header | `#0000FE` background and `#FFFFFF` text |
| Body | Inherits the containing surface, typically `#FFFFFF` |
| Row divider | Standard border color, `#E2E8F0` |
| Hovered row | Muted background, `#F1F5F9` at 50% opacity |
| Selected row | Muted background, `#F1F5F9` |
| Footer | Muted background, `#F1F5F9` at 50% opacity |
| Caption | Muted text, `#475569` |

The shared table primitive does not apply alternating row colors by default. Individual tables may add additional classes for their specific workflow.

## Sidebar

| Sidebar element | Light-mode appearance |
| --- | --- |
| Background | `#FFFFFF` |
| Default text and icons | `#080B3D` |
| Primary controls | `#0000FE` background with `#FFFFFF` foreground |
| Active and hovered navigation | `#EFF6FF` background with `#0000FE` foreground |
| Section labels | Sidebar foreground at 70% opacity |
| Dividers | `#E2E8F0` |
| Focus ring | `#0000FE` |

## Semantic Colors

| Meaning | Hex | Foreground |
| --- | --- | --- |
| Destructive | `#DC2626` | `#FFFFFF` |
| Error | `#DC2626` | `#FFFFFF` |
| Success | `#059669` | `#FFFFFF` |
| Warning | `#D97706` | `#FFFFFF` |
| Information | `#2563EB` | `#FFFFFF` |

Evaluation and cycle status badges also use translucent Tailwind color families. Evaluation statuses include sky, violet, cyan, fuchsia, rose, and emerald; cycle statuses include emerald, amber, and destructive red. These badge colors are component styles rather than named global palette tokens.

## Charts

The default chart color sequence is:

| Chart token | Hex |
| --- | --- |
| `--chart-1` | `#0000FE` |
| `--chart-2` | `#3B82F6` |
| `--chart-3` | `#080B3D` |
| `--chart-4` | `#059669` |
| `--chart-5` | `#D97706` |

## Typography And Shape

- Body text uses Atkinson Hyperlegible.
- Headings use Source Sans 3, with Atkinson Hyperlegible as a fallback.
- The base corner radius is `0.625rem` (10 px); smaller and larger radius tokens are derived from it.

## Implementation Notes

- The primary hover and active tokens are `--primary-hover: #0000D4` and `--primary-active: #0000AA`. The shared button's default variant currently uses `bg-primary/90` for hover and does not reference those named tokens.
- The table header uses the primary color in light mode. Its dark-mode override changes to a muted surface.
- Sidebar, button, and table primitives may be further customized by classes at individual call sites.

## Source Files

- `src/styles.css`
- `src/components/ui/button.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/shared/shared-ui.tsx`
- `src/components/layout/app-shell.tsx`
- `public/logo-optimized.webp`