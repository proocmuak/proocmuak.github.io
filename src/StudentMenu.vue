<script>
import Left_student_menu from './components/left_student_menu.vue';
import settings from './components/settings.vue';
import main_student_page from './components/main_student_page.vue';
import SubjectRating from './components/SubjectRating.vue';
import HomeworkList from './components/HomeworkList.vue';

export default{
    components: {
        Left_student_menu,
        settings,
        main_student_page,
        SubjectRating, 
        HomeworkList,
        
    },
    data() {
    return {
      currentComponent: main_student_page // Изначально ничего не отображается
    }
  },
  methods: {
    setCurrentComponent(componentName) {
      this.currentComponent = componentName; // Меняем компонент
    }
  }
}


</script>

<template>
    <div class="allpage">
        <div class="topmenu">
            <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
            <div class="rightparttopmenu">
                <div class="courses">Курсы</div>
                <div class="go_back"><a href="index.html">Выйти</a></div>
            </div>
        </div> 
        <div class="centerpartpage">
            <Left_student_menu @component-change="setCurrentComponent"/>
            <div class="mainpart">
        <component :is="currentComponent" />
    </div>
        </div>
    

    
    
    </div>

</template>

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
    background: white;
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
    grid-template-rows: 7% 81% 12%;
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
    grid-template-columns: 25% 30%;
    column-gap: 7%;
    font-size: 1vw;
}
.courses{
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
}
.go_back{
    display: grid;
    place-items: center;
}
.centerpartpage{
    height: 100%;
    width: 100%;
    display: grid;
    grid-template-columns: 20% 63%;
    padding-left: 8%;
    padding-top: 2%;
    gap: 5%;
}
.mainpart{
    display: grid;
    grid-template-rows: 10% 85%;
    gap: 1%;
}
</style>