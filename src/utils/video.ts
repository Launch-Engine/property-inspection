export const MAX_WALKTHROUGH_SECONDS = 300

export interface ValidatedVideo {
  ok: true
  duration: number
  width: number
  height: number
}

export interface RejectedVideo {
  ok: false
  reason: string
}

export type VideoValidationResult = ValidatedVideo | RejectedVideo

// Load the file into a hidden <video> element and read its duration without
// transcoding. iOS Safari fires `loadedmetadata` as soon as the header lands,
// which is enough for both duration and intrinsic dimensions. The element is
// torn down before resolving so we don't leak object URLs.
export async function validateVideo(file: File | Blob): Promise<VideoValidationResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ok: false, reason: 'Video validation must run in the browser.' }
  }

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.src = url

  try {
    const result = await new Promise<VideoValidationResult>((resolve) => {
      const cleanup = () => {
        video.removeAttribute('src')
        video.load()
      }

      video.onloadedmetadata = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        if (duration === 0) {
          cleanup()
          resolve({ ok: false, reason: 'Could not read the video duration.' })
          return
        }
        if (duration > MAX_WALKTHROUGH_SECONDS) {
          cleanup()
          resolve({
            ok: false,
            reason: `Video is ${formatDuration(duration)} long. The walkthrough must be 5 minutes or less.`,
          })
          return
        }
        cleanup()
        resolve({
          ok: true,
          duration,
          width: video.videoWidth,
          height: video.videoHeight,
        })
      }

      video.onerror = () => {
        cleanup()
        resolve({
          ok: false,
          reason: 'This file does not look like a video the browser can read.',
        })
      }
    })
    return result
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Read the first frame at ~1s into a JPEG thumbnail. Used by the UI to show
// the inspector what they captured without re-uploading the whole video.
export async function extractFirstFrameJpeg(file: File | Blob): Promise<Blob | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.src = url

  try {
    return await new Promise<Blob | null>((resolve) => {
      const cleanup = () => {
        video.removeAttribute('src')
        video.load()
      }

      video.onloadedmetadata = () => {
        // Seek a beat into the video so we don't grab a black first frame.
        const target = Math.min(1, Math.max(0.1, video.duration / 4))
        video.currentTime = target
      }

      video.onseeked = () => {
        const width = video.videoWidth
        const height = video.videoHeight
        if (!width || !height) {
          cleanup()
          resolve(null)
          return
        }
        const canvas = document.createElement('canvas')
        canvas.width = Math.min(width, 800)
        canvas.height = Math.round((canvas.width / width) * height)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          cleanup()
          resolve(null)
          return
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            cleanup()
            resolve(blob)
          },
          'image/jpeg',
          0.8,
        )
      }

      video.onerror = () => {
        cleanup()
        resolve(null)
      }
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
