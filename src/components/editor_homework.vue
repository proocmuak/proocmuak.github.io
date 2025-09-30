<template>
  <div class="editor-container">
    <div class="header">
      <div class="title">Редактор Домашек</div>
      <div class="subject-selector">
        <select v-model="selectedSubject" class="subject-dropdown">
          <option value="biology_ege">Биология ЕГЭ</option>
          <option value="chemistry_ege">Химия ЕГЭ</option>
          <option value="biology_oge">Биология ОГЭ</option>
          <option value="chemistry_oge">Химия ОГЭ</option>
        </select>
      </div>
    </div>
    
    <div class="block_of_content">
      <EgeHomeworkEditor
      :subject="getSubjectKey(selectedSubject)"
      :exam-type="getExamType(selectedSubject)"
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
      selectedSubject: 'biology_ege' // По умолчанию выбрана биология ЕГЭ
    }
  },
  methods: {
    handleHomeworkSelect(homeworkData) {
      console.log('Выбрана домашняя работа:', homeworkData)
      // Здесь можно сохранить данные или выполнить другие действия
    },
    
    getSubjectKey(subjectValue) {
      if (subjectValue.includes('biology')) return 'biology'
      if (subjectValue.includes('chemistry')) return 'chemistry'
      return 'biology'
    },
    
    getExamType(subjectValue) {
      if (subjectValue.includes('ege')) return 'ege'
      if (subjectValue.includes('oge')) return 'oge'
      return 'ege'
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
  min-width: 200px;
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
  
  .subject-dropdown {
    min-width: 150px;
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .title {
    font-size: 1.2rem;
  }
  
  .subject-dropdown {
    min-width: 120px;
    font-size: 0.8rem;
    padding: 6px 12px;
  }
}
</style>