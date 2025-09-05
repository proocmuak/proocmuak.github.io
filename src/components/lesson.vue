<template>
  <div class="lesson-container">
    <button @click="handleBack" class="back-button">Вернуться к календарю</button>
    
    <div v-if="!isAuthenticated" class="auth-message">
      <p>Пожалуйста, войдите в систему для просмотра уроков</p>
      <button @click="redirectToLogin" class="login-button">Войти</button>
    </div>
    
    <div v-else>
      <div v-if="loading">Загрузка...</div>
      <div v-else-if="error" class="error-message">Ошибка: {{ error }}</div>
      <div v-else-if="!lesson">Урок не найден</div>
      <div v-else class="lesson_info">
        <h2>Урок {{ lesson.number }}</h2>
        <h3>{{ lesson.title }} ({{ formattedDate }})</h3>
        
        <!-- Все видео отображаются последовательно -->
        <div v-if="allVideos.length > 0" class="videos-container">
          <div v-for="(video, index) in allVideos" :key="index" class="video-item">
            <h4 class="video-title">Видео {{ index + 1 }}</h4>
            <div class="video-wrapper" @contextmenu.prevent="showProtectionMessage">
              <video
                :ref="el => { videoRefs[index] = el }"
                class="video-player"
                controls
                preload="auto"
                controlslist="nodownload noremoteplayback"
                disablepictureinpicture
                @contextmenu.prevent="handleVideoContextMenu"
              >
                <source :src="video" :type="getVideoType(video)">
                Ваш браузер не поддерживает видео тег.
              </video>
              
              <!-- Сообщение о защите -->
              <div v-if="showMessage" class="protection-message">
                Скачивание видео запрещено
              </div>
            </div>
          </div>
        </div>
        
        <!-- Секция рабочих материалов -->
        <div v-if="hasMaterials" class="materials-section">
          <h4>Материалы урока:</h4>
          
          <!-- Рабочие тетради -->
          <div v-if="workbooks.length > 0" class="material-category">
            <h5 class="category-title">
              <span class="category-icon">📘</span>
              Рабочие тетради
            </h5>
            <div class="files-list">
              <div v-for="(file, index) in workbooks" :key="index" class="file-item">
                <div class="file-info">
                  <span class="file-name">Тетрадь {{ index + 1 }}</span>
                  <span class="file-size" v-if="fileSizes.workbooks[index]">{{ fileSizes.workbooks[index] }}</span>
                </div>
                <a :href="file" target="_blank" class="download-button">
                  Скачать
                </a>
              </div>
            </div>
          </div>
          
          <!-- Практические задания -->
          <div v-if="practices.length > 0" class="material-category">
            <h5 class="category-title">
              <span class="category-icon">📝</span>
              Практические задания
            </h5>
            <div class="files-list">
              <div v-for="(file, index) in practices" :key="index" class="file-item">
                <div class="file-info">
                  <span class="file-name">Задание {{ index + 1 }}</span>
                  <span class="file-size" v-if="fileSizes.practices[index]">{{ fileSizes.practices[index] }}</span>
                </div>
                <a :href="file" target="_blank" class="download-button">
                  Скачать
                </a>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Домашнее задание -->
        <div v-if="homeworkData" class="homework-section">
          <h4>Домашнее задание:</h4>
          <div class="homework-content">
            <p class="homework-title">{{ homeworkData.homework_name }}</p>
            <button @click="openHomeworkSimple(homeworkData)" class="download-button homework-button">
              Посмотреть домашнее задание
            </button>
            <div v-if="homeworkData.deadline" class="deadline">
              Срок сдачи: {{ formatDeadline(homeworkData.deadline) }}
            </div>
          </div>
        </div>
        
        <div v-else-if="hasHomework" class="homework-section">
          <h4>Домашнее задание:</h4>
          <div class="homework-content">
            <div v-for="(hw, index) in homeworkArray" :key="index" class="homework-item">
              <p class="homework-text">{{ hw }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, onUnmounted, nextTick } from 'vue'
import { supabase } from '../supabase.js'

const props = defineProps({
  subject: {
    type: String,
    required: true,
    validator: value => value && typeof value === 'string'
  },
  lessonNumber: {
    type: Number,
    required: true,
    validator: value => Number.isInteger(value) && value > 0
  }
})

const emit = defineEmits(['back-to-calendar'])

const lesson = ref(null)
const homeworkData = ref(null)
const loading = ref(false)
const error = ref(null)
const videoRefs = ref([]) // Массив ссылок на видео элементы
const showMessage = ref(false)
const fileSizes = ref({
  workbooks: [],
  practices: []
})
const user = ref(null)
const isAuthenticated = ref(false)

let messageTimer = null

// Компьютеды для работы с массивами
const allVideos = computed(() => {
  if (!lesson.value?.video || !Array.isArray(lesson.value.video)) return []
  return lesson.value.video.map(url => fixVideoUrl(url)).filter(url => url)
})

const workbooks = computed(() => {
  if (!lesson.value?.workbook || !Array.isArray(lesson.value.workbook)) return []
  return lesson.value.workbook
})

const practices = computed(() => {
  if (!lesson.value?.practice || !Array.isArray(lesson.value.practice)) return []
  return lesson.value.practice
})

const homeworkArray = computed(() => {
  if (!lesson.value?.homework) return []
  if (Array.isArray(lesson.value.homework)) return lesson.value.homework
  return [lesson.value.homework]
})

const hasHomework = computed(() => {
  return homeworkArray.value.length > 0
})

const hasMaterials = computed(() => {
  return workbooks.value.length > 0 || practices.value.length > 0
})

// Проверка аутентификации
const checkAuth = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      user.value = session.user
      isAuthenticated.value = true
      return true
    } else {
      isAuthenticated.value = false
      return false
    }
  } catch (err) {
    console.error('Ошибка проверки аутентификации:', err)
    isAuthenticated.value = false
    return false
  }
}

const redirectToLogin = () => {
  window.location.href = '/login.html'
}

const handleBack = () => emit('back-to-calendar')

const openHomeworkSimple = (homework) => {
  try {
    const params = new URLSearchParams({
      subject: `${props.subject}_ege`,
      homework_id: homework.homework_id,
      homework_name: homework.homework_name || 'Домашнее задание',
      lesson_number: homework.lesson_number || lesson.value?.number || '',
      lesson_name: homework.lesson_name || lesson.value?.title || '',
      view_mode: 'student'
    })
    
    window.location.href = `homework.html?${params.toString()}`
  } catch (error) {
    console.error('Ошибка открытия домашнего задания:', error)
    alert('Не удалось открыть домашнее задание.')
  }
}

const formatDeadline = (deadline) => {
  if (!deadline) return ''
  try {
    const date = new Date(deadline)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return deadline
  }
}

const fixVideoUrl = (url) => {
  if (!url) return null
  
  // Если URL уже полный (с http/https), возвращаем как есть
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  
  // Если это просто ключ из storage, формируем CDN URL
  if (url.startsWith('uploads/') || !url.includes('/')) {
    return `https://dff707dc-2d18-472b-b99a-ed9d861c7a4b.selcdn.net/${url}`
  }
  
  // Если URL начинается с double slash, добавляем https:
  if (url.startsWith('//')) {
    return `https:${url}`
  }
  
  return url
}

const getVideoType = (url) => {
  if (!url) return 'video/mp4'
  const extension = url.split('.').pop().toLowerCase()
  switch(extension) {
    case 'mp4': return 'video/mp4'
    case 'webm': return 'video/webm'
    case 'ogg': return 'video/ogg'
    default: return 'video/mp4'
  }
}

// Получение размеров файлов
const getFileSizes = async () => {
  fileSizes.value = { workbooks: [], practices: [] }
  
  // Размеры рабочих тетрадей
  for (const file of workbooks.value) {
    const size = await getFileSize(file)
    fileSizes.value.workbooks.push(size)
  }
  
  // Размеры практических заданий
  for (const file of practices.value) {
    const size = await getFileSize(file)
    fileSizes.value.practices.push(size)
  }
}

const getFileSize = async (url) => {
  if (!url) return null
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (response.ok) {
      const size = response.headers.get('content-length')
      if (size) {
        return formatFileSize(parseInt(size))
      }
    }
    return null
  } catch (error) {
    console.log('Не удалось получить размер файла:', error)
    return null
  }
}

const formatFileSize = (bytes) => {
  if (!bytes) return ''
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

const showProtectionMessage = () => {
  showMessage.value = true
  if (messageTimer) clearTimeout(messageTimer)
  messageTimer = setTimeout(() => {
    showMessage.value = false
  }, 2000)
}

const handleVideoContextMenu = (e) => {
  const videoElement = e.target
  const rect = videoElement.getBoundingClientRect()
  const isClickOnControlBar = e.clientY > rect.top + (rect.height * 0.8)
  
  if (!isClickOnControlBar) {
    e.preventDefault()
    showProtectionMessage()
  }
}

const setupVideoProtection = () => {
  videoRefs.value.forEach(videoElement => {
    if (!videoElement) return
    
    videoElement.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        showProtectionMessage()
      }
    })
    
    videoElement.addEventListener('dragstart', (e) => {
      e.preventDefault()
    })
  })
}

onUnmounted(() => {
  if (messageTimer) clearTimeout(messageTimer)
})

async function fetchLesson() {
  try {
    const authCheck = await checkAuth()
    if (!authCheck) {
      loading.value = false
      return
    }
    
    loading.value = true
    error.value = null
    lesson.value = null
    homeworkData.value = null
    
    const tableName = `${props.subject}_ege`
    
    const { data, error: supabaseError } = await supabase
      .from(tableName)
      .select('number, title, date, video, homework, workbook, practice')
      .eq('number', props.lessonNumber)
      .single()

    if (supabaseError) {
      if (supabaseError.code === 'PGRST116') {
        console.log('Урок не найден, это нормально')
        lesson.value = null
      } else if (supabaseError.code === 'PGRST301' || supabaseError.message.includes('auth')) {
        await checkAuth()
        throw supabaseError
      } else {
        throw supabaseError
      }
    } else {
      lesson.value = {
        ...data,
        video: convertToArray(data.video),
        workbook: convertToArray(data.workbook),
        practice: convertToArray(data.practice),
        homework: convertToArray(data.homework)
      }
      
      await getFileSizes()
      
      nextTick(() => {
        setupVideoProtection()
      })
    }
    
    try {
      await fetchHomework(data?.title)
    } catch (homeworkErr) {
      console.log('Таблица домашних заданий не доступна или пуста:', homeworkErr.message)
      homeworkData.value = null
    }
    
  } catch (err) {
    if (err.code !== 'PGRST116') {
      error.value = err.message
      console.error('Ошибка загрузки урока:', err)
    }
    if (err.message.includes('auth') || err.message.includes('401')) {
      isAuthenticated.value = false
    }
  } finally {
    loading.value = false
  }
}

const convertToArray = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(item => item != null && item !== '')
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item != null && item !== '')
      }
      return value.trim() ? [value] : []
    } catch {
      return value.trim() ? [value] : []
    }
  }
  return []
}

async function fetchHomework(lessonName) {
  if (!lessonName) {
    homeworkData.value = null
    return
  }
  
  try {
    const homeworkTable = `${props.subject}_ege_homework_list`
    
    const { data, error: homeworkError } = await supabase
      .from(homeworkTable)
      .select('homework_id, homework_name, lesson_number, lesson_name, deadline')
      .eq('lesson_name', lessonName)
      .maybeSingle()

    if (homeworkError) {
      console.log('Ошибка загрузки домашнего задания:', homeworkError.message)
      homeworkData.value = null
      return
    }
    
    homeworkData.value = data || null
    
  } catch (err) {
    console.log('Не удалось загрузить домашнее задание:', err.message)
    homeworkData.value = null
  }
}

onMounted(() => {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      user.value = null
      isAuthenticated.value = false
    } else if (event === 'SIGNED_IN' && session) {
      user.value = session.user
      isAuthenticated.value = true
      fetchLesson()
    }
  })
  
  checkAuth().then(authenticated => {
    if (authenticated) {
      fetchLesson()
    }
  })
})

watch(() => props.lessonNumber, (newLessonNumber) => {
  if (newLessonNumber && isAuthenticated.value) {
    fetchLesson()
  }
})

const formattedDate = computed(() => {
  if (!lesson.value?.date) return ''
  const date = new Date(lesson.value.date)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long'
  })
})
</script>

<style scoped>
.lesson-container {
  width: 70%;
  margin: 0 auto;
  padding: 20px;
}

.lesson_info {
  display: grid;
  grid-template-rows: auto;
  gap: 20px;
}

/* Контейнер для всех видео */
.videos-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
  margin-bottom: 20px;
}

.video-item {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e9ecef;
}

.video-title {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 1.2em;
  font-weight: 600;
}

.video-wrapper {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  overflow: hidden;
  border-radius: 8px;
  background: #000;
}

.video-player {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.protection-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(178, 65, 209, 0.9);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  z-index: 20;
  font-weight: bold;
  pointer-events: none;
}

/* Остальные стили остаются без изменений */
.materials-section {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #4CAF50;
}

.homework-section {
  background-color: #fff3e0;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #ff9800;
}

.download-button {
  display: inline-block;
  padding: 8px 16px;
  background-color: #b241d1;
  color: white;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.9em;
  transition: background-color 0.3s ease;
  cursor: pointer;
  border: none;
  white-space: nowrap;
}

.back-button {
  padding: 10px 20px;
  background-color: #b241d1;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 20px;
  color: #fff;
  transition: all 0.3s ease;
}

.back-button:hover {
  background-color: #9a36b3;
}

.error-message {
  color: #ff4757;
  padding: 20px;
  text-align: center;
  background-color: #ffe6e6;
  border-radius: 8px;
  border: 1px solid #ff4757;
}

.auth-message {
  text-align: center;
  padding: 40px;
  background-color: #f8f9fa;
  border-radius: 8px;
  margin: 20px 0;
}

.login-button {
  padding: 10px 20px;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 15px;
}

.login-button:hover {
  background-color: #9a36b3;
}

/* Адаптивность */
@media (max-width: 768px) {
  .lesson-container {
    width: 95%;
    padding: 10px;
  }
  
  .videos-container {
    gap: 20px;
  }
  
  .video-item {
    padding: 15px;
  }
  
  .video-title {
    font-size: 1.1em;
  }
}
</style>