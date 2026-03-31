<template>
  <div class="lessons-container">
    <UniversalLesson
      v-if="selectedLesson"
      :table-name="courseEnglishName"
      :subject="courseName"
      :lesson-number="selectedLesson"
      @back-to-calendar="selectedLesson = null"
    />
    
    <template v-else>
      <div v-if="loading" class="loading-message">Загрузка уроков...</div>
      <div v-else-if="error" class="error-message">{{ error }}</div>
      <div v-else-if="!hasAccess" class="no-access-message">
        <p>У вас нет доступа к этому курсу</p>
        <p class="small-text">Обратитесь к администратору для получения доступа</p>
      </div>
      <div v-else-if="lessons.length === 0" class="no-lessons">
        Нет доступных уроков
      </div>
      
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
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase.js'
import UniversalLesson from './lesson.vue'

const props = defineProps({
  courseName: {
    type: String,
    required: true
  },
  courseEnglishName: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['select-lesson'])

const lessons = ref([])
const selectedLesson = ref(null)
const loading = ref(false)
const error = ref(null)
const hasCourseAccess = ref(false)

const selectLesson = (number) => {
  selectedLesson.value = number
  emit('select-lesson', number)
}


const hasAccess = computed(() => {
  return true
})

// Загрузка данных студента - проверяем доступ к дополнительному курсу
async function fetchStudentData() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Пользователь не авторизован')
    }

    const { data, error: studentError } = await supabase
      .from('students')
      .select('additional_courses')
      .eq('user_id', user.id)
      .single()

    if (studentError) throw studentError
    
    // Проверяем, есть ли курс в списке дополнительных курсов студента
    let additionalCourses = []
    if (data?.additional_courses) {
      try {
        additionalCourses = typeof data.additional_courses === 'string' 
          ? JSON.parse(data.additional_courses) 
          : data.additional_courses
      } catch (e) {
        console.error('Ошибка парсинга additional_courses:', e)
        additionalCourses = []
      }
    }
    
    // Проверяем, что курс есть в списке
    hasCourseAccess.value = additionalCourses.includes(props.courseName)

  } catch (err) {
    console.error('Ошибка загрузки данных студента:', err)
    hasCourseAccess.value = false
  }
}

async function fetchLessons() {
  try {
    loading.value = true
    error.value = null
    
    const { data, error: supabaseError } = await supabase
      .from(props.courseEnglishName)
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

const dateStatus = (dateString) => {
  if (!dateString) return ''
  const lessonDate = new Date(dateString)
  const today = new Date()
  lessonDate.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return lessonDate > today ? 'future-date' : 'past-date'
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
  transform: translateY(-2px);
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
  padding: 40px;
  text-align: center;
  font-size: 1.2rem;
  margin-top: 50px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.error-message {
  color: #ff4444;
  background-color: #fff5f5;
}

.no-access-message {
  color: #ff9800;
  background-color: #fff3e0;
  border-radius: 8px;
  border-left: 4px solid #ff9800;
}

.no-access-message .small-text {
  font-size: 0.9rem;
  margin-top: 10px;
  opacity: 0.8;
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
  
  .lesson-card h3 {
    font-size: 1rem;
  }
  
  .lesson-card p {
    font-size: 0.9rem;
  }
}
</style>