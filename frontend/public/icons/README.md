# PWA Icons

This directory contains the app icons for the Progressive Web App.

## Current Status
- SVG placeholder icons are provided for development
- **Production**: Convert these to PNG format (192x192 and 512x512)

## Conversion Commands
```bash
# Using ImageMagick (if available):
convert icon-192x192.svg -resize 192x192 icon-192x192.png
convert icon-512x512.svg -resize 512x512 icon-512x512.png

# Or use online tools:
# - https://cloudconvert.com/svg-to-png
# - https://svgtopng.com/
```

## Icon Design
- Primary gradient: #667eea → #764ba2
- Background: Rounded rectangle
- Symbol: "PP" (Pod Pal) with circular elements representing players
- Theme: Purple gradient matching app branding
