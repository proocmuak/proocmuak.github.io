<script setup>
import { ref, computed } from 'vue'
import { supabase } from '../supabase.js'

const props = defineProps({
  currentFiles: {
    type: Array,
    default: () => []
  },
  compact: {
    type: Boolean,
    default: false
  },
  fileType: {
    type: String,
    default: 'file'
  },
  accept: {
    type: String,
    default: '*/*'
  },
  multiple: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['files-uploaded'])

const DEFAULT_BUCKET = "material" // Используем правильный bucket

const fileInput = ref(null)
const busy = ref(false)
const error = ref(null)
const uploadingCount = ref(0)
const completedCount = ref(0)
const overallProgress = ref(0)

const fileTypeLabel = computed(() => {
  const types = {
    'workbook': 'тетради',
    'practice': 'задания', 
    'file': 'файлы'
  }
  return types[props.fileType] || 'файлы'
})

const handleFiles = async (files) => {
  if (files.length === 0) return
  
  // Проверяем аутентификацию
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    error.value = 'Требуется авторизация для загрузки файлов'
    return
  }
  
  busy.value = true
  error.value = null
  uploadingCount.value = files.length
  completedCount.value = 0
  overallProgress.value = 0
  
  const uploadedUrls = []
  
  for (const file of files) {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${props.fileType}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`
      
      // Загружаем с правильными настройками
      const { error: uploadError, data } = await supabase.storage
        .from(DEFAULT_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (uploadError) {
        if (uploadError.message.includes('row-level security')) {
          throw new Error('Нет прав для загрузки. Обратитесь к администратору.')
        }
        throw uploadError
      }
      
      // Получаем публичный URL
      const { data: { publicUrl } } = supabase.storage
        .from(DEFAULT_BUCKET)
        .getPublicUrl(fileName)
      
      uploadedUrls.push(publicUrl)
      completedCount.value++
      overallProgress.value = (completedCount.value / uploadingCount.value) * 100
      
    } catch (e) {
      error.value = e.message
      console.error('Ошибка загрузки файла:', e)
    }
  }
  
  if (uploadedUrls.length > 0) {
    emit('files-uploaded', uploadedUrls)
  }
  
  busy.value = false
  uploadingCount.value = 0
  completedCount.value = 0
}

// ... остальные методы без изменений ...
</script>