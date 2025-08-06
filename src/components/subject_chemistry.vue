<template>
    <div class="block">
        <div class="subject_name">Химия ЕГЭ</div>
        <div class="score">Количество баллов: 745</div>
        <div class="rating">Место в рейтинге: 1</div>
        <div class="button">Перейти</div>
    </div>
</template>

<style>
.block{
    background-color: #b241d1;
    border-radius: 5%;
    padding: 5%;
    color: white;
    display: grid;
    grid-template-rows: 10% 20% 20% 10%;
    gap: 10%;
}
.subject_name{ 
    font-size: 1.5vw;
    font-weight: bold;
    border-bottom: #fff solid 0.25vh;
}
.button{
    background-color: #fff;
    color: black;
    display: grid;
    justify-content: center;
    align-items: center;
    border-radius: 5vw; 
}

</style>