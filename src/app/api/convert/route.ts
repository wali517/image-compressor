import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const format = ((formData.get('format') as string) || 'avif').toLowerCase();
    const quality = Math.min(100, Math.max(5, Number(formData.get('quality')) || 80));
    const maxColorsStr = formData.get('maxColors') as string | null;
    const maxColors = maxColorsStr ? Math.min(256, Math.max(2, Number(maxColorsStr))) : undefined;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pipeline = sharp(buffer).rotate();
    const initialMeta = await pipeline.metadata();

    let outputBuffer: Buffer;
    let mimeType = 'image/png';

    if (format === 'avif') {
      outputBuffer = await pipeline
        .avif({ quality, effort: 3 })
        .toBuffer();
      mimeType = 'image/avif';
    } else if (format === 'webp') {
      outputBuffer = await pipeline
        .webp({ quality, effort: 3 })
        .toBuffer();
      mimeType = 'image/webp';
    } else if (format === 'jpeg' || format === 'jpg') {
      outputBuffer = await pipeline
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      mimeType = 'image/jpeg';
    } else if (format === 'png') {
      const isPalette = maxColors !== undefined && maxColors < 256;
      outputBuffer = await pipeline
        .png({
          compressionLevel: 6,
          adaptiveFiltering: true,
          palette: isPalette,
          colours: isPalette ? maxColors : 256,
        })
        .toBuffer();
      mimeType = 'image/png';
    } else {
      return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 });
    }

    const finalMeta = await sharp(outputBuffer).metadata();

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', mimeType);
    responseHeaders.set('X-Image-Width', String(finalMeta.width || initialMeta.width || 0));
    responseHeaders.set('X-Image-Height', String(finalMeta.height || initialMeta.height || 0));

    return new NextResponse(new Uint8Array(outputBuffer), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Conversion failed' }, { status: 500 });
  }
}
