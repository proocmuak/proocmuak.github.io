<template>
  <div class="lesson-container">
    <button @click="handleBack" class="back-button">Вернуться к календарю</button>
    <div v-if="loading">Загрузка...</div>
    <div v-else-if="error" class="error-message">Ошибка: {{ error }}</div>
    <div v-else-if="!lesson">Урок не найден</div>
    <div v-else class="lesson_info">
      <h2>Урок {{ lesson.number }}</h2>
      <h3>{{ lesson.title }} ({{ formattedDate }})</h3>
      
      <div v-if="lesson.video" class="video-section" @contextmenu.prevent="showProtectionMessage">
        <video
          :key="videoPlayerKey"
          ref="videoRef"
          class="video-js vjs-big-play-centered vjs-custom-skin"
          controls
          preload="auto"
          controlslist="nodownload noremoteplayback"
          disablepictureinpicture
          @contextmenu.prevent="handleVideoContextMenu"
        >
          <source :src="lesson.video" type="video/mp4">
        </video>
        
        <!-- Сообщение о защите -->
        <div v-if="showMessage" class="protection-message">
          Скачивание видео запрещено
        </div>
      </div>
      
      <!-- Секция рабочих материалов -->
      <div v-if="hasMaterials" class="materials-section">
        <h4>Материалы урока:</h4>
        
        <!-- Рабочая тетрадь -->
        <div v-if="lesson.workbook" class="material-item">
          <div class="material-icon">📘</div>
          <div class="material-info">
            <h5>Рабочая тетрадь</h5>
            <a :href="lesson.workbook" target="_blank" class="download-button">
              Скачать рабочую тетрадь
            </a>
            <span class="file-size" v-if="fileSizes.workbook">{{ fileSizes.workbook }}</span>
          </div>
        </div>
        
        <!-- Практика -->
        <div v-if="lesson.practice" class="material-item">
          <div class="material-icon">📝</div>
          <div class="material-info">
            <h5>Практика на занятие</h5>
            <a :href="lesson.practice" target="_blank" class="download-button">
              Скачать практику
            </a>
            <span class="file-size" v-if="fileSizes.practice">{{ fileSizes.practice }}</span>
          </div>
        </div>
      </div>
      
      <!-- Домашнее задание в стиле HomeworkList -->
      <div v-if="homeworkData" class="homework-section homework-card-style">
        <div class="homework-header">
          <h3>{{ homeworkData.homework_name }}</h3>
          <div class="completion-status" :class="getStatusClass(homeworkData)">
            {{ getStatusText(homeworkData) }}
          </div>
        </div>
        
        <p class="lesson-info">Урок {{ homeworkData.lesson_number }}: {{ homeworkData.lesson_name }}</p>
        
        <div class="homework-details">
          <div class="deadline" :class="deadlineStatus(homeworkData.deadline)">
            Дедлайн: {{ formatDate(homeworkData.deadline) }}
          </div>
          
          <div v-if="homeworkData.score !== null" class="score">
            Оценка: {{ homeworkData.score }}
          </div>
        </div>
        
        <a 
          :href="getHomeworkViewUrl(homeworkData)" 
          target="_blank" 
          class="download-button homework-button"
        >
          Посмотреть домашнее задание
        </a>
      </div>
      
      <div v-else-if="lesson.homework" class="homework-section homework-card-style">
        <div class="homework-header">
          <h3>Домашнее задание</h3>
          <div class="completion-status not-completed">
            Не выполнено
          </div>
        </div>
        
        <div class="homework-content">
          <p class="homework-text">{{ lesson.homework }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, onUnmounted, nextTick } from 'vue'
import { supabase } from '../supabase.js'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

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
const videoRef = ref(null)
const videoPlayerKey = ref(0)
const showMessage = ref(false)
const fileSizes = ref({
  workbook: null,
  practice: null
})
const user_id = ref(null)
let player = null
let messageTimer = null

// Настройки video.js
const playerOptions = {
  autoplay: false,
  controls: true,
  responsive: true,
  fluid: true,
  playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
  html5: {
    vhs: {
      overrideNative: true
    },
    nativeAudioTracks: false,
    nativeVideoTracks: false
  },
  userActions: {
    hotkeys: function(event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        showProtectionMessage()
        return false
      }
      return true
    }
  }
}

const handleBack = () => emit('back-to-calendar')

const getHomeworkViewUrl = (homework) => {
  if (!homework) return '#'
  return `/Homework.html?subject=${props.subject}_ege&homework_id=${homework.homework_id}&view_mode=tutor`
}

// Проверка наличия материалов
const hasMaterials = computed(() => {
  return lesson.value?.workbook || lesson.value?.practice
})

// Форматирование дедлайна
const formatDate = (dateString) => {
  if (!dateString) return 'Не указан'
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const deadlineStatus = (dateString) => {
  if (!dateString) return 'no-deadline'
  const deadline = new Date(dateString)
  const today = new Date()
  
  today.setHours(0, 0, 0, 0)
  deadline.setHours(0, 0, 0, 0)
  
  if (deadline < today) return 'overdue'
  if (deadline.getTime() === today.getTime()) return 'today'
  return 'future'
}

const getStatusClass = (homework) => {
  if (homework.is_completed) {
    return homework.score !== null ? 'scored' : 'completed'
  }
  return 'not-completed'
}

const getStatusText = (homework) => {
  if (homework.is_completed) {
    return homework.score !== null ? `Выполнено (${homework.score} баллов)` : 'Выполнено'
  }
  return 'Не выполнено'
}

// Получение ID текущего пользователя
const getCurrentUserId = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
  } catch (err) {
    console.error('Ошибка получения ID пользователя:', err)
    return null
  }
}

// Получение размера файла
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

// Форматирование размера файла
const formatFileSize = (bytes) => {
  if (!bytes) return ''
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

// Показ сообщения о защите
const showProtectionMessage = () => {
  showMessage.value = true
  
  if (messageTimer) {
    clearTimeout(messageTimer)
  }
  
  messageTimer = setTimeout(() => {
    showMessage.value = false
  }, 2000)
}

// Обработчик контекстного меню для видео
const handleVideoContextMenu = (e) => {
  const videoElement = e.target
  const rect = videoElement.getBoundingClientRect()
  const isClickOnControlBar = e.clientY > rect.top + (rect.height * 0.8)
  
  if (!isClickOnControlBar) {
    e.preventDefault()
    showProtectionMessage()
  }
}

// Блокировка горячих клавиш и правого клика
const setupVideoProtection = () => {
  const videoElement = videoRef.value
  
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
  
  videoElement.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      e.preventDefault()
    }
  })
}

// Инициализация video.js плеера
const initVideoPlayer = () => {
  if (videoRef.value && lesson.value?.video) {
    if (player) {
      player.dispose()
      player = null
    }
    
    player = videojs(videoRef.value, playerOptions, function() {
      console.log('Video.js player is ready')
      setupVideoProtection()
      
      this.ready(() => {
        const videoEl = this.el()
        videoEl.classList.add('vjs-protected')
        
        const playbackRateMenu = this.controlBar.getChild('PlaybackRateMenuButton')
        if (playbackRateMenu) {
          playbackRateMenu.removeClass('vjs-hidden')
          playbackRateMenu.show()
        }
      })
    })
    
    player.on('loadstart', () => {
      setupVideoProtection()
    })
  }
}

// Очищаем плеер при размонтировании компонента
onUnmounted(() => {
  if (player) {
    player.dispose()
    player = null
  }
  
  if (messageTimer) {
    clearTimeout(messageTimer)
  }
})

async function fetchLesson() {
  try {
    loading.value = true
    error.value = null
    lesson.value = null
    fileSizes.value = { workbook: null, practice: null }
    
    const tableName = `${props.subject}_ege`
    console.log(`Загрузка урока ${props.lessonNumber} из таблицы ${tableName}`)
    
    const { data, error: supabaseError } = await supabase
      .from(tableName)
      .select('number, title, date, video, homework, workbook, practice')
      .eq('number', props.lessonNumber)
      .single()

    if (supabaseError) throw supabaseError
    if (!data) throw new Error('Урок не найден')
    
    lesson.value = data
    console.log('Урок загружен:', data)
    
    // Получаем размеры файлов
    if (data.workbook) {
      fileSizes.value.workbook = await getFileSize(data.workbook)
    }
    if (data.practice) {
      fileSizes.value.practice = await getFileSize(data.practice)
    }
    
    videoPlayerKey.value++
    
    nextTick(() => {
      initVideoPlayer()
    })
    
    try {
      await fetchHomework(data.title)
    } catch (homeworkErr) {
      console.log('Таблица домашних заданий не доступна:', homeworkErr.message)
      homeworkData.value = null
    }
  } catch (err) {
    error.value = err.message
    console.error('Ошибка загрузки урока:', err)
  } finally {
    loading.value = false
  }
}

async function fetchHomework(lessonName) {
  try {
    console.log(`Поиск домашнего задания для урока: ${lessonName}`)
    
    const homeworkTable = `${props.subject}_ege_homework_list`
    user_id.value = await getCurrentUserId()
    
    // Получаем данные о домашнем задании
    const { data: homeworkListData, error: homeworkError } = await supabase
      .from(homeworkTable)
      .select('homework_id, homework_name, lesson_number, lesson_name, deadline')
      .eq('lesson_name', lessonName)

    if (homeworkError) {
      console.log('Ошибка загрузки домашнего задания:', homeworkError.message)
      homeworkData.value = null
      return
    }
    
    if (homeworkListData && homeworkListData.length > 0) {
      const homework = homeworkListData[0]
      
      // Получаем данные о выполнении
      if (user_id.value) {
        const { data: completionData } = await supabase
          .from(`${props.subject}_ege_homework_completed`)
          .select('is_completed, score')
          .eq('homework_id', homework.homework_id)
          .eq('user_id', user_id.value)
          .single()

        homeworkData.value = {
          ...homework,
          is_completed: completionData?.is_completed || false,
          score: completionData?.score || null
        }
      } else {
        homeworkData.value = {
          ...homework,
          is_completed: false,
          score: null
        }
      }
      
      console.log('Домашнее задание найдено:', homeworkData.value)
    } else {
      console.log('Домашнее задание не найдено для урока:', lessonName)
      homeworkData.value = null
    }
  } catch (err) {
    console.error('Ошибка загрузки домашнего задания:', err)
    homeworkData.value = null
  }
}

onMounted(fetchLesson)

watch(() => props.lessonNumber, (newLessonNumber) => {
  if (newLessonNumber) {
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

.video-section {
  position: relative;
  width: 100%;
  height: 25vw;
  min-height: 300px;
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

/* Стили для секции материалов */
.materials-section {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #4CAF50;
}

.materials-section h4 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 1.2em;
}

.material-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 15px;
  padding: 15px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.material-item:last-child {
  margin-bottom: 0;
}

.material-icon {
  font-size: 24px;
  margin-right: 15px;
  flex-shrink: 0;
}

.material-info {
  flex-grow: 1;
}

.material-info h5 {
  margin: 0 0 8px 0;
  color: #34495e;
  font-size: 1.1em;
}

.file-size {
  display: block;
  margin-top: 5px;
  font-size: 0.9em;
  color: #7f8c8d;
}

/* Стили для домашнего задания в стиле HomeworkList */
.homework-card-style {
  background-color: #b241d1;
  border-radius: 12px;
  padding: 20px;
  color: white;
  box-shadow: 0 4px 12px rgba(178, 65, 209, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  min-height: auto;
}

.homework-card-style:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(178, 65, 209, 0.3);
}

.homework-card-style.completed {
  background-color: #f9f8ff;
  color: #000000;
  box-shadow: 0 4px 12px rgba(249, 248, 255, 0.3);
}

.homework-card-style.completed:hover {
  box-shadow: 0 6px 16px rgba(249, 248, 255, 0.4);
}

.homework-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 10px;
}

.homework-header h3 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  flex: 1;
  line-height: 1.4;
  word-wrap: break-word;
}

.homework-card-style:not(.completed) .homework-header h3 {
  color: #ffffff;
}

.homework-card-style.completed .homework-header h3 {
  color: #000000;
}

.completion-status {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.homework-card-style:not(.completed) .completion-status {
  background-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.homework-card-style.completed .completion-status {
  background-color: rgba(178, 65, 209, 0.1);
  color: #000000;
}

.homework-card-style.completed .completion-status.scored {
  background-color: rgba(178, 65, 209, 0.2);
}

.lesson-info {
  margin: 0 0 12px 0;
  font-size: 0.95rem;
  line-height: 1.4;
  opacity: 0.9;
}

.homework-card-style:not(.completed) .lesson-info {
  color: rgba(255, 255, 255, 0.9);
}

.homework-card-style.completed .lesson-info {
  color: rgba(0, 0, 0, 0.8);
}

.homework-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 15px;
}

.deadline {
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
}

.homework-card-style:not(.completed) .deadline {
  background-color: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.homework-card-style.completed .deadline {
  background-color: rgba(178, 65, 209, 0.1);
  color: #000000;
}

.homework-card-style:not(.completed) .deadline.overdue {
  background-color: rgba(255, 255, 255, 0.25);
}

.homework-card-style.completed .deadline.overdue {
  background-color: rgba(178, 65, 209, 0.2);
}

.homework-card-style:not(.completed) .deadline.today {
  background-color: rgba(255, 255, 255, 0.2);
}

.homework-card-style.completed .deadline.today {
  background-color: rgba(178, 65, 209, 0.15);
}

.homework-card-style:not(.completed) .deadline.future {
  background-color: rgba(255, 255, 255, 0.1);
}

.homework-card-style.completed .deadline.future {
  background-color: rgba(178, 65, 209, 0.05);
}

.homework-card-style:not(.completed) .deadline.no-deadline {
  background-color: rgba(255, 255, 255, 0.05);
}

.homework-card-style.completed .deadline.no-deadline {
  background-color: rgba(178, 65, 209, 0.02);
}

.score {
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
}

.homework-card-style:not(.completed) .score {
  background-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.homework-card-style.completed .score {
  background-color: rgba(178, 65, 209, 0.2);
  color: #000000;
}

.homework-content {
  background: white;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 15px;
}

.homework-text {
  margin: 0;
  color: #34495e;
  line-height: 1.5;
}

.homework-button {
  display: inline-block;
  padding: 10px 20px;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  transition: background-color 0.3s ease;
}

.homework-card-style:not(.completed) .homework-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.homework-card-style.completed .homework-button {
  background-color: rgba(178, 65, 209, 0.2);
  color: #000000;
}

.homework-card-style.completed .homework-button:hover {
  background-color: rgba(178, 65, 209, 0.3);
}

/* Кастомные стили для video.js */
.vjs-custom-skin {
  border-radius: 8px;
  overflow: hidden;
}

:deep(.vjs-protected .video-js) {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  -webkit-user-drag: none !important;
  -khtml-user-drag: none !important;
  -moz-user-drag: none !important;
  -o-user-drag: none !important;
}

:deep(.vjs-protected video) {
  pointer-events: none !important;
}

:deep(.vjs-protected .vjs-control-bar),
:deep(.vjs-protected .vjs-big-play-button) {
  pointer-events: auto !important;
}

:deep(.video-js) {
  width: 100%;
  height: 100%;
}

:deep(.vjs-big-play-button) {
  background-color: rgba(178, 65, 209, 0.8);
  border: none;
  border-radius: 50%;
}

:deep(.vjs-big-play-button:hover) {
  background-color: rgba(178, 65, 209, 1);
}

.download-button {
  display: inline-block;
  padding: 10px 20px;
  background-color: #b241d1;
  color: white;
  border-radius: 6px;
  text-decoration: none;
  margin-top: 8px;
  font-size: 0.9em;
  transition: background-color 0.3s ease;
}

.download-button:hover {
  background-color: #9a36b3;
  color: white;
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
  font-family: Evolventa;
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

/* Адаптивность */
@media (max-width: 768px) {
  .lesson-container {
    width: 90%;
    padding: 15px;
  }
  
  .homework-header {
    flex-direction: column;
    gap: 8px;
  }
  
  .homework-details {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .homework-card-style {
    padding: 15px;
  }
}

@media (max-width: 480px) {
  .lesson-container {
    width: 95%;
    padding: 10px;
  }
  
  .homework-card-style {
    padding: 12px;
  }
  
  .homework-header h3 {
    font-size: 1.1rem;
  }
}
</style>