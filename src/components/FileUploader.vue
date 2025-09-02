<template>
  <div class="file-uploader" :class="{ compact: compact }">
    <input
      type="file"
      :accept="accept"
      @change="handleFileUpload"
      class="file-input"
      :id="'file-input-' + fileType"
    />
    <label :for="'file-input-' + fileType" class="file-label">
      {{ currentFile ? 'Заменить файл' : 'Выбрать файл' }}
    </label>
    
    <div v-if="uploading" class="upload-status">
      Загрузка... {{ uploadProgress }}%
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase.js'

const props = defineProps({
  currentFile: String,
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
  }
})

const emit = defineEmits(['file-uploaded'])
const uploading = ref(false)
const uploadProgress = ref(0)
const error = ref('')

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    uploading.value = true
    error.value = ''
    uploadProgress.value = 0

    // Генерируем уникальное имя файла
    const fileExt = file.name.split('.').pop()
    const fileName = `${props.fileType}_${Date.now()}.${fileExt}`
    const filePath = `material/${fileName}`

    // Загружаем файл в Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('material')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        onUploadProgress: (progress) => {
          uploadProgress.value = Math.round((progress.loaded / progress.total) * 100)
        }
      })

    if (uploadError) throw uploadError

    // Получаем публичную ссылку
    const { data: { publicUrl } } = supabase.storage
      .from('material')
      .getPublicUrl(filePath)

    console.log('Файл успешно загружен:', publicUrl)
    emit('file-uploaded', publicUrl)

  } catch (err) {
    console.error('Ошибка загрузки файла:', err)
    error.value = err.message
  } finally {
    uploading.value = false
    uploadProgress.value = 0
    // Сбрасываем input
    event.target.value = ''
  }
}
</script>

<style scoped>
.file-uploader {
  margin-bottom: 10px;
}

.file-input {
  display: none;
}

.file-label {
  display: inline-block;
  padding: 8px 16px;
  background-color: #2196F3;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.file-label:hover {
  background-color: #1976D2;
}

.compact .file-label {
  padding: 4px 8px;
  font-size: 12px;
}

.upload-status {
  margin-top: 5px;
  font-size: 12px;
  color: #666;
}

.error-message {
  margin-top: 5px;
  color: #f44336;
  font-size: 12px;
}
</style>