interface CloudinaryUploadOptions {
  data: ArrayBuffer
  mime_type: string
  public_id?: string
  folder?: string
  context?: Record<string, string>
}

export interface CloudinaryUploadResult {
  secure_url: string
  public_id: string
  bytes: number
  width: number
  height: number
}

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined

export function cloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET)
}

export async function uploadToCloudinary(
  options: CloudinaryUploadOptions,
): Promise<CloudinaryUploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.')
  }

  const blob = new Blob([options.data], { type: options.mime_type || 'image/jpeg' })
  const form = new FormData()
  form.append('file', blob)
  form.append('upload_preset', UPLOAD_PRESET)
  if (options.public_id) form.append('public_id', options.public_id)
  if (options.folder) form.append('folder', options.folder)
  if (options.context) {
    const ctx = Object.entries(options.context)
      .map(([k, v]) => `${k}=${v.replace(/\|/g, '')}`)
      .join('|')
    if (ctx) form.append('context', ctx)
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
  const response = await fetch(endpoint, { method: 'POST', body: form })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Cloudinary upload failed (${response.status}): ${text.slice(0, 200)}`)
  }

  const json = (await response.json()) as CloudinaryUploadResult
  if (!json.secure_url || !json.public_id) {
    throw new Error('Cloudinary response missing secure_url or public_id.')
  }
  return json
}
