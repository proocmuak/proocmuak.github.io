<template>
  <div class="lesson-container">
    <button @click="handleBack" class="back-button">Вернуться к календарю</button>
    <div v-if="loading">Загрузка...</div>
    <div v-else-if="error" class="error-message">Ошибка: {{ error }}</div>
    <div v-else-if="!lesson">Урок не найден</div>
    <div v-else class="lesson_info">
      <h2>Урок {{ lesson.number }}</h2>
      <h3>{{ lesson.title }} ({{ formattedDate }})</h3>
      
      <div v-if="lesson.video" class="video-section">
        <iframe :src="getVideoEmbedUrl(lesson.video)" allow="fullscreen" frameborder="0"></iframe>
      </div>
      
      <div v-if="lesson.content" class="content-section">
        <p>Материалы урока:</p>
        <a v-if="isPdfUrl(lesson.content)" :href="lesson.content" target="_blank" class="download-button">
          Скачать материалы (PDF)
        </a>
        <p v-else>{{ lesson.content }}</p>
      </div>
      
      <div v-if="lesson.homework" class="homework-section">
        <p>Домашнее задание:</p>
        <p>{{ lesson.homework }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { supabase } from '../supabase.js'

const props = defineProps({
  tableName: {
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
const loading = ref(false)
const error = ref(null)

const handleBack = () => emit('back-to-calendar')

const isPdfUrl = (content) => {
  return content?.endsWith('.pdf') || content?.includes('supabase.co/storage')
}

const getVideoEmbedUrl = (url) => {
  if (!url) return ''
  if (url.includes('youtube.com')) return url.replace('watch?v=', 'embed/')
  return url
}

async function fetchLesson() {
  try {
    loading.value = true
    error.value = null
    
    console.log(`Загрузка урока ${props.lessonNumber} из таблицы ${props.tableName}`)
    
    const { data, error: supabaseError } = await supabase
      .from(props.tableName)
      .select('number, title, date, video, content, homework')
      .eq('number', props.lessonNumber)
      .single()

    if (supabaseError) throw supabaseError
    if (!data) throw new Error('Урок не найден')
    
    lesson.value = data
    console.log('Урок загружен:', data)
  } catch (err) {
    error.value = err.message
    console.error('Ошибка загрузки урока:', err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchLesson)
watch(() => props.lessonNumber, fetchLesson)

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
  grid-template-rows: 5% 5% 70% 10% 10%;
  gap: 2%;
}
.video-section iframe {
  width: 100%;
  height: 25vw;
  min-height: 300px;
  border: none;
}
.download-button {
  display: inline-block;
  padding: 8px 16px;
  background-color: #b241d1;
  color: white;
  border-radius: 6px;
  text-decoration: none;
}
.download-button:hover {
  opacity: 0.75;
}
.back-button {
  padding: 8px 16px;
  background-color: #b241d1;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 20px;
  color: #fff;
  transition: all 0.3s ease;
  font-family: Evolventa;
}
.back-button:hover {
  opacity: 0.75;
}
</style>