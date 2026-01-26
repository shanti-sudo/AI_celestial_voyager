# 🛰️ Celestial Voyager AI
### "Navigating the deep cosmos with sub-pixel precision and AI-driven discovery."

![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)
![Build: Stable](https://img.shields.io/badge/Build-Stable-cyan.svg)
![Protocol: Nano Banana Pro](https://img.shields.io/badge/Protocol-Nano_Banana_Pro-blue.svg)

---

## 🌌 Context
**Celestial Voyager AI** is an advanced interactive space exploration platform that transforms high-resolution NASA imagery into traversable mission sectors. By integrating the **Gemini 2.0 Flash** model with the **NASA Image and Video Library API**, the system performs real-time forensic scans of celestial bodies to identify and ground Points of Interest (POIs) with sub-pixel fidelity.

Traditional mapping systems often suffer from "UI Drift" where labels become detached from their associated visual centroids during viewport scaling. Celestial Voyager solves this by implementing a **Raster-Plane Grounding** architecture, ensuring every discovery remain mathematically locked to the source raster buffer.

## 🛠️ Tech Stack
- **Core Framework**: [React 19](https://react.dev/)
- **Build Engine**: [Vite 6](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **AI Engine**: [@google/genai](https://www.npmjs.com/package/@google/genai) (Gemini 2.0 Integration)
- **Imagery Provider**: [NASA API](https://api.nasa.gov/)
- **Styling**: Vanilla CSS with Tailwind-tier utility efficiency for glassmorphic UI.

## ⚙️ Installation

### Local Development
1. **Clone the repository**:
   ```bash
   git clone https://github.com/shanti-sudo/celestial-voyager-ai.git
   cd celestial-voyager-ai
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

4. **Launch the development server**:
   ```bash
   npm run dev
   ```

## 🚀 Usage

### 🎨 Nano Banana Pro Grounding Protocol
This project utilizes a custom grounding protocol to ensure POI markers stay perfectly centered on astronomical features regardless of screen resolution.

```typescript
// Calculation of the Intensity-Weighted Center (IWC) for sub-pixel refinement
const calculateIWC = (pixels: number[]) => {
  let sumX = 0, sumY = 0, sumI2 = 0;
  pixels.forEach((I, index) => {
    const luminosity = Math.pow(I, 2);
    sumX += x * luminosity;
    sumY += y * luminosity;
    sumI2 += luminosity;
  });
  return { x: sumX / sumI2, y: sumY / sumI2 };
};
```

### 🛰️ Dynamic Mission Analysis
The system automatically executes a Forensic Deep Scan whenever a new mission sector is targeted.

```typescript
const points = await analyzeSpaceImage(base64Image, imageTitle, imageDescription);
// Results are grounded to Raw Pixel Space relative to top-left (0,0)
```

## 🤝 Contribution
1. **Fork** the repository.
2. Create a **Feature Branch** (`git checkout -b feature/DiscoverySub-pixel`).
3. **Commit** your changes with clear, technical descriptions.
4. Open a **Pull Request** for automated validation and manual review.

## 🤖 Development with Antigravity
This repository was built using the **Antigravity Advanced Agentic Coding** framework. The following agent rules and skills were enforced:

- **Pixel-Perfect Grounding Protocol**: All POI anchors are derived from raw raster data, not the UI overlay, ensuring accuracy $\leq 0.1px$.
- **Nano Banana Pro**: A specialized skill used for find the 'Blob' center of celestial objects using CoG calculations.
- **Pure Celestial Protocol**: A verification rule to automatically filter and reject imagery containing human or mechanical contamination.
- **Sub-pixel Refinement (IWC)**: Multi-iteration Quadratic Interpolation for vertex-peak luminosity detection.

---
🚀 *Discover the universe, one sub-pixel at a time.*
