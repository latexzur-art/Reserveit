const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20MB
const MIN_QR_DIMENSION = 200

export function validateImageFileSize(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return 'Image is too large (max 20MB)'
  return null
}

export function checkQrDimensions(width: number, height: number): string | null {
  if (width < MIN_QR_DIMENSION || height < MIN_QR_DIMENSION) {
    return `QR image must be at least ${MIN_QR_DIMENSION}x${MIN_QR_DIMENSION} pixels`
  }
  return null
}

export async function validateQrDimensions(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const error = checkQrDimensions(bitmap.width, bitmap.height)
    bitmap.close()
    return error
  } catch {
    return 'Unable to read image dimensions'
  }
}
