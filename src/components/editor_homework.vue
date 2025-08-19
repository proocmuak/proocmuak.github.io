<template>
  <div class="editor-container">
    <div class="header">
      <div class="title">Редактор Домашек</div>
      <div class="subject-selector">
        <select v-model="selectedSubject" class="subject-dropdown">
          <option value="biology">Биология ЕГЭ</option>
          <option value="chemistry">Химия ЕГЭ</option>
        </select>
      </div>
    </div>
    
    <div class="block_of_content">
      <EgeHomeworkEditor
      :subject="selectedSubject"
      @homework-selected="handleHomeworkSelect"
      />
    </div>
  </div>
</template>

<script>
import EgeHomeworkEditor from './EgeHomeworkEditor.vue'

export default {
  components: {
    EgeHomeworkEditor
  },
  data() {
    return {
      selectedSubject: 'biology' // По умолчанию выбрана биология
    }
  },
    methods: {
    handleHomeworkSelect(homeworkData) {
      console.log('Выбрана домашняя работа:', homeworkData)
      // Здесь можно сохранить данные или выполнить другие действия
    }
  }
}
</script>

<style scoped>
* {
  font-family: Evolventa;
}

.editor-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.title {
  font-size: 2vw;
  font-weight: bold;
  display: flex;
  align-items: center;
}

.subject-selector {
  display: flex;
  align-items: center;
}

.subject-dropdown {
  padding: 8px 16px;
  font-size: 1rem;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.subject-dropdown:hover {
  border-color: #888;
}

.subject-dropdown:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.2);
}

/* Адаптивность для заголовка */
@media (max-width: 768px) {
  .title {
    font-size: 1.5rem;
  }
  
  .header {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 480px) {
  .title {
    font-size: 1.2rem;
  }
}
</style>