<template>
  <div class="file-uploader" :class="{ compact: compact }">
    <input
      type="file"
      :accept="accept"
      @change="handleFilesUpload"
      class="file-input"
      :id="uniqueId"
      :multiple="multiple"
      ref="fileInput"
    />
    <label :for="uniqueId" class="file-label">
      {{ currentFiles.length > 0 ? 'Добавить ещё файлы' : 'Выбрать файлы' }}
      <span v-if="multiple">(можно несколько)</span>
    </label>
    
    <div v-if="uploading" class="upload-status">
      Загрузка... {{ uploadProgress }}%
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="filesQueue.length > 0" class="files-queue">
      <div v-for="(file, index) in filesQueue" :key="index" class="file-item">
        <span class="file-name">{{ file.name }}</span>
        <span class="file-size">({{ formatFileSize(file.size) }})</span>
        <span v-if="file.status === 'uploading'" class="file-status">⏳ {{ file.progress }}%</span>
        <span v-else-if="file.status === 'completed'" class="file-status">✅</span>
        <span v-else-if="file.status === 'error'" class="file-status">❌</span>
        <button @click="removeFromQueue(index)" class="remove-btn">×</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { supabase } from '../supabase.js'

// === Конфигурация прокси ===
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

const PROXY_CONFIG = {
  enabled: true,
  baseUrl: isLocalhost 
    ? 'https://schoolpurto.ru/storage' 
    : '/storage'
}

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
  },
  rowId: {
    type: [String, Number],
    default: null
  }
})

const emit = defineEmits(['files-uploaded'])

const uploading = ref(false)
const uploadProgress = ref(0)
const error = ref('')
const filesQueue = ref([])
const fileInput = ref(null)

// Генерируем уникальный ID
const uniqueId = computed(() => {
  return `file-input-${props.fileType}-${props.rowId}-${Math.random().toString(36).substr(2, 9)}`
})

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const removeFromQueue = (index) => {
  filesQueue.value.splice(index, 1)
}

// === ИСПРАВЛЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ ===
const handleFilesUpload = async (event) => {
  const files = Array.from(event.target.files)
  if (!files.length) return

  try {
    uploading.value = true
    error.value = ''
    uploadProgress.value = 0

    filesQueue.value = files.map(file => ({
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0
    }))

    const uploadedPaths = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const queueItem = filesQueue.value[i]
      
      try {
        queueItem.status = 'uploading'
        
        const fileExt = file.name.split('.').pop()
        const randomSuffix = Math.random().toString(36).substr(2, 9)
        
        // Формируем имя файла (без дублирования material/)
        const fileName = props.rowId 
          ? `${props.fileType}_${props.rowId}_${Date.now()}_${i}_${randomSuffix}.${fileExt}`
          : `${props.fileType}_${Date.now()}_${i}_${randomSuffix}.${fileExt}`
        
        // ПРАВИЛЬНЫЙ ПУТЬ: только один раз material/
        const filePath = `${fileName}`

        console.log('Загрузка файла:', filePath)

        // Используем upsert: false и не добавляем лишних заголовков
        const { data, error: uploadError } = await supabase.storage
          .from('material')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
          })

        if (uploadError) {
          console.error('Supabase upload error:', uploadError)
          throw uploadError
        }

        // Сохраняем путь (без дублирования)
        uploadedPaths.push(filePath)
        
        queueItem.status = 'completed'
        queueItem.progress = 100
        
        const completed = filesQueue.value.filter(f => f.status === 'completed').length
        uploadProgress.value = (completed / files.length) * 100

      } catch (err) {
        console.error('Ошибка загрузки файла:', file.name, err)
        queueItem.status = 'error'
        error.value = `Ошибка загрузки ${file.name}: ${err.message}`
      }
    }

    if (uploadedPaths.length > 0) {
      emit('files-uploaded', uploadedPaths)
    }

  } catch (err) {
    console.error('Общая ошибка загрузки:', err)
    error.value = err.message
  } finally {
    uploading.value = false
    setTimeout(() => {
      filesQueue.value = []
      if (fileInput.value) {
        fileInput.value.value = ''
      }
    }, 2000)
  }
}

// Функция для получения прокси-URL (для отображения)
const getProxyUrl = (filePath) => {
  if (!filePath) return ''
  if (filePath.startsWith('http')) {
    if (filePath.includes('supabase.co')) {
      const match = filePath.match(/\/storage\/v1\/object\/public\/material\/(.+)$/)
      if (match) {
        return `${PROXY_CONFIG.baseUrl}/material/${match[1]}`
      }
    }
    return filePath
  }
  return `${PROXY_CONFIG.baseUrl}/material/${filePath}`
}

onUnmounted(() => {
  // Очистка
})
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

.error-message {
  margin: 10px 0;
  color: #f44336;
  font-size: 14px;
  padding: 8px;
  background: #ffebee;
  border-radius: 4px;
  border: 1px solid #ffcdd2;
}

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