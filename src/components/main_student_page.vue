<script>
import DailyMotivation from './DailyMotivation.vue';
import subject_chemistry from './subject_chemistry.vue'
import subject_biology from './subject_biology.vue';

export default {
  components: {
    DailyMotivation,
    subject_chemistry,
    subject_biology
  },
  data() {
    return {
      chemistryHasData: false,
      biologyHasData: false,
      showNoCoursesMessage: false
    }
  },
  methods: {
    handleChemistryData(hasData) {
      this.chemistryHasData = hasData;
      this.checkCoursesAvailability();
    },
    handleBiologyData(hasData) {
      this.biologyHasData = hasData;
      this.checkCoursesAvailability();
    },
    checkCoursesAvailability() {
      // Проверяем после небольшой задержки, чтобы оба компонента успели загрузиться
      setTimeout(() => {
        this.showNoCoursesMessage = !this.chemistryHasData && !this.biologyHasData;
      }, 5000);
    }
  }
}
</script>

<template>
  <div class="title">
    <DailyMotivation />
  </div>
  
  <div v-if="showNoCoursesMessage" class="no-courses-message">
    Нет информации о доступных курсах, обратитесь к учителю
  </div>
  
  <div v-else class="block_of_content">
    <subject_chemistry 
      @has-data="handleChemistryData(true)"
      @no-data="handleChemistryData(false)"
    />
    <subject_biology 
      @has-data="handleBiologyData(true)"
      @no-data="handleBiologyData(false)"
    />
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

  .no-courses-message {
    text-align: center;
    padding: 40px;
    font-size: 1.5rem;
    color: #666;
    background-color: #f8f9fa;
    border-radius: 10px;
    margin: 20px 0;
  }
</style>