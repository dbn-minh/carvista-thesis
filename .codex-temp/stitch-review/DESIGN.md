# Design System Specification: Editorial Velocity

## 1. Overview & Creative North Star
The automotive marketplace is often cluttered, loud, and transactional. This design system rejects the "commodity" look in favor of a **"Cinematic Editorial"** North Star. We are moving beyond a simple car search tool to create a high-end digital showroom that feels as premium as the vehicles it hosts.

The design breaks traditional grid rigidity through **Intentional Asymmetry**. Large-scale typography overlaps high-definition imagery, and content "breathes" through expansive vertical whitespace. The goal is to create an experience that feels fast, curated, and authoritative—leveraging tonal depth rather than structural lines to guide the user’s eye.

---

## 2. Colors & Tonal Depth

### The Palette
We utilize a sophisticated Material 3-inspired palette rooted in deep charcoal and electric accents.
- **Base:** `surface` (#101413) and `background` (#101413) provide a seamless, ink-like canvas.
- **Accents:** `primary` (#c5f6ff) and `secondary` (#dab9ff) are used sparingly for high-impact CTAs and interactive highlights.
- **Depth:** `surface_container` tiers (#1c201f to #323634) drive the hierarchy.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. We define boundaries through background color shifts. A section intended to stand out should move from `surface` to `surface_container_low`. This creates a smoother, more premium transition that feels integrated rather than partitioned.

### Surface Hierarchy & Nesting
Treat the UI as physical layers. An automotive card (`surface_container_high`) should sit atop a search results area (`surface_container_low`), which in turn sits on the global `background`. This "nested" depth mimics high-end interior car lighting.

### The "Glass & Gradient" Rule
For floating elements like "Quick View" modals or navigation bars, use **Glassmorphism**:
- **Background:** `surface` at 70% opacity.
- **Backdrop-blur:** 20px–30px.
- **Signature Gradient:** Use a subtle linear gradient on primary CTAs (`primary` to `primary_container`) to give buttons a tactile, metallic sheen reflective of automotive paint.

---

## 3. Typography
The typographic voice is modern, technical, and confident.

- **Display & Headlines (Space Grotesk):** This geometric sans-serif communicates speed and precision. Use `display-lg` (3.5rem) for hero statements, allowing them to overlap image containers for an editorial feel.
- **Body & Labels (Inter):** Chosen for its exceptional readability at small sizes. `body-md` (0.875rem) is our workhorse for vehicle specifications.
- **Hierarchy as Brand:** Use extreme contrast in scale. A `display-md` headline paired with a `label-sm` technical spec creates an "architectural" layout that signals premium quality.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved via **Tonal Layering**. Instead of drop shadows on every card, use the `surface_container` tokens.
- **Lowest Priority:** `surface_container_lowest` (#0b0f0e)
- **Base Surface:** `surface` (#101413)
- **High Priority (Cards):** `surface_container_high` (#272b2a)

### Ambient Shadows
When an element must float (e.g., a "Compare" drawer), use an **Ambient Shadow**:
- **Blur:** 40px–60px.
- **Opacity:** 4%–8%.
- **Color:** Use `on_surface` (light) rather than black to create a "glow" effect that feels like light catching an edge.

### The "Ghost Border" Fallback
If a boundary is required for accessibility, use a **Ghost Border**:
- **Token:** `outline_variant` (#3b494c).
- **Opacity:** 15%.
- **Rule:** Never use a 100% opaque border.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill from `primary` to `primary_container`. Roundedness: `full` (9999px) to mimic the sleek curves of a chassis.
- **Secondary:** Ghost style. Transparent fill with a `Ghost Border` and `primary` text.
- **Tertiary:** `on_surface` text with no container; underlines only appear on hover.

### Cards (The "Showroom" Card)
- **Styling:** Forbid divider lines. Use 24px padding (`xl` spacing) to separate the car image from the price.
- **Background:** `surface_container_low`. 
- **Interaction:** On hover, the card should transition to `surface_container_highest` and scale by 1.02% with a smooth 300ms cubic-bezier transition.

### Input Fields
- **Container:** `surface_container_highest`. 
- **Shape:** `md` (0.375rem).
- **State:** On focus, the `outline` token transitions from 15% opacity to 100% `primary`.

### Selection Chips
- **Context:** Used for filtering by Make, Model, or Price.
- **Style:** `surface_container_high` background. When selected, the chip glows with a `primary` drop-shadow (low opacity) and `on_primary_container` text.

### Visual Imagery Component
- **Rule:** Every car image must feature a subtle "vignette" gradient overlay on the bottom 20% to ensure that overlaying white `label-md` text remains legible without requiring a solid text box.

---

## 6. Do’s and Don’ts

### Do
- **Do** use whitespace as a functional tool. If content feels crowded, increase the vertical gap rather than adding a divider line.
- **Do** use `spaceGrotesk` for all numerical data (prices, mileage). The geometric nature of the font makes numbers feel like high-performance instrumentation.
- **Do** ensure "Glassmorphism" is only used over rich, high-quality imagery to maximize the blur effect.

### Don’t
- **Don't** use pure black (#000000) for backgrounds. It kills the "tonal" depth. Stick to `surface` (#101413).
- **Don't** use standard Material shadows. They are too "software-like." Follow the Ambient Shadow rule.
- **Don't** align everything to a center axis. Experiment with left-aligned headlines and right-aligned CTA buttons to create dynamic visual tension.
- **Don't** use high-contrast borders. If you can't see the separation through color alone, your tonal hierarchy needs adjustment.