const TARGET_MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82

export interface ResizedPhoto {
  blob: Blob
  width: number
  height: number
}

export async function resizePhoto(file: File | Blob): Promise<ResizedPhoto> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = scaleDimensions(bitmap.width, bitmap.height)

  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height })

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not create 2D canvas context for photo resize.')
  }

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await canvasToBlob(canvas)
  return { blob, width, height }
}

function scaleDimensions(srcWidth: number, srcHeight: number) {
  const largest = Math.max(srcWidth, srcHeight)
  if (largest <= TARGET_MAX_DIMENSION) {
    return { width: srcWidth, height: srcHeight }
  }
  const scale = TARGET_MAX_DIMENSION / largest
  return {
    width: Math.round(srcWidth * scale),
    height: Math.round(srcHeight * scale),
  }
}

async function canvasToBlob(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Canvas produced no blob.'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
