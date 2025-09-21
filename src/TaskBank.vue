<template>
    <div class="allpage">
        <div class="topmenu">
            <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
            <div class="rightparttopmenu">
                <div class="redirect_menu" @click="redirectToMenu" >На главную</div>
                <div class="go_back"><a href="/index.html">Выйти</a></div>
            </div>
        </div> 

       <div class="main_part_page">
            <StudentFilterMenu  @filters-changed="handleFiltersChange" />
            
            <TaskList :filters="currentFilters" @task-selected="handleTaskSelect" />
        </div>
    </div>
</template>

<script>
import StudentFilterMenu  from './components/filter_student_menu.vue';
import TaskList from './components/TaskList.vue';
import {supabase} from './supabase.js';

export default {
    components: {
        StudentFilterMenu,
        TaskList
    },
    data() {
        return {
            currentFilters: {}
        };
    },
    methods: {
        handleFiltersChange(filters) {
            this.currentFilters = filters;
        },
        handleTaskSelect(task) {
            // Обработка выбора задания
            console.log('Выбрано задание:', task);
            // Можно открыть модальное окно или перейти на страницу задания
        }, 
async redirectToMenu() {
  try {
    // 1. Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) throw userError;
    if (!user) {
      // Если пользователь не авторизован, перенаправляем на страницу входа
      window.location.href = '/login.html';
      return;
    }

    // 2. Запрашиваем данные о роли пользователя
    const { data: personalityData, error: personalityError } = await supabase
      .from('personalities')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (personalityError) throw personalityError;
    if (!personalityData) {
      alert('Профиль пользователя не найден');
      return;
    }

    // 3. Перенаправляем в зависимости от роли
    switch(personalityData.role) {
      case 'student':
        window.location.href = '/student_menu.html';
        break;
      case 'teacher':
        window.location.href = '/teacher_menu.html';
        break;
      case 'tutor':
        window.location.href = '/tutor_menu.html';
        break;
      default:
        alert('Неизвестная роль пользователя');
    }
  } catch (err) {
    console.error('Ошибка при перенаправлении:', err);
    alert('Произошла ошибка при переходе на главную');
  }
}
    }
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
    background-size: cover;
    background-position:center;
    background-repeat: no-repeat;
    font-family: Evolventa;
    width: 100%;
    height: 100%;
}
a{
    color: white;
    text-decoration: none;
}

.allpage{
    display: grid;
    height: 100vh;
    grid-template-rows: 7% 90%;
    gap: 0px;
}
.topmenu{
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: 20% 22%;
    column-gap: 55%;
    padding-left: 8%;
    color: white;
    font-size: 1.25vw;
    background-image: url(./assets/background_line.png);
    background-size: cover;
    background-position:center;
    background-repeat: no-repeat;
}
.logo{
    display: grid;
    place-content: center;
}
.rightparttopmenu{
    display: grid; 
    grid-template-columns: 30% 25%;
    column-gap: 7%;
    font-size: 1vw;
}
.redirect_menu{
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    color: white;
    cursor: pointer;
}
.go_back{
    display: grid;
    place-items: center;
}
</style>