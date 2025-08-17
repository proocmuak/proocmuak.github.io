<template>
    <div class="go_back"> <a href="../student_menu.html">Вернуться на главный экран</a>  </div>
  <div class="chemistry-container">
    <CalendarChemistryOge 
      v-if="!currentLessonNumber"
      @select-lesson="handleLessonSelect"
    />
    <LessonChemistryOge 
      v-else
      :lessonNumber="currentLessonNumber"
      @back-to-calendar="currentLessonNumber = null"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CalendarChemistryOge from './components/calendar_chemistry_oge.vue'
import LessonChemistryOge from './components/lesson.vue'

const currentLessonNumber = ref(null)

const handleLessonSelect = (number) => {
  currentLessonNumber.value = number
}
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
    background-position:center;
    background-repeat: no-repeat;
    font-family: Evolventa;
    width: 100%;
    height: 100%;
}
.chemistry-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
.go_back{
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
a{
    color: white;
    text-decoration: none;
}
</style>