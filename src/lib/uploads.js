import { recims } from '@/api/recimsClient'

export const LOGO_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
export const LOGO_MAX_BYTES = 2 * 1024 * 1024 // 2MB
const RECENT_UPLOAD_KEY = 'recims:last-logo-upload'

const isBrowser = typeof window !== 'undefined'

const saveLastUploadMeta = (payload) => {
  if (!isBrowser) return
  try {
    window.localStorage.setItem(RECENT_UPLOAD_KEY, JSON.stringify({
      fileUrl: payload?.file_url || payload?.fileUrl,
      stored: payload?.stored,
      mimeType: payload?.mime_type,
      created_at: payload?.created_at || new Date().toISOString(),
    }))
  } catch (error) {
    console.warn('[uploads] Unable to cache logo metadata', error)
  }
}

const validateLogoFile = (file) => {
  if (!file) {
    throw new Error('Please choose a logo file to upload.')
  }

  if (typeof file.size === 'number' && file.size > LOGO_MAX_BYTES) {
    throw new Error('Logo must be smaller than 2 MB.')
  }

  if (file.type && !LOGO_ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Logo must be a PNG, JPG, SVG, or WebP file.')
  }
}

export async function uploadTenantLogo(file, options = {}) {
  validateLogoFile(file)

  const fileName = options?.fileName || file.name || 'tenant-logo'
  const mimeType = file.type || options?.mimeType || 'image/png'

  try {
    const payload = await recims.integrations.Core.UploadFile({
      file,
      fileName,
      mimeType,
    })

    const fileUrl = payload?.file_url || payload?.fileUrl
    if (!fileUrl) {
      throw new Error('Upload did not return a file URL. Please try again.')
    }

    saveLastUploadMeta(payload)
    return {
      fileUrl,
      meta: payload,
    }
  } catch (error) {
    const message = error?.message || 'Logo upload failed. Please retry.'
    throw new Error(message)
  }
}

export const getLastUploadedLogo = () => {
  if (!isBrowser) return null
  try {
    const raw = window.localStorage.getItem(RECENT_UPLOAD_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (error) {
    return null
  }
}
