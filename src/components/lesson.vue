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
                  <a :href="getProxyUrl(file)" target="_blank" class="download-button">Скачать</a>
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
               <a :href="getProxyUrl(file)" target="_blank" class="download-button">Скачать</a>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Домашнее задание -->
        <div v-if="filteredHomeworkData.length > 0" class="homework-section">
          <h4>Домашние задания:</h4>
          <div class="homework-content">
            <div v-for="(homework, index) in filteredHomeworkData" :key="homework.homework_id || index" class="homework-item">
              <p class="homework-title">{{ homework.homework_name }}</p>
              <button @click="openHomeworkSimple(homework)" class="download-button homework-button">
                Посмотреть домашнее задание
              </button>
              <div v-if="homework.deadline" class="deadline">
                Срок сдачи: {{ formatDeadline(homework.deadline) }}
              </div>
            </div>
          </div>
        </div>
        
        <div v-else-if="hasHomework && isLessonPassed" class="homework-section">
          <h4>Домашнее задание:</h4>
          <div class="homework-content">
            <div v-for="(hw, index) in homeworkArray" :key="index" class="homework-item">
              <p class="homework-text">{{ hw }}</p>
            </div>
          </div>
        </div>

        <!-- Сообщение, если урок еще не прошел -->
        <div v-else-if="hasHomework && !isLessonPassed" class="no-homework-message">
          <h4>Домашнее задание:</h4>
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

// Функция для обработки HTML iframe - фиксируем размер 640x360
const processIframeHtml = (html) => {
  if (!html) return ''
  
  // Устанавливаем фиксированные размеры 640x360
  return html
    .replace(/width="[^"]*"/g, 'width="640"')
    .replace(/height="[^"]*"/g, 'height="360"')
    .replace(/<iframe/, '<iframe style="border: none;"')
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

// Функция для подмены ссылок на проксированные
const getProxyUrl = (url) => {
  if (!url) return '';
  // Если ссылка ведет на supabase storage, заменяем её начало на наш прокси
  if (url.includes('supabase.co/storage/v1/object/public/')) {
    return url.replace('https://mltqewxnxinaytavbmds.supabase.co/storage/v1/object/public/', '/storage/');
  }
  return url;
};

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
    
    console.log(`Загрузка урока из таблицы: ${props.tableName}, номер: ${props.lessonNumber}`)
    
    const { data, error: supabaseError } = await supabase
      .from(props.tableName)
      .select('number, title, date, video, homework, workbook, practice, alternativeLinks')
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
      console.log('Таблица домашних заданий не доступна или пуста:', homeworkErr.message)
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
    // Формируем название таблицы домашних заданий
    const homeworkTable = `${subjectType.value}_${examType.value}_homework_list`
    
    console.log(`Загрузка домашних заданий из таблицы: ${homeworkTable}, урок: ${lessonName}`)
    
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
  text-align: center;
}

.video-wrapper {
  position: relative;
  width: 100%;
  min-height: 400px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.iframe-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 20px;
}

.iframe-content {
  width: 640px;
  height: 360px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.iframe-content iframe {
  width: 640px;
  height: 360px;
  border-radius: 8px;
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

/* Стили для альтернативных ссылок */
.alternative-links {
  margin-top: 15px;
  padding: 12px 15px;
  background: #f5d0ff;
  border-radius: 8px;
  border-left: 4px solid #9a36b3;
}

.links-title {
  font-size: 0.9em;
  font-weight: 600;
  color: #b241d1;
  margin-bottom: 8px;
}

.links-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.alternative-link {
  display: inline-block;
  padding: 5px 12px;
  background: #b241d1;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-size: 0.85em;
  transition: all 0.3s ease;
}

.alternative-link:hover {
  background: #9a36b3;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

/* Стили для материалов */
.materials-section {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #4CAF50;
}

.material-category {
  margin-bottom: 20px;
}

.material-category:last-child {
  margin-bottom: 0;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 1.1em;
}

.category-icon {
  font-size: 1.2em;
}

.files-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.file-name {
  font-weight: 500;
  color: #2c3e50;
}

.file-size {
  font-size: 0.85em;
  color: #666;
}

/* Стили для домашнего задания */
.homework-section {
  background-color: rgba(178, 65, 209, 0.4);
  padding: 20px;
  border-radius: 8px;
}

.homework-content {
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.homework-item {
  padding: 15px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  border: 1px solid #f8f9fa;
}

.homework-title {
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 10px 0;
  font-size: 1.1em;
}

.homework-button {
  align-self: flex-start;
  margin-bottom: 10px;
}

.deadline {
  font-size: 0.9em;
  color: #666;
  font-style: italic;
}

.homework-text {
  margin: 0;
  color: #2c3e50;
}

/* Сообщение о недоступности домашнего задания */
.no-homework-message {
  background-color: #fff3e0;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #ff9800;
  color: #e65100;
}

.no-homework-message h4 {
  margin: 0 0 10px 0;
  color: #e65100;
}

.no-homework-message p {
  margin: 0;
  font-style: italic;
}

/* Кнопки */
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

.download-button:hover {
  background-color: #9a36b3;
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
  
  .video-wrapper {
    min-height: 300px;
  }
  
  .iframe-container {
    padding: 15px;
  }
  
  .iframe-content {
    width: 100%;
    max-width: 640px;
    height: auto;
    aspect-ratio: 16/9;
  }
  
  .iframe-content iframe {
    width: 100%;
    height: 100%;
    max-width: 640px;
    max-height: 360px;
  }
  
  .file-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .download-button {
    align-self: flex-end;
  }
  
  .homework-content {
    gap: 20px;
  }
  
  .homework-item {
    padding: 12px;
  }
  
  .alternative-links {
    margin-top: 12px;
    padding: 10px 12px;
  }
  
  .links-list {
    gap: 8px;
  }
  
  .alternative-link {
    padding: 4px 10px;
    font-size: 0.8em;
  }
}

@media (max-width: 480px) {
  .video-wrapper {
    min-height: 250px;
  }
  
  .iframe-container {
    padding: 10px;
  }
  
  .homework-item {
    padding: 10px;
  }
  
  .homework-title {
    font-size: 1em;
  }
  
  .alternative-links {
    margin-top: 10px;
    padding: 8px 10px;
  }
  
  .links-title {
    font-size: 0.85em;
  }
  
  .alternative-link {
    padding: 3px 8px;
    font-size: 0.75em;
  }
}
</style>