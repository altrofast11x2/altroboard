// 클라이언트측 동영상 압축 (재인코딩)
// canvas + MediaRecorder 를 사용해 해상도/비트레이트를 낮춰 새 mp4/webm 파일을 만든다.
// YouTube 처럼 다양한 해상도/코덱을 제공하지는 못하지만, 1080p 원본을 720p ~1.5Mbps 로 떨어뜨려
// 업로드 크기를 큰 폭으로 줄이는 효과는 낼 수 있다.
//
// 사용법:
//   import { compressVideo } from '@/lib/videoCompress'
//   const compressed = await compressVideo(file, { maxWidth: 1280, bitrate: 1_500_000, onProgress: p => ... })
//   // → compressed: File (mp4/webm)
//
// 지원: 최신 Chrome, Edge, Safari 15+, Firefox 100+. 미지원 브라우저는 원본 그대로 반환.

const PREFERRED_MIME_TYPES = [
  'video/mp4;codecs=avc1.42E01F,mp4a.40.2', // H.264 + AAC (Safari/Chrome 최신)
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null
  for (const t of PREFERRED_MIME_TYPES) {
    try { if (MediaRecorder.isTypeSupported(t)) return t } catch {}
  }
  return null
}

export async function compressVideo(file, {
  maxWidth = 1280,
  maxHeight = 1280,
  bitrate = 1_500_000,
  audioBitrate = 96_000,
  fps = 30,
  onProgress,
} = {}) {
  // 환경 미지원 → 원본 그대로
  if (typeof window === 'undefined') return file
  const mimeType = pickMime()
  if (!mimeType) return file
  if (typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return file

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  const url = URL.createObjectURL(file)
  video.src = url

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('동영상 메타데이터 로드 실패'))
  })

  const inW = video.videoWidth
  const inH = video.videoHeight
  if (!inW || !inH) { URL.revokeObjectURL(url); return file }

  // 출력 해상도 — 짧은 변을 maxWidth/maxHeight 에 맞춰 비율 유지
  const ratio = inW / inH
  let outW, outH
  if (inW <= maxWidth && inH <= maxHeight) {
    outW = inW; outH = inH
  } else if (ratio >= 1) {
    outW = Math.min(maxWidth, inW)
    outH = Math.round(outW / ratio / 2) * 2
  } else {
    outH = Math.min(maxHeight, inH)
    outW = Math.round(outH * ratio / 2) * 2
  }

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')

  // 비디오 트랙: canvas.captureStream
  const canvasStream = canvas.captureStream(fps)

  // 오디오 트랙: video element 의 captureStream 에서 가져오기
  let audioTracks = []
  try {
    const vStream = video.captureStream ? video.captureStream() : (video.mozCaptureStream && video.mozCaptureStream())
    if (vStream) audioTracks = vStream.getAudioTracks()
  } catch {}
  const combined = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioTracks,
  ])

  const chunks = []
  const recorder = new MediaRecorder(combined, {
    mimeType,
    videoBitsPerSecond: bitrate,
    audioBitsPerSecond: audioBitrate,
  })
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }

  const done = new Promise((resolve) => { recorder.onstop = () => resolve() })

  recorder.start(250)
  await video.play().catch(() => {})

  let raf = 0
  const draw = () => {
    if (video.ended || video.paused) return
    ctx.drawImage(video, 0, 0, outW, outH)
    if (onProgress && video.duration) {
      const p = Math.min(1, video.currentTime / video.duration)
      onProgress(p)
    }
    raf = requestAnimationFrame(draw)
  }
  raf = requestAnimationFrame(draw)

  await new Promise((resolve) => {
    video.onended = () => resolve()
    // 안전망: 영상 길이가 끝까지 안 가는 경우 polling
    const id = setInterval(() => {
      if (video.ended || video.duration && video.currentTime >= video.duration - 0.05) {
        clearInterval(id); resolve()
      }
    }, 200)
  })
  cancelAnimationFrame(raf)
  // 마지막 프레임 한 번 더 그리기 + 약간의 여유
  ctx.drawImage(video, 0, 0, outW, outH)
  await new Promise(r => setTimeout(r, 150))
  recorder.stop()
  await done

  URL.revokeObjectURL(url)
  // 트랙 정리
  combined.getTracks().forEach(t => t.stop())
  canvasStream.getTracks().forEach(t => t.stop())

  const outBlob = new Blob(chunks, { type: mimeType.split(';')[0] })

  // 압축 후 크기가 더 크면 원본 사용 (드물지만 짧은 영상에서 가능)
  if (outBlob.size >= file.size * 0.95) {
    return file
  }

  const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'
  const baseName = (file.name || 'video').replace(/\.[^.]+$/, '')
  return new File([outBlob], `${baseName}.compressed.${ext}`, { type: outBlob.type })
}

// 원본이 압축이 필요한지 판단 — 30MB 이상이거나 1080p 초과면 압축
// (사용자 요청: 유튜브처럼 적극 압축. 단 hang 위험이 있어 너무 작은 영상은 skip)
export async function shouldCompress(file) {
  if (!file) return false
  if (file.size > 30 * 1024 * 1024) return true
  try {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.src = url
    const timed = await Promise.race([
      new Promise((res, rej) => { v.onloadedmetadata = () => res(true); v.onerror = () => rej(new Error('meta')) }),
      new Promise(res => setTimeout(() => res(false), 5000)),
    ])
    URL.revokeObjectURL(url)
    if (!timed) return false
    return v.videoWidth > 1280 || v.videoHeight > 1280
  } catch { return false }
}

// compressVideo 호출에 타임아웃 — 5분 안에 안 끝나면 원본 사용
export async function compressVideoSafe(file, opts = {}) {
  const TIMEOUT_MS = 5 * 60 * 1000
  return Promise.race([
    compressVideo(file, opts).catch(() => file),
    new Promise(res => setTimeout(() => res(file), TIMEOUT_MS)),
  ])
}
