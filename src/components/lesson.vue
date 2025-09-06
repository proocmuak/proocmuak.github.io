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

        <!-- VK Видео через iframe -->
        <div v-if="vkVideos.length" class="videos-container">
          <div v-for="(video, index) in vkVideos" :key="index" class="video-item">
            <h4 class="video-title">Видео {{ index + 1 }}</h4>
            <div class="video-wrapper">
              <iframe
                :src="`https://vk.com/video${video.owner_id}_${video.video_id}`"
                width="100%" height="100%"
                frameborder="0"
                allowfullscreen
              ></iframe>
            </div>
          </div>
        </div>

        <!-- Материалы -->
        <div v-if="hasMaterials" class="materials-section">
          <h4>Материалы урока:</h4>

          <div v-if="workbooks.length" class="material-category">
            <h5 class="category-title">
              <span class="category-icon">📘</span> Рабочие тетради
            </h5>
            <div class="files-list">
              <div v-for="(file, index) in workbooks" :key="index" class="file-item">
                <div class="file-info">
                  <span class="file-name">Тетрадь {{ index + 1 }}</span>
                  <span class="file-size" v-if="fileSizes.workbooks[index]">{{ fileSizes.workbooks[index] }}</span>
                </div>
                <a :href="file" target="_blank" class="download-button">Скачать</a>
              </div>
            </div>
          </div>

          <div v-if="practices.length" class="material-category">
            <h5 class="category-title">
              <span class="category-icon">📝</span> Практические задания
            </h5>
            <div class="files-list">
              <div v-for="(file, index) in practices" :key="index" class="file-item">
                <div class="file-info">
                  <span class="file-name">Задание {{ index + 1 }}</span>
                  <span class="file-size" v-if="fileSizes.practices[index]">{{ fileSizes.practices[index] }}</span>
                </div>
                <a :href="file" target="_blank" class="download-button">Скачать</a>
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
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase.js'

const props = defineProps({
  subject: { type: String, required: true },
  lessonNumber: { type: Number, required: true }
})
const emit = defineEmits(['back-to-calendar'])

const lesson = ref(null)
const homeworkData = ref(null)
const loading = ref(false)
const error = ref(null)
const isAuthenticated = ref(true)
const fileSizes = ref({ workbooks: [], practices: [] })

const vkVideos = computed(() => {
  if (!lesson.value?.video) return []
  return lesson.value.video
    .map(parseVkVideoUrl)
    .filter(v => v !== null)
})

const workbooks = computed(() => lesson.value?.workbook || [])
const practices = computed(() => lesson.value?.practice || [])
const homeworkArray = computed(() => lesson.value?.homework ? [].concat(lesson.value.homework) : [])
const hasHomework = computed(() => homeworkArray.value.length > 0)
const hasMaterials = computed(() => workbooks.value.length > 0 || practices.value.length > 0)

const redirectToLogin = () => { window.location.href = '/login.html' }
const handleBack = () => emit('back-to-calendar')
const openHomeworkSimple = (homework) => {
  const params = new URLSearchParams({
    subject: `${props.subject}_ege`,
    homework_id: homework.homework_id,
    homework_name: homework.homework_name || 'Домашнее задание',
    lesson_number: homework.lesson_number || lesson.value?.number || '',
    lesson_name: homework.lesson_name || lesson.value?.title || '',
    view_mode: 'student'
  })
  window.location.href = `homework.html?${params.toString()}`
}
const formatDeadline = (d) => d ? new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

async function fetchLesson() {
  try {
    loading.value = true
    const tableName = `${props.subject}_ege`
    const { data, error: supabaseError } = await supabase.from(tableName)
      .select('number, title, date, video, homework, workbook, practice')
      .eq('number', props.lessonNumber)
      .single()
    if (supabaseError) throw supabaseError

    lesson.value = {
      ...data,
      video: convertToArray(data.video),
      workbook: convertToArray(data.workbook),
      practice: convertToArray(data.practice),
      homework: convertToArray(data.homework)
    }

    await getFileSizes()
    await fetchHomeworkData(data?.title)

  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const convertToArray = val => {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [val] }
}

// Парсинг ссылки VK видео → { owner_id, video_id }
function parseVkVideoUrl(url) {
  if (!url) return null
  const match = url.match(/video(\-?\d+)_([0-9]+)/)
  if (match && match.length === 3) return { owner_id: match[1], video_id: match[2] }
  return null
}

// Получение размеров файлов
const getFileSizes = async () => {
  fileSizes.value = { workbooks: [], practices: [] }
  for (const file of workbooks.value) fileSizes.value.workbooks.push(await getFileSize(file))
  for (const file of practices.value) fileSizes.value.practices.push(await getFileSize(file))
}
const getFileSize = async (url) => {
  if (!url) return null
  try {
    const res = await fetch(url, { method: 'HEAD' })
    const size = res.headers.get('content-length')
    return size ? formatFileSize(parseInt(size)) : null
  } catch { return null }
}
const formatFileSize = (bytes) => {
  if (!bytes) return ''
  const sizes = ['Б','КБ','МБ','ГБ']
  const i = Math.floor(Math.log(bytes)/Math.log(1024))
  return Math.round(bytes/Math.pow(1024,i)*100)/100 + ' ' + sizes[i]
}

// Домашнее задание
async function fetchHomeworkData(lessonName) {
  if (!lessonName) { homeworkData.value = null; return }
  try {
    const homeworkTable = `${props.subject}_ege_homework_list`
    const { data } = await supabase.from(homeworkTable)
      .select('homework_id, homework_name, lesson_number, lesson_name, deadline')
      .eq('lesson_name', lessonName)
      .maybeSingle()
    homeworkData.value = data || null
  } catch { homeworkData.value = null }
}

onMounted(() => fetchLesson())

const formattedDate = computed(() => {
  if (!lesson.value?.date) return ''
  const date = new Date(lesson.value.date)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
})
</script>

<style scoped>
.lesson-container { width: 70%; margin: 0 auto; padding: 20px; }
.lesson_info { display: grid; grid-template-rows: auto; gap: 20px; }

.videos-container { display: flex; flex-direction: column; gap: 30px; margin-bottom: 20px; }
.video-item { background: #f8f9fa; border-radius: 12px; padding: 20px; border: 1px solid #e9ecef; }
.video-title { margin: 0 0 15px 0; color: #2c3e50; font-size: 1.2em; font-weight: 600; }
.video-wrapper { position: relative; width: 100%; height: 0; padding-bottom: 56.25%; overflow: hidden; border-radius: 8px; background: #000; }
.video-wrapper iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }

.materials-section { background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50; }
.homework-section { background-color: #fff3e0; padding: 20px; border-radius: 8px; border-left: 4px solid #ff9800; }

.download-button { display: inline-block; padding: 8px 16px; background-color: #b241d1; color: white; border-radius: 6px; text-decoration: none; font-size: 0.9em; transition: 0.3s; cursor: pointer; border: none; white-space: nowrap; }
.back-button { padding: 10px 20px; background-color: #b241d1; border: none; border-radius: 6px; cursor: pointer; margin-bottom: 20px; color: #fff; transition: 0.3s; }
.back-button:hover { background-color: #9a36b3; }

.error-message { color: #ff4757; padding: 20px; text-align: center; background-color: #ffe6e6; border-radius: 8px; border: 1px solid #ff4757; }
.auth-message { text-align: center; padding: 40px; background-color: #f8f9fa; border-radius: 8px; margin: 20px 0; }
.login-button { padding: 10px 20px; background-color: #b241d1; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 15px; }
.login-button:hover { background-color: #9a36b3; }

@media (max-width: 768px) {
  .lesson-container { width: 95%; padding: 10px; }
  .videos-container { gap: 20px; }
  .video-item { padding: 15px; }
  .video-title { font-size: 1.1em; }
}
</style>
