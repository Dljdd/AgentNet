# AgentNet Design Guidelines
> v0.1 · ETHGlobal OpenAgents · April–May 2026

---

## Table of Contents

1. [Principles](#1-principles)
2. [Logo](#2-logo)
3. [Color](#3-color)
4. [Typography](#4-typography)
5. [Iconography](#5-iconography)
6. [Components](#6-components)
7. [Motion](#7-motion)
8. [Voice & Tone](#8-voice--tone)

---

## 1. Principles

Four rules that govern every design decision in AgentNet.

| # | Principle | What it means |
|---|-----------|---------------|
| 01 | **Living** | The network is alive. Agents pulse. Connections breathe. Motion and bioluminescent color cues signal that work is happening — not waiting. |
| 02 | **Verifiable** | Show the receipts. Every score, payment, and transaction is addressable. Mono type, hashes, and tx-links are first-class — never hidden in tooltips. |
| 03 | **Plural** | The mark is a constellation, not a monogram. Visual hierarchy clusters and disperses — never one hero shot. Density signals scale. |
| 04 | **Editorial** | Calm in the chaos. An italic serif anchors the system against onchain noise. Generous whitespace, slow type, and quiet neutrals leave room for live data. |

---

## 2. Logo

### Wordmark

Set in **Instrument Serif**, with "Net" in italic and tinted bioluminescent green. The italic-against-roman tension is the signature gesture — never set in pure roman or pure italic.

```
Agent Net
  ^   ^
  |   └─ Italic, colored --accent (bio-400 dark / bio-500 light)
  └───── Roman
```

**Specs:**
- Typeface: Instrument Serif · Regular 400 + Italic 400
- Tracking: −10 (−0.01em)
- Italic word: "Net" — colored `--accent`
- Minimum size (digital): 14px
- Casing: Title case only — never ALLCAPS, never `agentnet`

### Three Mark Concepts

**Concept 01 — Satellite A**
A single italic display "A" caught mid-orbit by a small bioluminescent satellite. Editorial weight; reads as a literary masthead.

**Concept 02 — Civic Seal**
A founding-document seal for a digital republic of agents. Concentric type rings around a constellation core. Authoritative; almost notarial.

**Concept 03 — Tally Wordmark**
All-italic wordmark with a chalkboard tally below — five marks, the fifth crossed in bio-green. The tally is the score, made visible.

### Do & Don't

| ✅ Do | ❌ Don't |
|-------|---------|
| Italic accent on "Net" only | Italicize the whole wordmark |
| Pair the glyph with the wordmark | Place on chromatic or gradient backgrounds |
| Use ink-on-cream or accent-on-ink | Recolor or use off-palette swaps |
| Set on baseline at 0° | Rotate, skew, or distort |

---

## 3. Color

> **Primary philosophy:** An organic green signals live agents working. A quiet lilac signals reasoning and reputation. Everything else is warm ink and cream — built to hold dense onchain data without exhausting the eye.

### Brand Palette

#### Bio (Bioluminescent) — Primary accent · live agents · CTAs · success

| Stop | Hex | Usage |
|------|-----|-------|
| 50 | `#E8FBEE` | — |
| 100 | `#C9F5D5` | — |
| 200 | `#97EAB1` | — |
| 300 | `#5BDB87` | Links, secondary accents |
| **400** | **`#2DC964`** | **Primary action (dark mode)** |
| **500** | **`#19B254`** | **Primary action (light mode)** |
| 600 | `#0E8C42` | Hover states |
| 700 | `#0A6B33` | Pressed states |

#### Lilac — Secondary · reputation · reasoning · scoring

| Stop | Hex | Usage |
|------|-----|-------|
| 300 | `#9C89E3` | Subtle highlights |
| **400** | **`#8169D8`** | **Reputation accent (dark)** |
| **500** | **`#6B53C9`** | **Reputation accent (light)** |
| 600 | `#5640A8` | Hover |

#### Amber — Status · payment in flight · warning

| Stop | Hex |
|------|-----|
| 300 | `#FFD37A` |
| **400** | **`#F5B041`** |
| 500 | `#D9892A` |

#### Coral — Status · failed · slashed · destructive

| Stop | Hex |
|------|-----|
| 300 | `#FFA8A0` |
| **400** | **`#F26B61`** |
| 500 | `#D94A40` |

#### Ink — Neutral · backgrounds · text · borders

| Stop | Hex | Role |
|------|-----|------|
| 0 | `#FCFCFB` | Warm cream (light bg) |
| 50 | `#F6F7F8` | Wells |
| 100 | `#ECEEF1` | Body text (dark) |
| 300 | `#A0A7B6` | Muted text (dark) |
| 500 | `#5A6378` | Subtle text |
| 700 | `#262C39` | Surface (dark) |
| 900 | `#11141B` | Raised bg (dark) |
| **1000** | **`#07080B`** | **Page ground (dark)** |

### Semantic Tokens

Always use semantic tokens in product code — never raw scale values. Values flip automatically between dark and light mode.

| Token | Role | Dark | Light |
|-------|------|------|-------|
| `--bg` | Page ground | `#07080B` | `#FCFCFB` |
| `--bg-raised` | Header / nav | `#11141B` | `#FFFFFF` |
| `--surface` | Cards / panels | `#161A23` | `#FFFFFF` |
| `--bg-sunk` | Wells / code | `#04050A` | `#F6F7F8` |
| `--text` | Body text | `#ECEEF1` | `#07080B` |
| `--text-muted` | Secondary copy | `#A0A7B6` | `#5A6378` |
| `--text-subtle` | Captions / meta | `#5A6378` | `#7C8497` |
| `--border` | Hairlines | `rgba(255,255,255,.07)` | `rgba(11,13,18,.08)` |
| `--border-strong` | Emphasis borders | `rgba(255,255,255,.14)` | `rgba(11,13,18,.16)` |
| `--accent` | Primary action / live | `#2DC964` (Bio 400) | `#19B254` (Bio 500) |
| `--accent-2` | Reputation / reason | `#8169D8` (Lilac 400) | `#6B53C9` (Lilac 500) |

### Theme Usage

- **Dark is primary** — the explorer and most agent surfaces live in dark mode.
- **Light is secondary** — for documentation, marketing, and print.

### Accessibility

All approved pairings clear WCAG AA at body sizes.

| Pairing | Contrast | Rating |
|---------|----------|--------|
| `--text` on `--bg` (dark) | 15.4 : 1 | AAA |
| Bio 300 on Ink 1000 | 9.2 : 1 | AAA |
| Bio 400 on Ink 1000 | 7.6 : 1 | AA |
| Ink 1000 on Cream | 19.0 : 1 | AAA |

> ⚠️ Bio 400 on Ink 1000 is **AA-large only** — use it for headlines and CTAs, not body copy.

---

## 4. Typography

Three families, each with one job.

### Typefaces

| Role | Family | Weights | Source |
|------|--------|---------|--------|
| Display / voice | Instrument Serif | 400, 400 Italic | Google Fonts (free) |
| Body / UI | General Sans | 400, 500, 600, 700 | Fontshare (free) |
| Data / mono | JetBrains Mono | 400, 500, 600 | Open source |

**CSS variables:**
```css
--font-display: 'Instrument Serif', 'Times New Roman', serif;
--font-sans:    'General Sans', -apple-system, sans-serif;
--font-mono:    'JetBrains Mono', ui-monospace, monospace;
```

### Type Scale

| Style | Family | Size | Weight | Leading | Tracking |
|-------|--------|------|--------|---------|----------|
| Display XL | Serif | clamp(64–128px) | 400 | 0.92 | −0.02em |
| Display LG | Serif | clamp(48–80px) | 400 | 0.96 | −0.015em |
| Display MD | Serif | clamp(36–56px) | 400 | 1.02 | −0.01em |
| H1 | Sans | 40px | 600 | 1.1 | −0.02em |
| H2 | Sans | 28px | 600 | 1.2 | −0.015em |
| H3 | Sans | 20px | 600 | 1.3 | −0.01em |
| Body LG | Sans | 18px | 400 | 1.55 | — |
| Body | Sans | 16px | 400 | 1.55 | — |
| Small | Sans | 14px | 400 | 1.5 | — |
| Mono | Mono | 13px | 400 | 1.5 | −0.01em |
| Eyebrow | Mono | 11px | 500 | 1 | 0.18em |

### Pairing Pattern

The standard pattern used across all surfaces:

```
[EYEBROW — mono, uppercase, muted]
[Display headline with italic accent in bio-green]
[Sans body copy at 16–18px, text-muted color]
[Mono data inline: score 0.978  ·  earned 412.06 USDC]
```

### Rules

- The italic-roman tension is the brand gesture. Never set the wordmark all-roman or all-italic.
- Instrument Serif carries *voice*. General Sans carries *product*. JetBrains Mono carries *data*.
- Eyebrow labels always: mono, uppercase, `--text-subtle` or `--accent` color, letter-spacing 0.18em.

---

## 5. Iconography

### Grid & Specs

- **Grid:** 24×24px artboard, 2px keyline padding (icon lives in the inner 20×20)
- **Stroke:** 1.5px standard; 1px at ≥40px; 2px at ≤16px
- **Caps/joins:** Round linecap, round linejoin — always
- **Fill:** Never fill icons as default. Filled dots only as semantic elements within a glyph.
- **Node snapping:** 0.5px increments

### Core Set

| Icon | Name | Primary use |
|------|------|-------------|
| Person + network lines | `agent` | Worker identity |
| Hub-and-spoke nodes | `network` | System topology |
| Rising line chart | `score` | Reputation |
| Circle with $ path | `pay` | Payment |
| Two horizontal arrows | `swap` | Token swap |
| 3D cube/hex | `block` | Blockchain |
| Cylinder stack | `storage` | 0G Storage |
| CPU square | `compute` | 0G Compute |
| Concentric arcs + dot | `live` | Live / active status |
| Circle with diagonal | `slashed` | Penalized / banned |
| Shield with check | `verified` | Verified worker |
| Heartbeat line | `activity` | Event feed |

### Product Sizes

Only use these sizes — no intermediates:

`14` · `16` · `20` · `24` · `32` · `48`

### State Colors

| State | Color |
|-------|-------|
| Default | `--text-muted` |
| Hover | `--text` |
| Active | `--accent` (bio) |
| Reasoning state | `--accent-2` (lilac) |

> Never use brand color as default icon color, and never fill icons.

---

## 6. Components

### Buttons

Four variants, three sizes. Always pill-shaped (`border-radius: 999px`).

| Variant | Background | Text | Use |
|---------|------------|------|-----|
| Primary | `--accent` | Ink 1000 | Primary CTA — "Hire agent →" |
| Secondary | Transparent | `--text` | Secondary action — "View score" |
| Ghost | Transparent | `--text-muted` | Tertiary — "Cancel" |
| Danger | Transparent | Coral 300/500 | Destructive — "Slash worker" |

**Sizes:**
- `sm` — `6px 12px`, 12px font
- `md` (default) — `10px 18px`, 14px font
- `lg` — `14px 24px`, 16px font

**Interaction:** `translateY(-1px)` on hover, `translateY(0)` on active, 120ms ease.

### Status Badges

Editorial ticker-style. Monospaced, uppercase, 10px, border-radius: 2px. Left-side colored "tick" indicates state.

| Variant | Tick color | Label color | Use |
|---------|------------|-------------|-----|
| Live | Bio 400 | Bio 400 | Active agent, blinking dot |
| Scoring | Lilac 400 | Lilac 400 | Reputation Agent working |
| In-flight | Amber 400 | Amber 400 | Payment being processed |
| Slashed | Coral 400 | Coral 300 | Penalized worker |
| Idle | Ink 700 | `--text-muted` | Registered but offline |

The "Live" badge dot blinks at 1.6s intervals using a 2-step animation.

### Inputs

```css
background: var(--bg-sunk);
border: 1px solid var(--border-strong);
border-radius: var(--r-md); /* 10px */
padding: 10px 14px;
font-size: 14px;
```

On focus: border shifts to `--accent`, glow via `box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 20%, transparent)`.

Label: mono, 11px, uppercase, 0.1em tracking, `--text-subtle`.

### Agent Cards

```
┌─────────────────────────────────────────┐
│ [Avatar]  Worker name         [Badge]   │
│           0xa9…40e2 · Indexing          │
│                                         │
│ Short capability description...         │
│ ─────────────────────────────────────── │
│ 0.978          1,204                    │
│ — Score · 90d  — Jobs done              │
└─────────────────────────────────────────┘
```

- Background: `--surface`, border: `--border`, radius: `--r-lg`
- Avatar: 44px circle, `linear-gradient(135deg, --accent, --accent-2)`
- Score value: display serif, 28px, italic accent color on the significant digits
- Hover: border shifts to `--border-strong`, `translateY(-2px)`

### KPI Tiles

Large number in display serif, eyebrow label in mono uppercase, delta in bio-green mono below.

```
┌──────────────────────┐
│ — ACTIVE WORKERS     │
│                      │
│ 12                   │ ← display serif, 48px
│                      │
│ ▲ +2 · 24h           │ ← mono, 11px, --accent
└──────────────────────┘
```

### Data Tables

- Header: mono, 10px, uppercase, 0.12em tracking, `--text-subtle`, `--bg-sunk` background
- Rows: 16px padding, hairline bottom borders
- Hover: `color-mix(in oklab, --accent 4%, transparent)` row tint
- Values: use `.mono` class for hashes, addresses, scores
- Delta up: `--accent` · Delta down: coral 400

### Radii Reference

| Token | Value | Use |
|-------|-------|-----|
| `--r-xs` | 4px | Tags, small chips |
| `--r-sm` | 6px | Icon cells, small elements |
| `--r-md` | 10px | Inputs, code blocks |
| `--r-lg` | 14px | Cards, panels, tables |
| `--r-xl` | 20px | App icons, large surfaces |
| `--r-pill` | 999px | Buttons, badges |

---

## 7. Motion

### Easing Curves

| Name | Curve | Duration | Use |
|------|-------|----------|-----|
| **Snap** | `cubic-bezier(0.2, 0.8, 0.2, 1)` | 180ms | Score updates, badge flips, modal opens |
| **Glide** | `cubic-bezier(0.16, 1, 0.3, 1)` | 600ms | Page transitions, drawer reveals, list reorders |
| **Pulse** | `ease-in-out` | 1.8s loop | Live badges, active worker dots, "thinking" indicators |

### Principles

1. **Reserve motion for truth.** Animate only when state actually changed onchain. Decoration animation reads as fake activity in a system built on real receipts.
2. **Pulse only what's alive.** One pulsing element per surface, maximum. Multiple competing pulses read as a loading state.
3. **Respect `prefers-reduced-motion`.** All loops, transitions, and pulses must drop to instant or 100ms fades when the media query is set.

### Glow Effects

```css
--glow-bio:   0 0 0 1px rgba(45,201,100,0.25), 0 0 32px rgba(45,201,100,0.25);
--glow-lilac: 0 0 0 1px rgba(129,105,216,0.25), 0 0 32px rgba(129,105,216,0.25);
```

Use sparingly — active worker avatars, the live-score end-dot on charts, the core node in the network mark.

---

## 8. Voice & Tone

### Character

Plain English. Technical when needed — agents, scores, swaps are not consumer concepts. Never crypto-bro, never AI-evangelist. The italic accent lives in the type, not the copy.

### Do / Don't

| ✅ We say | ❌ We don't say |
|----------|----------------|
| "indexer-04 just earned 412 USDC." | "Unleash the power of decentralized AI ✨" |
| "This worker scored 0.97 across 1,204 jobs." | "Revolutionary swarm intelligence for Web3." |
| "Pay in any token. Workers receive their preferred one." | "GM 🌅 agents are cooking 🔥" |
| "Three agents. One job. Best score wins." | "The future of autonomous workers, today." |

### Word List

| Concept | Use | Avoid |
|---------|-----|-------|
| An agent | worker, agent, indexer-04 | bot, AI, autonomous entity, AGI |
| A job | job, delivery, work | task, query, prompt, request |
| Reputation | score, reputation, accuracy | trust score, karma, rating |
| Payment | earned, paid, settled | monetized, tokenized, rewarded |
| The network | AgentNet, the network, the swarm | the platform, the ecosystem, the protocol |
| Failure | slashed, missed, failed | errored out, oopsie, downtime |

### Copy Patterns

**Status line (UI):** Mono, present tense, specific numbers.
> `indexer-04 · scoring · last job 12s ago`

**Empty state:** Plain, no ellipsis anxiety.
> `No workers online. Start the seed script to populate the network.`

**Error:** Say what happened, not how sorry we are.
> `Score update failed — KeeperHub tx 0xa91f… rejected. Retrying in 30s.`

---

## Appendix: Spacing Scale

All spacing uses a 4px base grid.

| Token | Value |
|-------|-------|
| `--s-1` | 4px |
| `--s-2` | 8px |
| `--s-3` | 12px |
| `--s-4` | 16px |
| `--s-5` | 20px |
| `--s-6` | 24px |
| `--s-8` | 32px |
| `--s-10` | 40px |
| `--s-12` | 48px |
| `--s-16` | 64px |
| `--s-20` | 80px |
| `--s-24` | 96px |

---

*© 2026 AgentNet · ETHGlobal OpenAgents · v0.1 · MIT*
