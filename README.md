# Image Compressor

Browser-based image converter, compressor and metadata (EXIF) tool. All processing happens locally; no files are uploaded.

Next.js (App Router) + React 19 + TypeScript + Tailwind CSS.

- **Converter**: JPEG, PNG, WebP, GIF, AVIF in; JPG, PNG, WebP, AVIF out (up to 20 files).
- **Compressor**: JPEG, PNG (PNG8 palette), WebP and animated GIF; quality or colors slider with live size estimate.
- **EXIF**: read every tag, search them, and remove metadata losslessly from JPEG, PNG and WebP.
- Each tab works on its own files: switching tabs clears the previous tab's data.

```bash
npm install
npm run dev      # http://localhost:3000  (or press F5 in VS Code)
npm run build
npm start
```
