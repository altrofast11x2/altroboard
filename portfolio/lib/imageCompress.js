// 클라이언트측 이미지 압축 — 게시판/갤러리/스토리/쇼츠 모두 공통 사용
// 기본: 최대 변 1280px, JPEG 75%. GIF 는 그대로 (애니메이션 보존).
// 결과는 data URL (base64).

/**
 * 이미지 파일을 압축해 base64 data URL 로 반환
 * @param {File} file
 * @param {{maxDim?: number, quality?: number}} opts
 */
export function compressImage(file, { maxDim = 1280, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('파일 없음'))

    // GIF는 그대로 — 애니메이션 보존
    if (file.type === 'image/gif') {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.onerror = () => reject(new Error('파일 읽기 실패'))
      reader.readAsDataURL(file)
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      try {
        let w = img.width, h = img.height
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim }
          else { w = Math.round(w * maxDim / h); h = maxDim }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, w, h)
        // WebP 지원 시 더 작음
        const out = canvas.toDataURL('image/jpeg', quality)
        URL.revokeObjectURL(url)
        resolve(out)
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 불러올 수 없습니다'))
    }
    img.src = url
  })
}

/**
 * data URL 의 대략적 크기 (bytes)
 */
export function dataUrlSize(dataUrl) {
  if (!dataUrl?.startsWith('data:')) return 0
  const i = dataUrl.indexOf(',')
  if (i < 0) return 0
  const b64 = dataUrl.slice(i+1)
  return Math.floor(b64.length * 3 / 4)
}

/**
 * 결과 data URL 이 너무 크면 quality 낮춰서 재시도. 최종 출력 ≤ targetKB.
 */
export async function compressImageToTarget(file, targetKB = 600) {
  const targetBytes = targetKB * 1024
  let q = 0.85
  let maxDim = 1600
  let out = await compressImage(file, { maxDim, quality: q })
  let tries = 0
  while (dataUrlSize(out) > targetBytes && tries < 5) {
    if (q > 0.4) q -= 0.12
    else maxDim = Math.max(400, Math.floor(maxDim * 0.8))
    out = await compressImage(file, { maxDim, quality: q })
    tries++
  }
  return out
}
