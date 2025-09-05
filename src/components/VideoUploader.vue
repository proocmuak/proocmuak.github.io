<template>
  <div class="video-uploader">
    <div class="dropzone" @drop.prevent="onDrop" @dragover.prevent>
      <input type="file" ref="fileInput" @change="onFileSelect" hidden accept="video/*" :multiple="multiple" />
      <button type="button" class="btn" @click="handleButtonClick" :disabled="busy">
        {{ compact ? '📹' : 'Выбрать видео' }}
      </button>
      <p v-if="!compact && !busy">Перетащите видео сюда или нажмите кнопку</p>
      <p v-if="multiple && !compact">Можно выбрать несколько видео</p>
    </div>

    <div v-if="uploadingCount > 0" class="upload-stats">
      <div class="progress">
        <div class="bar" :style="{ width: overallProgress + '%' }"></div>
      </div>
      <div class="stats">
        Загружено: {{ completedCount }} / {{ uploadingCount }}
        <span v-if="currentSpeed > 0">• {{ formatBytes(currentSpeed) }}/сек</span>
      </div>
    </div>

    <div v-if="error" class="error">
      ❌ {{ error }}
    </div>

    <div v-if="currentVideos.length > 0 && !compact" class="current-videos">
      <h4>Загруженные видео (CDN):</h4>
      <div v-for="(url, index) in currentVideos" :key="index" class="video-item">
        <a :href="url" target="_blank" class="video-link">Видео {{ index + 1 }}</a>
        <button @click="copyUrl(url)" class="btn-copy" title="Копировать CDN ссылку">📋</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  currentVideos: {
    type: Array,
    default: () => []
  },
  compact: {
    type: Boolean,
    default: false
  },
  multiple: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['videos-uploaded'])

// === Настройки для Selectel CDN ===
const EDGE_BASE = "https://mltqewxnxinaytavbmds.supabase.co/functions/v1/multipart-upload"
const DEFAULT_BUCKET = "videos-purto"
const DEFAULT_PREFIX = "uploads/"
const SELECTEL_CDN_URL = "https://dff707dc-2d18-472b-b99a-ed9d861c7a4b.selcdn.net" // Замените на ваш CDN URL

// === Refs & state ===
const fileInput = ref(null)
const busy = ref(false)
const error = ref(null)
const uploadingCount = ref(0)
const completedCount = ref(0)
const overallProgress = ref(0)
const currentSpeed = ref(0)
const uploadStartTime = ref(null)

const formatBytes = (n) => {
  if (n === 0) return "0 B"
  const k = 1024, units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(n) / Math.log(k))
  return `${(n / Math.pow(k, i)).toFixed(2)} ${units[i]}`
}

const copyUrl = (url) => {
  navigator.clipboard.writeText(url)
  alert('CDN ссылка скопирована в буфер обмена')
}

// === API helpers для Selectel ===
const apiStart = async (key, contentType) => {
  const r = await fetch(`${EDGE_BASE}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      key, 
      contentType, 
      bucket: DEFAULT_BUCKET 
    }),
  })
  if (!r.ok) throw new Error(`start failed: ${await r.text()}`)
  return r.json()
}

const apiSignPart = async (key, uploadId, partNumber) => {
  const qs = new URLSearchParams({
    key, 
    uploadId, 
    partNumber: String(partNumber),
    bucket: DEFAULT_BUCKET,
  })
  const r = await fetch(`${EDGE_BASE}/sign-part?` + qs.toString())
  if (!r.ok) throw new Error(`sign-part failed: ${await r.text()}`)
  return r.json()
}

const apiComplete = async (key, uploadId, parts) => {
  const r = await fetch(`${EDGE_BASE}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      key, 
      uploadId, 
      parts, 
      bucket: DEFAULT_BUCKET 
    }),
  })
  if (!r.ok) throw new Error(`complete failed: ${await r.text()}`)
  return r.json()
}

// === UI handlers ===
const handleButtonClick = (e) => {
  e.preventDefault()
  e.stopPropagation()
  fileInput.value?.click()
}

const onFileSelect = (e) => {
  const selectedFiles = Array.from(e.target.files)
  if (selectedFiles.length > 0) {
    handleFiles(selectedFiles)
  }
}

const onDrop = (e) => {
  e.preventDefault()
  const droppedFiles = Array.from(e.dataTransfer?.files || [])
  if (droppedFiles.length > 0) {
    handleFiles(droppedFiles)
  }
}

const handleFiles = async (files) => {
  const videoFiles = files.filter(file => file.type.startsWith('video/'))
  
  if (videoFiles.length === 0) {
    alert('Пожалуйста, выберите видео файлы')
    return
  }
  
  busy.value = true
  error.value = null
  uploadingCount.value = videoFiles.length
  completedCount.value = 0
  overallProgress.value = 0
  currentSpeed.value = 0
  uploadStartTime.value = Date.now()
  
  const uploadedUrls = []
  
  for (const file of videoFiles) {
    try {
      const cdnUrl = await uploadToSelectel(file)
      uploadedUrls.push(cdnUrl)
      completedCount.value++
      overallProgress.value = (completedCount.value / uploadingCount.value) * 100
      
    } catch (e) {
      error.value = e.message
      console.error('Ошибка загрузки видео:', e)
    }
  }
  
  if (uploadedUrls.length > 0) {
    emit('videos-uploaded', uploadedUrls)
  }
  
  busy.value = false
}

const uploadToSelectel = async (file) => {
  // Генерация ключа для загрузки
  const prefix = DEFAULT_PREFIX
  const timestamp = Date.now()
  const cleanName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "")
  const uploadKey = `${prefix}${timestamp}_${cleanName}`

  // Создаем upload session
  const info = await apiStart(uploadKey, file.type || "video/mp4")
  const uploadId = info.uploadId

  // Загружаем части
  const partSize = 64 * 1024 * 1024
  const totalParts = Math.ceil(file.size / partSize)
  const partsMap = {}

  for (let pn = 1; pn <= totalParts; pn++) {
    const startByte = (pn - 1) * partSize
    const endByte = Math.min(startByte + partSize, file.size)
    const chunk = file.slice(startByte, endByte)

    // Получаем URL для загрузки части
    const { url: signedUrl } = await apiSignPart(uploadKey, uploadId, pn)

    // Загружаем часть
    const response = await fetch(signedUrl, {
      method: "PUT",
      body: chunk,
      headers: { "Content-Type": "application/octet-stream" }
    })

    if (!response.ok) throw new Error(`Upload part ${pn} failed`)

    const etag = response.headers.get("ETag")?.replace(/"/g, "") || ""
    partsMap[pn] = etag
  }

  // Завершаем загрузку
  const parts = Object.entries(partsMap)
    .map(([PartNumber, ETag]) => ({ PartNumber: Number(PartNumber), ETag }))
    .sort((a, b) => a.PartNumber - b.PartNumber)

 const res = await apiComplete(uploadKey, uploadId, parts)
  
  // Всегда используем CDN URL, независимо от того, что вернула функция
  const cdnUrl = `https://dff707dc-2d18-472b-b99a-ed9d861c7a4b.selcdn.net/${uploadKey}`
  return cdnUrl
}
</script>

<style scoped>
/* Стили остаются без изменений */
.video-uploader {
  margin: 10px 0;
}

.dropzone {
  padding: 15px;
  border: 2px dashed #ccc;
  border-radius: 8px;
  text-align: center;
  margin-bottom: 10px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  margin: 5px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-stats {
  margin: 10px 0;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.progress {
  height: 10px;
  background: #e9ecef;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress .bar {
  height: 100%;
  background: #28a745;
  transition: width 0.3s;
}

.stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #6c757d;
}

.error {
  color: #dc3545;
  margin: 10px 0;
  padding: 10px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}

.current-videos {
  margin-top: 15px;
  padding: 15px;
  background: #e8f5e8;
  border-radius: 6px;
  border: 1px solid #c8e6c9;
}

.current-videos h4 {
  margin: 0 0 10px 0;
  color: #2e7d32;
  font-size: 14px;
}

.video-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  margin-bottom: 5px;
  background: white;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.video-link {
  color: #2e7d32;
  text-decoration: none;
  font-weight: 500;
  flex: 1;
}

.video-link:hover {
  text-decoration: underline;
}

.btn-copy {
  padding: 4px 8px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.btn-copy:hover {
  background: #0056b3;
}
</style>