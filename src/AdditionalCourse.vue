<template>
  <div class="go_back">
    <a href="../student_menu.html">Вернуться на главный экран</a>
  </div>
  <div class="additional-course-container">
    <CalendarAdditionalCourse 
      v-if="!currentLessonNumber"
      :course-name="courseName"
      :course-english-name="courseEnglishName"
      @select-lesson="handleLessonSelect"
    />
    <LessonAdditionalCourse 
      v-else
      :lesson-number="currentLessonNumber"
      :course-english-name="courseEnglishName"
      :course-name="courseName"
      @back-to-calendar="currentLessonNumber = null"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import CalendarAdditionalCourse from './components/calendar_additional_course.vue'
import LessonAdditionalCourse from './components/lesson_additional_course.vue'

const currentLessonNumber = ref(null)
const courseName = ref('')
const courseEnglishName = ref('')

// Получаем параметр course из URL
const urlParams = new URLSearchParams(window.location.search)
courseEnglishName.value = urlParams.get('course') || ''

// Загружаем информацию о курсе
async function loadCourseInfo() {
  try {
    const { data, error } = await supabase
      .from('additional_course')
      .select('name')
      .eq('english_name', courseEnglishName.value)
      .single()
    
    if (!error && data) {
      courseName.value = data.name
      document.title = `${data.name} - Дополнительный курс`
    }
  } catch (err) {
    console.error('Ошибка загрузки информации о курсе:', err)
  }
}

const handleLessonSelect = (number) => {
  currentLessonNumber.value = number
}

onMounted(async () => {
  await loadCourseInfo()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

@font-face {
  font-family: Evolventa;
  src: local("Evolventa"), url("/src/assets/evolventa/Evolventa-Regular.woff");
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: Evolventa;
  src: local("Evolventa Oblique"), url("/src/assets/evolventa/Evolventa-Oblique.woff");
  font-weight: normal;
  font-style: italic;
}

@font-face {
  font-family: Evolventa;
  src: local("Evolventa Bold"), url("/src/assets/evolventa/Evolventa-Bold.woff");
  font-weight: bold;
  font-style: normal;
}

@font-face {
  font-family: Evolventa;
  src: local("Evolventa Bold Oblique"), url("/src/assets/evolventa/Evolventa-BoldOblique.woff");
  font-weight: bold;
  font-style: italic;
}

body {
  background-image: url(/src/assets/background.png);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  font-family: Evolventa;
  width: 100%;
  height: 100%;
}

.additional-course-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.go_back {
  margin: 2%;
  width: 17vw;
  color: white;
  border-radius: 5px;
  background-color: #b241d1;
  height: 2vw;
  display: grid;
  align-items: center;
  justify-content: center;
}

a {
  color: white;
  text-decoration: none;
}

@media (max-width: 768px) {
  .go_back {
    width: 40vw;
    height: 5vw;
    font-size: 0.9rem;
  }
}
</style>