<template>
  <div class="lessons-container">
    <UniversalLesson
      v-if="selectedLesson"
      table-name="chemistry_ege"
      :subject="subject"
      :lesson-number="selectedLesson"
      @back-to-calendar="selectedLesson = null"
    />
    
    <template v-else>
      <div v-if="loading" class="loading-message">Загрузка уроков...</div>
      <div v-else-if="error" class="error-message">{{ error }}</div>
      <div v-else-if="!hasAccess" class="no-access-message">
        Уроки будут доступны с {{ formatAccessDate(studentAccessFrom) }}
      </div>
      <div v-else-if="filteredLessons.length === 0" class="no-lessons">Нет доступных уроков</div>
      
      <div v-else class="lessons-grid">
        <div 
          v-for="lesson in filteredLessons" 
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
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase.js'
import UniversalLesson from './lesson.vue'

const lessons = ref([])
const selectedLesson = ref(null)
const loading = ref(false)
const error = ref(null)
const subject = ref('chemistry')
const studentAccessFrom = ref(null)
const studentData = ref(null)

const selectLesson = (number) => {
  selectedLesson.value = number
}

// Проверяем, есть ли у студента доступ к урокам химии
const hasAccess = computed(() => {
  if (!studentAccessFrom.value) return false
  
  const today = new Date()
  const accessDate = new Date(studentAccessFrom.value)
  
  // Сбрасываем время для корректного сравнения дат
  today.setHours(0, 0, 0, 0)
  accessDate.setHours(0, 0, 0, 0)
  
  return today >= accessDate
})

// Фильтруем уроки по дате доступа
const filteredLessons = computed(() => {
  if (!hasAccess.value || !studentAccessFrom.value) return []
  
  const accessDate = new Date(studentAccessFrom.value)
  
  return lessons.value.filter(lesson => {
    if (!lesson.date) return false
    
    const lessonDate = new Date(lesson.date)
    return lessonDate >= accessDate
  })
})

// Загрузка данных студента - для химии используем subject1_access_from
async function fetchStudentData() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Пользователь не авторизован')
    }

    const { data, error: studentError } = await supabase
      .from('students')
      .select('subject1_access_from, subject1')
      .eq('user_id', user.id)
      .single()

    if (studentError) throw studentError
    
    studentData.value = data
    
    // Для химии используем subject1_access_from
    // Также проверяем, что предмет1 установлен как химия
    if (data?.subject1 && data.subject1.includes('Химия')) {
      studentAccessFrom.value = data?.subject1_access_from
    } else {
      studentAccessFrom.value = null
    }
    
  } catch (err) {
    console.error('Ошибка загрузки данных студента:', err)
    // Если нет доступа к данным студента, показываем все уроки
    studentAccessFrom.value = null
  }
}

async function fetchLessons() {
  try {
    loading.value = true
    error.value = null
    
    
    const { data, error: supabaseError } = await supabase
      .from('chemistry_ege')
      .select('number, title, date')
      .order('number', { ascending: true })

    if (supabaseError) throw supabaseError
    
    lessons.value = data || []  
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

const formatAccessDate = (dateString) => {
  if (!dateString) return 'даты не указана'
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const dateStatus = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString) > new Date() ? 'future-date' : 'past-date'
}

onMounted(async () => {
  await fetchStudentData()
  await fetchLessons()
})
</script>

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

.loading-message,
.error-message,
.no-lessons,
.no-access-message {
  padding: 20px;
  text-align: center;
  font-size: 1.2rem;
  margin-top: 50px;
}

.error-message {
  color: #ff4444;
}

.no-access-message {
  color: #ff9800;
  background-color: #fff3e0;
  border-radius: 8px;
  border-left: 4px solid #ff9800;
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