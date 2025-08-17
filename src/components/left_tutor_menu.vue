<script setup>
import { ref, onMounted, defineEmits } from 'vue'
import { supabase } from '../supabase.js'

const emit = defineEmits(['component-change'])

const userEmail = ref('')
const firstName = ref('Добавьте имя')
const lastName = ref('в настройках')
const loading = ref(true)
const error = ref(null)

const switchComponent = (componentName) => {
  emit('component-change', componentName)
}

onMounted(async () => {
  try {
    userEmail.value = localStorage.getItem('userEmail') || ''
    
    if (!userEmail.value) {
      throw new Error('Email не найден в localStorage')
    }

    const { data, error: supabaseError } = await supabase
      .from('personalities')
      .select('first_name, last_name')
      .eq('email', userEmail.value)
      .single()

    if (supabaseError) throw supabaseError
    
    if (!data) {
      firstName.value = 'Добавьте имя'
      lastName.value = 'в настройках'
      return
    }

    firstName.value = data.first_name || 'Добавьте имя'
    lastName.value = data.last_name || 'В настройках'
    
  } catch (err) {
    console.error('Ошибка:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="leftpartpage">
    <div class="leftmenu">
      <div class="about_student_big" @click="switchComponent('main_tutor_page')">
        <div class="avatar" @click="switchComponent('main_tutor_page')"><img src="../assets/avatar/panda.png" class="photo_avatar"></div>
        <div class="about_student" @click="switchComponent('main_tutor_page')">
            <div class="user-info" 
     :class="{ 'settings-message': firstName === 'Добавьте имя' && lastName === 'в настройках' }" @click="switchComponent('main_student_page')">
  {{ firstName }} {{ lastName }}
</div>
          <div class="number_of_points">5465 баллов</div>
        </div>
      </div>

      <div class="line"></div>
      <div class="menu">
        <div class="menu_button" @click="switchComponent('editor_students')">Мои ученики</div>
        <div class="menu_button">Все домашние задания</div>
        <div class="menu_button"><a href="/task_bank.html" class="black_text_a">Банк заданий</a></div>
        <button @click="switchComponent('editor_bank_task')" class="menu_button">Редактор банка заданий</button>
        <div class="menu_button">Уведомления</div>
        <button @click="switchComponent('settings')" class="menu_button">Настройки</button>
        <div class="exit">Выйти</div>
      </div>
    </div>
    
    <div class="aboutcourses">
      <div class="about_courses_bold">Курсы по химии и биологии</div>  
      <div class="second_line"></div>
      <div class="about_courses_main_text">Неонлайн школа Purto, текст про курсы</div>
      <div class="about_courses_button_chose">Выбрать курс</div> 
    </div>
  </div>
</template>

<style>.leftpartpage{
    display: grid;
    place-content: center;
    grid-template-rows: 40% 55%;
    gap: 5%;
}
.error-message {
  color: #ff0000;
  padding: 10px;
  background-color: #ffeeee;
  border-radius: 4px;
  margin: 10px 0;
}
.leftmenu{
    display: grid;
    grid-template-rows: 20% 0.65% 60%;
    gap: 7.5%;
    background-color: #f9f8ff;
    border-radius: 5%;
}

.about_student_big{
    display: grid;
    align-items: center;
    grid-template-columns: 25% 70%;
    gap: 5%;
    padding-left: 10%;
    padding-top: 2%;
    cursor: pointer;
}
.photo_avatar{
    height: 7vh;
    width: 7vh;
}
.about_student{
    display: grid;
    grid-template-rows: 45% 15%;
    gap: 5%;
}

.number_of_points{
    font-size: 0.9vw;
}
.line{
    background-color: #b241d1;
    width: 80%;
    margin-left: 10%;
}
.second_line{
    background-color: #b241d1;
    width: 100%;
}
.menu{
    display: grid;
    grid-template-rows: 12% 12% 12% 12% 12% 12% 12% 12% 12%;
    gap: 3%;
    padding-left: 10%;
}
.menu_button{
    background-color: #f9f8ff;
    border: 0px;
    font-family: Evolventa;
    font-size: 1.75vh;
    cursor: pointer;
    width: fit-content;
}
.aboutcourses{
    background-color: #f9f8ff;
    display: grid;
    grid-template-rows: 18% 0.5% 50% 12%;
    gap: 2%;
    padding-left: 10%;
    padding-right: 5%;
    padding-top: 5%;
    border-radius: 5%;
}
.about_courses_bold{
    font-size: 1.5vw;
    font-weight: bold;
}
.about_courses_main_text{
    font-size: 1vw;
}
.about_courses_button_chose{
    color: white;
    background-color: #b241d1;
    display: grid;
    place-content: center;
    border-radius: 5vw;
}
.user-info{
    font-weight: bold;
}
.user-info.settings-message {
  color: #b241d1; /* Красный цвет */
  font-size: 1.5vh;
  font-weight: bold;

  animation: pulse 1.5s infinite;
}
.black_text_a{
    color: black;
}
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}
</style>