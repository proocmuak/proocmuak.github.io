<template>
  <div class="lessons-container">
    <UniversalLesson
      v-if="selectedLesson"
      table-name="biology_ege"
      :lesson-number="selectedLesson"
      @back-to-calendar="selectedLesson = null"
    />
    
    <template v-else>
      <div v-if="loading" class="loading-message">Загрузка уроков...</div>
      <div v-else-if="error" class="error-message">{{ error }}</div>
      <div v-else-if="lessons.length === 0" class="no-lessons">Нет доступных уроков</div>
      
      <div v-else class="lessons-grid">
        <div 
          v-for="lesson in lessons" 
          :key="lesson.number"
          class="lesson-card"
          @click="selectLesson(lesson.number)"
        >
          <h3>Урок {{ lesson.number }}</h3>
          <p>{{ lesson.title }}</p>
          <div class="lesson-date" :class="dateStatus(lesson.date)">
            {{ formatDate(lesson.date) }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase.js'
import UniversalLesson from './lesson.vue'

const lessons = ref([])
const selectedLesson = ref(null)
const loading = ref(false)
const error = ref(null)

const selectLesson = (number) => {
  console.log('Выбран урок:', number)
  selectedLesson.value = number
}

async function fetchLessons() {
  try {
    loading.value = true
    error.value = null
    
    console.log('Загрузка списка уроков...')
    
    const { data, error: supabaseError } = await supabase
      .from('biology_ege')
      .select('number, title, date')
      .order('number', { ascending: true })

    if (supabaseError) throw supabaseError
    
    lessons.value = data || []
    console.log('Уроки загружены:', data)
  } catch (err) {
    error.value = err.message
    console.error('Ошибка загрузки уроков:', err)
  } finally {
    loading.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'Дата не указана'
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long'
  })
}

const dateStatus = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString) > new Date() ? 'future-date' : 'past-date'
}

onMounted(fetchLessons)
</script>

<style scoped>
/* Добавьте эти стили для сообщений */
.loading-message,
.error-message,
.no-lessons {
  padding: 20px;
  text-align: center;
  font-size: 1.2rem;
}

.error-message {
  color: #ff4444;
}

/* Остальные стили остаются без изменений */
</style>
<style scoped>
.lessons-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.lessons-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 20px;
}

.lesson-card {
  background-color: #b241d1;
  border-radius: 8px;
  padding: 15px;
  transition: all 0.3s ease;
  cursor: pointer;
  min-height: 120px;
  display: flex;
  flex-direction: column;
}

.lesson-card:hover {
  opacity: 0.75;
}

.lesson-card h3 {
  margin: 0 0 8px 0;
  color: white;
  font-size: 1.2rem;
}

.lesson-card p {
  margin: 0 0 8px 0;
  color: #f9f8ff;
  font-size: 1rem;
  flex-grow: 1;
}

.lesson-date {
  margin-top: auto;
  font-weight: 500;
  font-size: 0.9em;
}

.future-date {
  color: #f9f8ff;
}

.past-date {
  color: #f9f8ff;
  opacity: 0.7;
}

@media (max-width: 900px) {
  .lessons-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .lessons-grid {
    grid-template-columns: 1fr;
  }
  
  .lesson-card {
    min-height: 100px;
    padding: 12px;
  }
}
</style>