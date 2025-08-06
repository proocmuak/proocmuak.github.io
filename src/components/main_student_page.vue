<script>
import DailyMotivation from './DailyMotivation.vue';
import subject_chemistry from './subject_chemistry.vue'
import subject_biology from './subject_biology.vue';

export default {
  components: {
    DailyMotivation,
    subject_chemistry,
    subject_biology
  }
}
</script>

<template>
    <div class="title">
        <DailyMotivation />
    </div>
    <div class="block_of_content">
        <subject_chemistry />
        <subject_biology />
    </div>
</template>

<style>
    .title{
        font-size: 2vw;
        font-weight: bold;
        display: flex;
        align-items: center;
        }
    .block_of_content{
        background-color: #f9f8ff;
        margin-bottom: 5%;
        border-radius: 2%;
        display: grid;
        grid-template-columns: 35% 35%;
        gap: 30%;
        padding: 10%;
    }

</style>