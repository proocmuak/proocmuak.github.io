<template>
  <div class="file-uploader" :class="{ compact: compact }">
    <input
      type="file"
      :accept="accept"
      @change="handleFilesUpload"
      class="file-input"
      :id="'file-input-' + fileType"
      :multiple="multiple"
    />
    <label :for="'file-input-' + fileType" class="file-label">
      {{ currentFiles.length > 0 ? 'Добавить ещё файлы' : 'Выбрать файлы' }}
      <span v-if="multiple">(можно несколько)</span>
    </label>
    
    <div v-if="uploading" class="upload-status">
      Загрузка... {{ uploadProgress }}%
      <div v-if="uploadingCount > 0" class="upload-stats">
        Загружено: {{ completedCount }} из {{ uploadingCount }}
      </div>
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Прогресс-бар -->
    <div v-if="uploading" class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
      </div>
    </div>

    <!-- Список загружаемых файлов -->
    <div v-if="filesQueue.length > 0" class="files-queue">
      <div v-for="(file, index) in filesQueue" :key="index" class="file-item">
        <span class="file-name">{{ file.name }}</span>
        <span class="file-size">({{ formatFileSize(file.size) }})</span>
        <span v-if="file.status === 'uploading'" class="file-status">⏳ {{ file.progress }}%</span>
        <span v-else-if="file.status === 'completed'" class="file-status">✅</span>
        <span v-else-if="file.status === 'error'" class="file-status">❌</span>
        <button v-if="file.status !== 'uploading'" @click="removeFromQueue(index)" class="remove-btn">×</button>
      </div>
    </div>

    <!-- Список уже загруженных файлов -->
    <div v-if="currentFiles.length > 0" class="uploaded-files">
      <h4>Загруженные файлы:</h4>
      <div v-for="(url, index) in currentFiles" :key="index" class="uploaded-file">
        <a :href="url" target="_blank" class="file-link">{{ getFileName(url) }}</a>
        <button @click="copyUrl(url)" class="copy-btn" title="Копировать ссылку">📋</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { supabase } from '../supabase.js'

const props = defineProps({
  currentFiles: {
    type: Array,
    default: () => []
  },
  fileType: {
    type: String,
    default: 'file'
  },
  compact: {
    type: Boolean,
    default: false
  },
  accept: {
    type: String,
    default: '*/*'
  },
  multiple: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['files-uploaded'])

const uploading = ref(false)
const uploadProgress = ref(0)
const error = ref('')
const uploadingCount = ref(0)
const completedCount = ref(0)
const filesQueue = ref([])

const fileTypeLabel = computed(() => {
  const types = {
    'workbook': 'рабочие тетради',
    'practice': 'практические задания', 
    'file': 'файлы'
  }
  return types[props.fileType] || 'файлы'
})

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getFileName = (url) => {
  if (!url) return ''
  const parts = url.split('/')
  return parts[parts.length - 1]
}

const copyUrl = (url) => {
  navigator.clipboard.writeText(url)
  alert('Ссылка скопирована в буфер обмена')
}

const removeFromQueue = (index) => {
  filesQueue.value.splice(index, 1)
}

const handleFilesUpload = async (event) => {
  const files = Array.from(event.target.files)
  if (!files.length) return

  try {
    uploading.value = true
    error.value = ''
    uploadingCount.value = files.length
    completedCount.value = 0
    uploadProgress.value = 0

    // Добавляем файлы в очередь с начальным статусом
    filesQueue.value = files.map(file => ({
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0
    }))

    const uploadedUrls = []

    // Загружаем файлы последовательно
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const queueItem = filesQueue.value[i]
      
      try {
        queueItem.status = 'uploading'
        
        // Генерируем уникальное имя файла
        const fileExt = file.name.split('.').pop()
        const fileName = `${props.fileType}_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`
        const filePath = `material/${fileName}`

        // Загружаем файл в Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from('material')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            onUploadProgress: (progress) => {
              const progressPercent = Math.round((progress.loaded / progress.total) * 100)
              queueItem.progress = progressPercent
              uploadProgress.value = ((completedCount.value + (progressPercent / 100)) / uploadingCount.value) * 100
            }
          })

        if (uploadError) throw uploadError

        // Получаем публичную ссылку
        const { data: { publicUrl } } = supabase.storage
          .from('material')
          .getPublicUrl(filePath)

        console.log('Файл успешно загружен:', publicUrl)
        uploadedUrls.push(publicUrl)
        
        queueItem.status = 'completed'
        completedCount.value++

      } catch (err) {
        console.error('Ошибка загрузки файла:', file.name, err)
        queueItem.status = 'error'
        error.value = `Ошибка загрузки ${file.name}: ${err.message}`
        completedCount.value++
      }
    }

    if (uploadedUrls.length > 0) {
      emit('files-uploaded', uploadedUrls)
    }

  } catch (err) {
    console.error('Общая ошибка загрузки:', err)
    error.value = err.message
  } finally {
    uploading.value = false
    uploadProgress.value = 0
    uploadingCount.value = 0
    completedCount.value = 0
    // Очищаем очередь через секунду после завершения
    setTimeout(() => {
      filesQueue.value = []
    }, 2000)
    // Сбрасываем input
    event.target.value = ''
  }
}
</script>

<style scoped>
.file-uploader {
  margin-bottom: 15px;
  padding: 15px;
  border: 2px dashed #ddd;
  border-radius: 8px;
  background: #fafafa;
}

.file-input {
  display: none;
}

.file-label {
  display: inline-block;
  padding: 12px 20px;
  background-color: #2196F3;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.3s;
  margin-bottom: 10px;
}

.file-label:hover {
  background-color: #1976D2;
  transform: translateY(-1px);
}

.compact .file-label {
  padding: 6px 12px;
  font-size: 12px;
}

.upload-status {
  margin: 10px 0;
  font-size: 14px;
  color: #666;
}

.upload-stats {
  font-size: 12px;
  color: #888;
  margin-top: 5px;
}

.error-message {
  margin: 10px 0;
  color: #f44336;
  font-size: 14px;
  padding: 8px;
  background: #ffebee;
  border-radius: 4px;
  border: 1px solid #ffcdd2;
}

/* Прогресс-бар */
.progress-container {
  margin: 10px 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4CAF50;
  transition: width 0.3s ease;
  border-radius: 4px;
}

/* Очередь файлов */
.files-queue {
  margin: 15px 0;
  max-height: 200px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  margin: 5px 0;
  background: white;
  border-radius: 4px;
  border: 1px solid #eee;
  font-size: 13px;
}

.file-name {
  flex: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: #666;
  margin: 0 10px;
  font-size: 11px;
}

.file-status {
  margin: 0 10px;
  font-size: 12px;
}

.remove-btn {
  background: none;
  border: none;
  color: #f44336;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: #ffebee;
  border-radius: 50%;
}

/* Загруженные файлы */
.uploaded-files {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.uploaded-files h4 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 14px;
  font-weight: 600;
}

.uploaded-file {
  display: flex;
  align-items: center;
  padding: 6px 0;
  margin: 2px 0;
}

.file-link {
  flex: 1;
  color: #2196F3;
  text-decoration: none;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-link:hover {
  text-decoration: underline;
}

.copy-btn {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  margin-left: 8px;
  border-radius: 3px;
}

.copy-btn:hover {
  background: #f5f5f5;
  color: #333;
}

/* Адаптивность */
@media (max-width: 768px) {
  .file-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .file-size, .file-status {
    margin: 0;
  }
}
</style>