<template>
  <div class="title">
    <DailyMotivation />
  </div>
  
  <div class="teacher-menu">
    <!-- Отображаем редактор, если выбран предмет -->
    <TableEditor
      v-if="activeEditor"
      :table-title="activeEditor.title"
      :table-name="activeEditor.tableName"
      primary-key="number"
      :fields="activeEditor.fields"
      @back-to-edit="activeEditor = null"
    />
    
    <!-- Отображаем редактор дополнительных курсов -->
    <EditorAdditionalCourse
      v-else-if="showAdditionalCourses"
      @back-to-edit="showAdditionalCourses = false"
    />
    
    <!-- Отображаем список предметов, если редактор не активен -->
    <div v-else class="subjects-grid">
      <SubjectButton
        v-for="subject in subjects"
        :key="subject.tableName"
        :subject-name="subject.title"
        @editor-change="activateEditor(subject)"
      />
      <!-- Кнопка для дополнительных курсов -->
      <SubjectButton
        subject-name="Дополнительные курсы"
        @editor-change="openAdditionalCourses"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SubjectButton from './SubjectButton.vue'
import TableEditor from './TableEditor.vue'
import EditorAdditionalCourse from './EditorAdditionalCourse.vue'

// Конфигурация предметов
const subjects = [
  {
    title: 'Химия ЕГЭ',
    tableName: 'chemistry_ege',
    fields: [
      { name: 'number', label: 'Номер', type: 'number', disabled: true },
      { name: 'title', label: 'Название', type: 'text' },
      { name: 'date', label: 'Дата', type: 'date' },
      { name: 'video', label: 'Видео', type: 'text' },
      { name: 'content', label: 'Содержание', type: 'textarea' },
      { name: 'homework', label: 'Домашнее задание', type: 'textarea' },
      { name: 'workbook', label: 'Рабочая тетрадь', type: 'textarea' },
      { name: 'practice', label: 'Практика', type: 'textarea' }
    ]
  },
  {
    title: 'Биология ЕГЭ',
    tableName: 'biology_ege',
    fields: [
      { name: 'number', label: 'Номер', type: 'number', disabled: true },
      { name: 'title', label: 'Название', type: 'text' },
      { name: 'date', label: 'Дата', type: 'date' },
      { name: 'video', label: 'Видео', type: 'text' },
      { name: 'content', label: 'Содержание', type: 'textarea' },
      { name: 'homework', label: 'Домашнее задание', type: 'textarea' },
      { name: 'workbook', label: 'Рабочая тетрадь', type: 'textarea' },
      { name: 'practice', label: 'Практика', type: 'textarea' }
    ]
  },
  {
    title: 'Химия ОГЭ',
    tableName: 'chemistry_oge',
    fields: [
      { name: 'number', label: 'Номер', type: 'number', disabled: true },
      { name: 'title', label: 'Название', type: 'text' },
      { name: 'date', label: 'Дата', type: 'date' },
      { name: 'video', label: 'Видео', type: 'text' },
      { name: 'content', label: 'Содержание', type: 'textarea' },
      { name: 'homework', label: 'Домашнее задание', type: 'textarea' },
      { name: 'workbook', label: 'Рабочая тетрадь', type: 'textarea' },
      { name: 'practice', label: 'Практика', type: 'textarea' }
    ]
  },
  {
    title: 'Биология ОГЭ',
    tableName: 'biology_oge',
    fields: [
      { name: 'number', label: 'Номер', type: 'number', disabled: true },
      { name: 'title', label: 'Название', type: 'text' },
      { name: 'date', label: 'Дата', type: 'date' },
      { name: 'video', label: 'Видео', type: 'text' },
      { name: 'content', label: 'Содержание', type: 'textarea' },
      { name: 'homework', label: 'Домашнее задание', type: 'textarea' },
      { name: 'workbook', label: 'Рабочая тетрадь', type: 'textarea' },
      { name: 'practice', label: 'Практика', type: 'textarea' }
    ]
  }
]

const activeEditor = ref(null)
const showAdditionalCourses = ref(false)

const activateEditor = (subject) => {
  activeEditor.value = subject
}

const openAdditionalCourses = () => {
  showAdditionalCourses.value = true
}
</script>

<script>
import DailyMotivation from './DailyMotivation.vue'

export default {
  components: {
    DailyMotivation,
  }
}
</script>

<style scoped>
* {
  font-family: Evolventa, sans-serif;
  box-sizing: border-box;
}

.title {
  font-size: 2vw;
  font-weight: bold;
  display: flex;
  align-items: center;
  padding: 0 20px;
  margin-bottom: 20px;
}

.teacher-menu {
  padding: 0 20px 20px 20px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.subjects-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
  justify-content: center;
}

/* Адаптивность */
@media (max-width: 1024px) {
  .title {
    font-size: 2.5vw;
  }
  
  .subjects-grid {
    gap: 14px;
  }
}

@media (max-width: 768px) {
  .teacher-menu {
    padding: 0 15px 15px 15px;
  }
  
  .subjects-grid {
    gap: 12px;
  }
  
  .title {
    font-size: 4vw;
    padding: 0 15px;
    margin-bottom: 15px;
  }
}

@media (max-width: 480px) {
  .teacher-menu {
    padding: 0 10px 10px 10px;
  }
  
  .subjects-grid {
    gap: 10px;
  }
  
  .title {
    font-size: 5vw;
    padding: 0 10px;
    margin-bottom: 10px;
  }
}
</style>