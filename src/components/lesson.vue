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
              <h5>Практика к занятию</h5>
              <a :href="lesson.practice" target="_blank" class="download-button">
                Скачать практику
              </a>
              <span class="file-size" v-if="fileSizes.practice">{{ fileSizes.practice }}</span>
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
        
        <div v-else-if="lesson.homework" class="homework-section">
          <h4>Домашнее задание:</h4>
          <div class="homework-content">
            <p class="homework-text">{{ lesson.homework }}</p>
          </div>
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
const user = ref(null)
const isAuthenticated = ref(false)

let player = null
let messageTimer = null

// Настройки video.js с поддержкой скорости воспроизведения
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
      // Блокировка горячих клавиш для скачивания
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        showProtectionMessage()
        return false
      }
      return true
    }
  }
}

// Проверка аутентификации пользователя
const checkAuth = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      user.value = session.user
      isAuthenticated.value = true
      return true
    } else {
      // Не перенаправляем автоматически, показываем сообщение
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

// Функция для получения access token
const getAccessToken = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  } catch (error) {
    console.error('Ошибка получения токена:', error)
    return ''
  }
}

// Открытие домашнего задания с проверкой авторизации
// const openHomework = async (homework) => {
//   try {
//     const token = await getAccessToken()
//     const params = new URLSearchParams({
//       subject: `${props.subject}_ege`,
//       homework_id: homework.homework_id,
//       view_mode: 'student',
//       access_token: token
//     })
    
//     const url = `/Homework.html?${params.toString()}`
//     window.open(url, '_blank')
//   } catch (error) {
//     console.error('Ошибка открытия домашнего задания:', error)
//     alert('Не удалось открыть домашнее задание. Пожалуйста, войдите в систему.')
//   }
// }
const openHomeworkSimple = (homework) => {
  try {
    // Формируем URL с параметрами
    const params = new URLSearchParams({
      subject: `${props.subject}_ege`,
      homework_id: homework.homework_id,
      view_mode: 'student',
      // Добавляем случайное число чтобы избежать кэширования
      r: Math.random().toString(36).substring(7)
    })
    
    // Просто переходим на homework.html с параметрами
    window.location.href = `/homework.html`
    
  } catch (error) {
    console.error('Ошибка открытия домашнего задания:', error)
    alert('Не удалось открыть домашнее задание.')
  }
}
// Проверка наличия материалов
const hasMaterials = computed(() => {
  return lesson.value?.workbook || lesson.value?.practice
})

// Форматирование дедлайна
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
    // Проверяем аутентификацию перед загрузкой данных
    const authCheck = await checkAuth()
    if (!authCheck) {
      loading.value = false
      return
    }
    
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

    if (supabaseError) {
      // Если ошибка доступа, проверяем аутентификацию
      if (supabaseError.code === 'PGRST301' || supabaseError.message.includes('auth')) {
        await checkAuth()
      }
      throw supabaseError
    }
    
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
    
    // Если ошибка аутентификации, показываем сообщение
    if (err.message.includes('auth') || err.message.includes('401')) {
      isAuthenticated.value = false
    }
  } finally {
    loading.value = false
  }
}

async function fetchHomework(lessonName) {
  try {
    console.log(`Поиск домашнего задания для урока: ${lessonName}`)
    
    const homeworkTable = `${props.subject}_ege_homework_list`
    
    const { data, error: homeworkError } = await supabase
      .from(homeworkTable)
      .select('homework_id, homework_name, lesson_number, lesson_name, deadline')
      .eq('lesson_name', lessonName)

    if (homeworkError) {
      console.log('Ошибка загрузки домашнего задания:', homeworkError.message)
      homeworkData.value = null
      return
    }
    
    if (data && data.length > 0) {
      homeworkData.value = data[0]
      console.log('Домашнее задание найдено:', data[0])
    } else {
      console.log('Домашнее задание не найдено для урока:', lessonName)
      homeworkData.value = null
    }
  } catch (err) {
    console.error('Ошибка загрузки домашнего задания:', err)
    homeworkData.value = null
  }
}

// Слушатель изменения состояния аутентификации
onMounted(() => {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event)
    if (event === 'SIGNED_OUT') {
      user.value = null
      isAuthenticated.value = false
    } else if (event === 'SIGNED_IN' && session) {
      user.value = session.user
      isAuthenticated.value = true
      fetchLesson()
    }
  })
  
  // Первоначальная проверка аутентификации
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

/* Стили для домашнего задания */
.homework-section {
  background-color: #fff3e0;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #ff9800;
}

.homework-section h4 {
  margin: 0 0 15px 0;
  color: #e65100;
  font-size: 1.2em;
}

.homework-content {
  background: white;
  padding: 15px;
  border-radius: 6px;
}

.homework-title {
  font-weight: 600;
  color: #34495e;
  margin: 0 0 10px 0;
}

.homework-text {
  margin: 0;
  color: #34495e;
  line-height: 1.5;
}

.homework-button {
  margin-top: 10px;
  cursor: pointer;
  border: none;
}

.deadline {
  margin-top: 10px;
  padding: 8px;
  background-color: #fff8e1;
  border-radius: 4px;
  color: #f57c00;
  font-size: 0.9em;
  border-left: 3px solid #ffb300;
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
  cursor: pointer;
  border: none;
  font-family: inherit;
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
  font-family: Evolventa;
}

.login-button:hover {
  background-color: #9a36b3;
}
</style>