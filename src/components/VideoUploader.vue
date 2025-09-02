<template>
  <div class="uploader">
    <h2>Загрузка больших видео</h2>

    <div v-if="!uploading" class="upload-area">
      <label for="video-upload" class="upload-label">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <span>Выберите видео файл</span>
      </label>
      <input 
        id="video-upload"
        type="file" 
        accept="video/*" 
        @change="handleFileSelect"
        ref="fileInput"
        class="file-input"
      />
      <p class="hint">Поддерживаемые форматы: MP4, WebM, MOV, AVI. Максимальный размер: 10GB</p>
    </div>

    <div v-if="uploading" class="upload-status">
      <div class="progress">
        <p>Загрузка: {{ progress.toFixed(0) }}%</p>
        <p>Часть {{ currentPart }}/{{ totalParts }} ({{ formatFileSize(uploadedBytes) }}/{{ formatFileSize(totalBytes) }})</p>
        <progress :value="progress" max="100" class="progress-bar"></progress>
      </div>
      <button @click="cancelUpload" class="cancel-btn" :disabled="!uploading">
        {{ cancelling ? 'Отмена...' : 'Отменить' }}
      </button>
    </div>

    <div v-if="error" class="error-message">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      {{ error }}
    </div>

    <div v-if="success" class="success-message">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      Видео успешно загружено!
    </div>

    <div v-if="videoInfo" class="video-info">
      <h3>Информация о видео:</h3>
      <p><strong>Название:</strong> {{ videoInfo.title }}</p>
      <p><strong>Размер:</strong> {{ formatFileSize(videoInfo.size) }}</p>
      <p v-if="videoInfo.publicUrl">
        <strong>Ссылка:</strong> 
        <a :href="videoInfo.publicUrl" target="_blank" class="video-link">Посмотреть видео</a>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue"
import { supabase, callFunction } from "../supabase"

const emit = defineEmits(['video-uploaded'])

// CDN конфигурация
const CDN_DOMAIN = 'dff707dc-2d18-472b-b99a-ed9d861c7a4b.selcdn.net'

const uploading = ref(false)
const progress = ref(0)
const error = ref("")
const success = ref(false)
const fileInput = ref(null)
const currentPart = ref(0)
const totalParts = ref(0)
const uploadedBytes = ref(0)
const totalBytes = ref(0)
const cancelling = ref(false)
const videoInfo = ref(null)

// Upload data
const uploadData = ref({
  uploadId: null,
  key: null,
  publicUrl: null,
  parts: []
})

// Abort controller for cancelling uploads
const abortController = new AbortController()

// Обработчик выбора файла
function handleFileSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return
  
  // Сбрасываем input чтобы можно было выбрать тот же файл снова
  e.target.value = ''
  
  startUpload(file)
}

// Основная функция загрузки
async function startUpload(file) {
  // Reset states
  error.value = ""
  success.value = false
  uploading.value = true
  uploadedBytes.value = 0
  totalBytes.value = file.size

  try {
    // 1. Initialize multipart upload
    const initResponse = await callFunction("multipart-upload", {
      action: "init",
      fileName: file.name,
      contentType: file.type
    })

    if (!initResponse.uploadId || !initResponse.key) {
      throw new Error('Не удалось инициализировать загрузку')
    }

    uploadData.value = {
      uploadId: initResponse.uploadId,
      key: initResponse.key,
      publicUrl: initResponse.publicUrl,
      parts: []
    }

    // 2. Calculate parts
    const CHUNK_SIZE = 8 * 1024 * 1024 // 8MB chunks
    totalParts.value = Math.ceil(file.size / CHUNK_SIZE)

    console.log(`Starting upload of ${totalParts.value} parts`)

    // 3. Upload parts through proxy
    for (let partNumber = 1; partNumber <= totalParts.value; partNumber++) {
      if (cancelling.value) {
        throw new Error('Загрузка отменена')
      }

      currentPart.value = partNumber
      
      // Get chunk data
      const start = (partNumber - 1) * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)

      console.log(`Uploading part ${partNumber}/${totalParts.value}, size: ${chunk.size} bytes`)

      // Convert chunk to base64 for transmission
      const chunkArrayBuffer = await chunk.arrayBuffer()
      const chunkBase64 = arrayBufferToBase64(chunkArrayBuffer)

      // Upload part through Edge Function proxy
      const uploadResponse = await callFunction("multipart-upload", {
        action: "upload-part",
        uploadId: uploadData.value.uploadId,
        key: uploadData.value.key,
        partNumber: partNumber,
        chunkData: chunkBase64
      })

      if (!uploadResponse.success || !uploadResponse.etag) {
        throw new Error(`Ошибка загрузки части ${partNumber}`)
      }

      uploadData.value.parts.push({
        PartNumber: partNumber,
        ETag: uploadResponse.etag
      })

      // Update progress
      uploadedBytes.value = end
      progress.value = (uploadedBytes.value / totalBytes.value) * 100
    }

    if (cancelling.value) {
      throw new Error('Загрузка отменена')
    }

    // 4. Complete upload
    const completeResponse = await callFunction("multipart-upload", {
      action: "complete",
      uploadId: uploadData.value.uploadId,
      key: uploadData.value.key,
      parts: uploadData.value.parts
    })

    if (!completeResponse.success) {
      throw new Error('Не удалось завершить загрузку')
    }

    // 5. Генерируем CDN URL вместо прямой S3 ссылки
    const cdnUrl = `https://${CDN_DOMAIN}/${uploadData.value.key}`
    console.log('CDN URL сгенерирован:', cdnUrl)

    // 6. Save to database with CDN URL
    const { error: dbError } = await supabase.from("videos").insert({
      title: file.name,
      video_path: uploadData.value.key, // сохраняем оригинальный путь
      public_url: cdnUrl, // используем CDN ссылку
      description: null,
      file_size: file.size,
    })

    if (dbError) throw dbError

    success.value = true
    videoInfo.value = {
      title: file.name,
      size: file.size,
      publicUrl: cdnUrl // показываем CDN ссылку
    }

    // 7. Отправляем событие с CDN ссылкой
    console.log('VideoUploader: отправляю CDN ссылку', cdnUrl)
    emit('video-uploaded', cdnUrl)

  } catch (err) {
    console.error('Upload error:', err)
    if (err.name !== 'AbortError') {
      error.value = err.message || 'Произошла ошибка при загрузке'
    }
    
    // Abort upload on error (только если не отмена)
    if (uploadData.value.uploadId && !cancelling.value) {
      await abortUpload(uploadData.value.uploadId, uploadData.value.key)
    }
  } finally {
    uploading.value = false
    cancelling.value = false
  }
}

// Функция для конвертации ArrayBuffer в Base64
function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function abortUpload(uploadId, key) {
  try {
    if (uploadId && key) {
      await callFunction("multipart-upload", {
        action: "abort",
        uploadId: uploadId,
        key: key
      })
      console.log('Upload aborted successfully')
    }
  } catch (err) {
    console.error('Ошибка при отмене загрузки:', err)
  }
}

async function cancelUpload() {
  cancelling.value = true
  abortController.abort()
  error.value = 'Загрузка отменена'
  
  if (uploadData.value.uploadId && uploadData.value.key) {
    await abortUpload(uploadData.value.uploadId, uploadData.value.key)
  }
  
  uploading.value = false
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
/* Стили остаются без изменений */
.uploader {
  border: 2px dashed #e2e8f0;
  padding: 2rem;
  border-radius: 12px;
  max-width: 500px;
  margin: 0 auto;
  text-align: center;
  background: #f8fafc;
}

.upload-area {
  margin-bottom: 1.5rem;
}

.upload-label {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 1rem;
}

.upload-label:hover {
  border-color: #3b82f6;
  background: #f0f7ff;
}

.file-input {
  display: none;
}

.hint {
  color: #64748b;
  font-size: 0.875rem;
}

.upload-status {
  margin: 1.5rem 0;
}

.progress {
  margin-bottom: 1rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  border-radius: 4px;
}

.error-message,
.success-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
  font-weight: 500;
}

.error-message {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.success-message {
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}

.video-info {
  margin-top: 1.5rem;
  padding: 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  text-align: left;
}

.cancel-btn {
  padding: 0.5rem 1rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.cancel-btn:hover:not(:disabled) {
  background: #dc2626;
}

.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>