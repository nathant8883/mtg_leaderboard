# Tailwind CSS v4 Migration Guide

This guide documents the lessons learned from migrating the MTG Leaderboard app from a monolithic `App.css` to Tailwind CSS v4.

## Overview

We're using a **hybrid approach**:
- **Tailwind utilities** for simple styles (padding, margins, colors, flexbox, etc.)
- **Custom CSS classes** for complex/reusable patterns (gradients, tier system, MTG-specific styling)
- **CSS variables** for design tokens (like `--tier-color`)

## Setup & Configuration

### Installation
```bash
npm install tailwindcss @tailwindcss/vite --legacy-peer-deps
```

Note: `--legacy-peer-deps` is needed for Vite 7 compatibility.

### Vite Configuration (`vite.config.ts`)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // ... rest of config
})
```

### CSS Entry Point (`src/index.css`)

**Tailwind v4 uses CSS-first configuration** (no `tailwind.config.js`):

```css
@import "tailwindcss";

@layer base {
  /* Base styles - won't override Tailwind utilities */
  * {
    box-sizing: border-box;
  }

  :root {
    --accent-cyan: #33D9B2;
    --accent-purple: #667eea;
  }

  /* ... other base styles */
}

@layer components {
  /* Custom component classes */
  .bg-gradient-card {
    background: linear-gradient(135deg, #1A1B1E 0%, #1C1D21 100%);
  }

  .s-tier {
    --tier-color: #FFD700;
    --tier-color-light: #FFA500;
  }

  .text-tier-s {
    color: #FFD700;
  }

  /* ... other custom classes */
}
```

## Critical Issues & Solutions

### Issue 1: CSS Cascade Override ⚠️

**Problem:** Universal CSS resets (`* { margin: 0; padding: 0; }`) in files loaded AFTER `index.css` will override ALL Tailwind utilities.

**Solution:**
1. Remove duplicate base styles from `App.css`
2. Consolidate all base styles in `index.css` wrapped in `@layer base`
3. Never use universal resets outside of layered CSS

**Before (WRONG):**
```css
/* App.css - loaded after index.css */
* {
  margin: 0;
  padding: 0;
}
```

**After (CORRECT):**
```css
/* index.css */
@layer base {
  * {
    box-sizing: border-box;
  }
}
```

### Issue 2: Undefined Custom Color Classes

**Problem:** Classes like `border-card-border` don't exist in Tailwind by default.

**Solution:** Use arbitrary values with `[]` syntax:
```tsx
// Instead of: border-card-border
<div className="border-[#2C2E33]">
```

### Issue 3: Invalid Utility Syntax

**Problem:** Classes like `rounded-12` or `rounded-8` aren't valid Tailwind utilities.

**Solution:** Use arbitrary values:
```tsx
// Instead of: rounded-12
<div className="rounded-[12px]">

// Instead of: rounded-8
<div className="rounded-[8px]">
```

## Migration Process

### Step 1: Read the Original Component
Understand the current styling by reading both the TSX file and the relevant CSS in `App.css`.

### Step 2: Identify Custom Classes to Keep
Look for complex patterns that should remain as custom CSS:
- Multi-color gradients
- CSS variables with hover states
- MTG-specific styling (color pips, mana symbols)
- Complex animations

Move these to `@layer components` in `index.css`.

### Step 3: Convert Simple Styles to Tailwind

**Spacing:**
```tsx
// Before (CSS): padding: 24px;
// After (Tailwind): p-6

// Before (CSS): padding: 16px 12px;
// After (Tailwind): py-4 px-3

// Before (CSS): gap: 12px;
// After (Tailwind): gap-3
```

**Colors:**
```tsx
// Before (CSS): color: #fff;
// After (Tailwind): text-white

// Before (CSS): color: #667eea;
// After (Tailwind): text-[#667eea]

// Before (CSS): border: 1px solid #2C2E33;
// After (Tailwind): border border-[#2C2E33]
```

**Layout:**
```tsx
// Before (CSS): display: flex; align-items: center; justify-content: space-between;
// After (Tailwind): flex items-center justify-between
```

**Typography:**
```tsx
// Before (CSS): font-size: 24px; font-weight: 600;
// After (Tailwind): text-2xl font-semibold

// Before (CSS): font-size: 15px; font-weight: 500;
// After (Tailwind): text-[15px] font-medium
```

**Borders & Radius:**
```tsx
// Before (CSS): border-radius: 12px;
// After (Tailwind): rounded-[12px]

// Before (CSS): border-bottom: 1px solid #2C2E33;
// After (Tailwind): border-b border-[#2C2E33]
```

### Step 4: Handle Complex Styles

**CSS Variables:**
Keep these as custom classes with Tailwind utilities:
```tsx
<div className={`inline-flex items-center gap-3 px-3 py-2 rounded-[8px] ${tier.class}`}>
  <div className="w-9 h-9 bg-[linear-gradient(135deg,var(--tier-color),var(--tier-color-light))]">
```

**Conditional Classes:**
Use template literals for dynamic classes:
```tsx
const tier = getWinRateTier(winRate);
<div className={`text-lg font-bold ${tier.color}`}>
  {percentage}%
</div>
```

### Step 5: Test Thoroughly

1. **Visual inspection:** Check the component matches the original design exactly
2. **Check computed styles:** Use Playwright or browser DevTools to verify:
   - Padding/margins are applied correctly
   - Colors are correct (especially tier colors)
   - Border colors are dark, not white
   - Border radius is applied
3. **Test interactions:** Hover states, click handlers, etc.

## Common Patterns

### Rank Badges with Tier Colors
```tsx
const getRankBadgeStyles = (rank: number) => {
  const baseStyles = "inline-flex items-center justify-center w-9 h-9 rounded-[20px] font-bold text-base border";
  if (rank === 1) return `${baseStyles} bg-gradient-gold text-[#1A1B1E] shadow-gold border-[rgba(255,215,0,0.3)]`;
  if (rank === 2) return `${baseStyles} bg-gradient-silver text-[#1A1B1E] shadow-silver border-[rgba(192,192,192,0.3)]`;
  if (rank === 3) return `${baseStyles} bg-gradient-bronze text-white shadow-bronze border-[rgba(205,127,50,0.3)]`;
  return `${baseStyles} bg-card-border text-text-muted border-[rgba(255,255,255,0.15)]`;
};
```

### Tier-Based Text Colors
First, define custom classes in `index.css`:
```css
@layer components {
  .text-tier-s { color: #FFD700; }
  .text-tier-a { color: #33D9B2; }
  .text-tier-b { color: #4FACFE; }
  .text-tier-d { color: #FF6B6B; }
}
```

Then use conditionally:
```tsx
const tier = getWinRateTier(winRate);
<div className={`text-lg font-bold ${tier.color}`}>
  {percentage}%
</div>
```

### Responsive Design
```tsx
{/* Desktop view */}
<div className="hidden md:block">
  <table>...</table>
</div>

{/* Mobile view */}
<div className="flex flex-col gap-3 md:hidden">
  {/* Mobile cards */}
</div>
```

## Best Practices

### ✅ DO:
- Use `@layer base` and `@layer components` to organize custom CSS
- Use arbitrary values `[...]` for exact pixel values or specific colors
- Keep complex gradients and CSS variables as custom classes
- Test with browser DevTools to verify computed styles
- Convert components one at a time

### ❌ DON'T:
- Don't create JavaScript config files for Tailwind v4 (use CSS-first approach)
- Don't use universal resets outside of `@layer base`
- Don't assume utility classes like `rounded-8` exist (use `rounded-[8px]`)
- Don't remove all custom CSS - keep complex patterns as custom classes
- Don't forget to check border colors (they often default to white)

## Checklist for Each Component

- [ ] Read original component and identify custom classes
- [ ] Move complex patterns to `@layer components` in `index.css`
- [ ] Convert simple styles to Tailwind utilities
- [ ] Replace invalid utilities (e.g., `rounded-12` → `rounded-[12px]`)
- [ ] Check all colors are defined (borders, text, backgrounds)
- [ ] Test padding/margin with DevTools
- [ ] Verify tier colors and conditional classes work
- [ ] Test responsive breakpoints
- [ ] Compare final result to original design pixel-perfect

## Example: Full Component Migration

See `/src/components/TopPlayers.tsx` for a complete example of a successfully migrated component.

**Key changes:**
- Replaced `className="card"` with Tailwind utilities
- Kept `.bg-gradient-card`, `.bg-gradient-purple` as custom classes
- Used `border-[#2C2E33]` instead of `border-card-border`
- Used `.text-tier-s`, `.text-tier-a` for dynamic tier colors
- Preserved CSS variable approach for `.s-tier`, `.a-tier`, etc.

## Resources

- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Arbitrary Values](https://tailwindcss.com/docs/adding-custom-styles#using-arbitrary-values)
- [Layers (@layer)](https://tailwindcss.com/docs/adding-custom-styles#using-css-and-layer)
