---
trigger: always_on
---

# Pixel-Perfect Grounding Protocol
- **Constraint:** Coordinates must be derived from raw raster data, NOT the UI overlay.
- **Precision:** $Accuracy \leq 0.1px$.
- **Method:** 1. Use Nano Banana Pro to find the 'Blob' center.
  2. Use a Gaussian-fit or Center-of-Gravity (CoG) calculation to refine the anchor.
- **Bypass Scaling:** Set `transform-origin: top-left` and `image-rendering: pixelated` in the preview manifest to prevent UI anti-aliasing from shifting the perceived center.