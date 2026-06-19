<template>
  <div class="lesson-container">
    <button @click="handleBack" class="back-button">Вернуться к календарю</button>
    
    <div v-if="!isAuthenticated" class="auth-message">
      <p>Пожалуйста, войдите в систему для просмотра уроков</p>
      <button @click="redirectToLogin" class="login-button">Войти</button>
    </div>
    
    <div v-else>
      <div v-if="loading" class="loading-spinner-container">
        <div class="spinner"></div>
        <p>Загрузка...</p>
      </div>
      <div v-else-if="error" class="error-message">Ошибка: {{ error }}</div>
      <div v-else-if="!lesson" class="not-found">Урок не найден</div>
      <div v-else class="lesson_info">
        <div class="lesson-header">
          <h2>Урок {{ lesson.number }}</h2>
          <h3>{{ lesson.title }}</h3>
          <span class="lesson-date">{{ formattedDate }}</span>
        </div>
        
        <!-- Все видео отображаются последовательно -->
        <div v-if="allVideos.length > 0" class="videos-container">
          <div v-for="(videoHtml, index) in allVideos" :key="index" class="video-item">
            <h4 class="video-title">Видео {{ index + 1 }}</h4>
            <div class="video-wrapper" @contextmenu.prevent="showProtectionMessage">
              <div class="iframe-container">
                <div v-html="processIframeHtml(videoHtml)" class="iframe-content"></div>
              </div>
              
              <!-- Сообщение о защите -->
              <div v-if="showMessage" class="protection-message">
                Скачивание видео запрещено
              </div>
            </div>
            
            <!-- Альтернативные ссылки -->
            <div v-if="alternativeLinks.length > 0" class="alternative-links">
              <div class="links-title">Альтернативные ссылки:</div>
              <div class="links-list">
                <a 
                  v-for="(link, linkIndex) in alternativeLinks" 
                  :key="linkIndex"
                  :href="link" 
                  target="_blank" 
                  class="alternative-link"
                >
                  Ссылка {{ linkIndex + 1 }}
                </a>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Секция рабочих материалов -->
        <div v-if="hasMaterials" class="materials-section">
          <h4 class="section-title">Материалы урока</h4>
          
          <!-- Рабочие тетради -->
          <div v-if="workbooks.length > 0" class="material-category">
            <h5 class="category-title">Рабочие тетради</h5>
            <div class="files-list">
              <div v-for="(file, index) in workbooks" :key="index" class="file-item">
                <div class="file-info">
                  <span class="file-name">Тетрадь {{ index + 1 }}</span>
                  <span class="file-size" v-if="fileSizes.workbooks[index]">{{ fileSizes.workbooks[index] }}</span>
                </div>
                <a :href="getProxyUrl(file)" target="_blank" class="download-button">Скачать</a>
              </div>
            </div>
          </div>
          
          <!-- Практические задания -->
          <div v-if="practices.length > 0" class="material-category">
            <h5 class="category-title">Практические задания</h5>
            <div class="files-list">
              <div v-for="(file, index) in practices" :key="index" class="file-item">
                <div class="file-info">
                  <span class="file-name">Задание {{ index + 1 }}</span>
                  <span class="file-size" v-if="fileSizes.practices[index]">{{ fileSizes.practices[index] }}</span>
                </div>
                <a :href="getProxyUrl(file)" target="_blank" class="download-button">Скачать</a>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Домашнее задание -->
        <div v-if="filteredHomeworkData.length > 0" class="homework-section">
          <h4 class="section-title">Домашние задания</h4>
          <div class="homework-content">
            <div v-for="(homework, index) in filteredHomeworkData" :key="homework.homework_id || index" class="homework-item">
              <p class="homework-title">{{ homework.homework_name }}</p>
              <button @click="openHomeworkSimple(homework)" class="homework-button">
                Посмотреть домашнее задание
              </button>
              <div v-if="homework.deadline" class="deadline">
                Срок сдачи: {{ formatDeadline(homework.deadline) }}
              </div>
            </div>
          </div>
        </div>
        
        <div v-else-if="hasHomework && isLessonPassed" class="homework-section">
          <h4 class="section-title">Домашнее задание</h4>
          <div class="homework-content">
            <div v-for="(hw, index) in homeworkArray" :key="index" class="homework-item">
              <p class="homework-text">{{ hw }}</p>
            </div>
          </div>
        </div>

        <!-- Сообщение, если урок еще не прошел -->
        <div v-else-if="hasHomework && !isLessonPassed" class="no-homework-message">
          <h4 class="section-title">Домашнее задание</h4>
          <p>Домашнее задание станет доступно после проведения урока ({{ formattedDate }})</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import { supabase } from '../supabase.js'

const props = defineProps({
  tableName: {
    type: String,
    required: true,
    validator: value => value && typeof value === 'string'
  },
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
const homeworkData = ref([])
const loading = ref(false)
const error = ref(null)
const showMessage = ref(false)
const fileSizes = ref({
  workbooks: [],
  practices: []
})
const user = ref(null)
const isAuthenticated = ref(false)

let messageTimer = null

// Определяем тип экзамена и предмета
const examType = computed(() => {
  return props.tableName.includes('_ege') ? 'ege' : 'oge'
})

const subjectType = computed(() => {
  return props.tableName.includes('biology') ? 'biology' : 'chemistry'
})

// Проверка, прошел ли урок
const isLessonPassed = computed(() => {
  if (!lesson.value?.date) return false
  
  const today = new Date()
  const lessonDate = new Date(lesson.value.date)
  
  today.setHours(0, 0, 0, 0)
  lessonDate.setHours(0, 0, 0, 0)
  
  return lessonDate <= today
})

// Фильтруем домашние задания - показываем только для прошедших уроков
const filteredHomeworkData = computed(() => {
  if (!isLessonPassed.value) return []
  return homeworkData.value
})

// Компьютеды для работы с массивами
const allVideos = computed(() => {
  if (!lesson.value?.video || !Array.isArray(lesson.value.video)) return []
  return lesson.value.video.filter(html => html && typeof html === 'string')
})

// Альтернативные ссылки
const alternativeLinks = computed(() => {
  if (!lesson.value?.alternativeLinks || !Array.isArray(lesson.value.alternativeLinks)) return []
  return lesson.value.alternativeLinks.filter(link => link && typeof link === 'string' && link.trim() !== '')
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

// Функция для обработки HTML iframe
const processIframeHtml = (html) => {
  if (!html) return ''
  return html
    .replace(/width="[^"]*"/g, 'width="100%"')
    .replace(/height="[^"]*"/g, 'height="100%"')
    .replace(/<iframe/, '<iframe style="border: none; width: 100%; height: 100%; aspect-ratio: 16/9;"')
}

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
      subject: `${subjectType.value}_${examType.value}`,
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

// Получение размеров файлов
const getFileSizes = async () => {
  fileSizes.value = { workbooks: [], practices: [] }
  
  for (const file of workbooks.value) {
    const size = await getFileSize(file)
    fileSizes.value.workbooks.push(size)
  }
  
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

const getProxyUrl = (url) => {
  if (!url) return '';
  if (url.includes('supabase.co/storage/v1/object/public/')) {
    return url.replace('https://mltqewxnxinaytavbmds.supabase.co/storage/v1/object/public/', '/storage/');
  }
  return url;
}

const showProtectionMessage = () => {
  showMessage.value = true
  if (messageTimer) clearTimeout(messageTimer)
  messageTimer = setTimeout(() => {
    showMessage.value = false
  }, 2000)
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
    homeworkData.value = []
    
    const { data, error: supabaseError } = await supabase
      .from(props.tableName)
      .select('number, title, date, video, homework, workbook, practice, alternativeLinks')
      .eq('number', props.lessonNumber)
      .single()

    if (supabaseError) {
      if (supabaseError.code === 'PGRST116') {
        console.log('Урок не найден')
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
        alternativeLinks: convertToArray(data.alternativeLinks),
        workbook: convertToArray(data.workbook),
        practice: convertToArray(data.practice),
        homework: convertToArray(data.homework)
      }
      
      await getFileSizes()
    }
    
    try {
      await fetchHomework(data?.title)
    } catch (homeworkErr) {
      console.log('Таблица домашних заданий не доступна:', homeworkErr.message)
      homeworkData.value = []
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
    homeworkData.value = []
    return
  }
  
  try {
    const homeworkTable = `${subjectType.value}_${examType.value}_homework_list`
    
    const { data, error: homeworkError } = await supabase
      .from(homeworkTable)
      .select('homework_id, homework_name, lesson_number, lesson_name, deadline')
      .eq('lesson_name', lessonName)
      .order('created_at', { ascending: true })

    if (homeworkError) {
      console.log('Ошибка загрузки домашнего задания:', homeworkError.message)
      homeworkData.value = []
      return
    }
    
    homeworkData.value = data || []
    
  } catch (err) {
    console.log('Не удалось загрузить домашнее задание:', err.message)
    homeworkData.value = []
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

watch(() => props.tableName, () => {
  if (isAuthenticated.value) {
    fetchLesson()
  }
})

const formattedDate = computed(() => {
  if (!lesson.value?.date) return ''
  const date = new Date(lesson.value.date)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
})
</script>

<style scoped>
.lesson-container {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

/* ===== КНОПКА НАЗАД ===== */
.back-button {
  padding: 10px 20px;
  background-color: #b241d1;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 20px;
  color: white;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.back-button:hover {
  background-color: #9a36b8;
}

/* ===== ЗАГОЛОВОК УРОКА ===== */
.lesson-header {
  background-color: #f9f8ff;
  padding: 20px 24px;
  border-radius: 12px;
  border: 1px solid #e8d4f2;
  margin-bottom: 24px;
}

.lesson-header h2 {
  font-size: 24px;
  color: #5a2d7a;
  margin: 0 0 4px 0;
}

.lesson-header h3 {
  font-size: 18px;
  color: #7e3f9d;
  margin: 0 0 8px 0;
  font-weight: 500;
}

.lesson-date {
  display: inline-block;
  background: rgba(178, 65, 209, 0.1);
  color: #7e3f9d;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 14px;
}

/* ===== ВИДЕО ===== */
.videos-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 24px;
}

.video-item {
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e9ecef;
}

.video-title {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 16px;
  font-weight: 600;
}

.video-wrapper {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.iframe-container {
  width: 100%;
  aspect-ratio: 16/9;
}

.iframe-content {
  width: 100%;
  height: 100%;
}

.iframe-content iframe {
  width: 100%;
  height: 100%;
  border: none;
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

/* ===== АЛЬТЕРНАТИВНЫЕ ССЫЛКИ ===== */
.alternative-links {
  margin-top: 12px;
  padding: 12px 16px;
  background: #f5d0ff;
  border-radius: 8px;
  border-left: 4px solid #9a36b3;
}

.links-title {
  font-size: 14px;
  font-weight: 600;
  color: #b241d1;
  margin-bottom: 6px;
}

.links-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.alternative-link {
  display: inline-block;
  padding: 4px 12px;
  background: #b241d1;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-size: 13px;
  transition: background-color 0.3s ease;
}

.alternative-link:hover {
  background: #9a36b3;
}

/* ===== СЕКЦИЯ МАТЕРИАЛОВ ===== */
.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 16px 0;
}

.materials-section {
  background: #f8f9fa;
  padding: 20px 24px;
  border-radius: 12px;
  border-left: 4px solid #4CAF50;
  margin-bottom: 24px;
}

.material-category {
  margin-bottom: 16px;
}

.material-category:last-child {
  margin-bottom: 0;
}

.category-title {
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 12px 0;
}

.files-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  color: #2c3e50;
  font-size: 14px;
}

.file-size {
  font-size: 12px;
  color: #999;
}

/* ===== ДОМАШНЕЕ ЗАДАНИЕ ===== */
.homework-section {
  background: rgba(178, 65, 209, 0.08);
  padding: 20px 24px;
  border-radius: 12px;
  border: 1px solid rgba(178, 65, 209, 0.15);
  margin-bottom: 24px;
}

.homework-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.homework-item {
  padding: 16px 20px;
  background: white;
  border-radius: 10px;
  border: 1px solid #f0e6f7;
}

.homework-title {
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 10px 0;
  font-size: 15px;
}

.homework-button {
  display: inline-block;
  padding: 6px 16px;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.3s ease;
  margin-bottom: 8px;
}

.homework-button:hover {
  background-color: #9a36b8;
}

.deadline {
  font-size: 13px;
  color: #666;
  font-style: italic;
}

.homework-text {
  margin: 0;
  color: #2c3e50;
  font-size: 14px;
  line-height: 1.5;
}

/* ===== СООБЩЕНИЕ О НЕДОСТУПНОСТИ ===== */
.no-homework-message {
  background: #fff3e0;
  padding: 20px 24px;
  border-radius: 12px;
  border-left: 4px solid #ff9800;
  color: #e65100;
  margin-bottom: 24px;
}

.no-homework-message p {
  margin: 0;
  font-style: italic;
  font-size: 14px;
}

/* ===== ЗАГРУЗКА ===== */
.loading-spinner-container {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #f0e6f7;
  border-top: 4px solid #b241d1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ===== УРОК НЕ НАЙДЕН ===== */
.not-found {
  text-align: center;
  padding: 40px 20px;
  background: #f8f9fa;
  border-radius: 12px;
  font-size: 18px;
  color: #666;
}

/* ===== ОШИБКА ===== */
.error-message {
  color: #ff4757;
  padding: 20px;
  text-align: center;
  background: #ffe6e6;
  border-radius: 8px;
  border: 1px solid #ff4757;
}

/* ===== АУТЕНТИФИКАЦИЯ ===== */
.auth-message {
  text-align: center;
  padding: 40px;
  background: #f8f9fa;
  border-radius: 12px;
  margin: 20px 0;
}

.auth-message p {
  font-size: 16px;
  color: #666;
  margin: 0 0 16px 0;
}

.login-button {
  padding: 10px 24px;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.login-button:hover {
  background-color: #9a36b8;
}

/* ============================================ */
/* АДАПТИВНОСТЬ */
/* ============================================ */

@media (max-width: 768px) {
  .lesson-container {
    padding: 12px;
  }
  
  .back-button {
    padding: 8px 16px;
    font-size: 13px;
    width: 100%;
  }
  
  .lesson-header {
    padding: 16px 18px;
    border-radius: 10px;
  }
  
  .lesson-header h2 {
    font-size: 20px;
  }
  
  .lesson-header h3 {
    font-size: 16px;
  }
  
  .video-item {
    padding: 14px;
    border-radius: 10px;
  }
  
  .video-title {
    font-size: 14px;
  }
  
  .materials-section {
    padding: 16px 18px;
    border-radius: 10px;
  }
  
  .homework-section {
    padding: 16px 18px;
    border-radius: 10px;
  }
  
  .homework-item {
    padding: 14px 16px;
  }
  
  .file-item {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .file-info {
    flex-wrap: wrap;
  }
  
  .download-button {
    align-self: flex-start;
    color: #b241d1;
  }
  
  .alternative-links {
    padding: 10px 12px;
  }
  
  .alternative-link {
    font-size: 12px;
    padding: 3px 10px;
  }
}

@media (max-width: 480px) {
  .lesson-container {
    padding: 8px;
  }
  
  .back-button {
    font-size: 12px;
    padding: 8px 14px;
  }
  
  .lesson-header {
    padding: 12px 14px;
    border-radius: 8px;
  }
  
  .lesson-header h2 {
    font-size: 18px;
  }
  
  .lesson-header h3 {
    font-size: 14px;
  }
  
  .lesson-date {
    font-size: 12px;
    padding: 3px 10px;
  }
  
  .video-item {
    padding: 10px;
    border-radius: 8px;
  }
  
  .video-title {
    font-size: 13px;
  }
  
  .materials-section {
    padding: 12px 14px;
    border-radius: 8px;
  }
  
  .homework-section {
    padding: 12px 14px;
    border-radius: 8px;
  }
  
  .homework-item {
    padding: 12px 14px;
  }
  
  .homework-title {
    font-size: 14px;
  }
  
  .homework-button {
    font-size: 12px;
    padding: 5px 12px;
  }
  
  .file-item {
    padding: 8px 12px;
  }
  
  .file-name {
    font-size: 13px;
  }
  
  .section-title {
    font-size: 16px;
  }
  
  .category-title {
    font-size: 14px;
  }
  
  .alternative-link {
    font-size: 11px;
    padding: 3px 8px;
  }
  
  .no-homework-message {
    padding: 14px 16px;
  }
  
  .no-homework-message p {
    font-size: 13px;
  }
}
</style>