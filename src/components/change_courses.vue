<template>
    <div class="title"> <DailyMotivation /> </div>
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
    
    <!-- Отображаем список предметов, если редактор не активен -->
    <div v-else class="subjects-grid">
      <SubjectButton
        v-for="subject in subjects"
        :key="subject.tableName"
        :subject-name="subject.title"
        @editor-change="activateEditor(subject)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SubjectButton from './SubjectButton.vue'
import TableEditor from './TableEditor.vue'


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
      { name: 'homework', label: 'Домашнее задание', type: 'textarea' }
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
      { name: 'homework', label: 'Домашнее задание', type: 'textarea' }
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
      { name: 'homework', label: 'Домашнее задание', type: 'textarea' }
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
      { name: 'homework', label: 'Домашнее задание', type: 'textarea' }
    ]
  },
]

const activeEditor = ref(null)

const activateEditor = (subject) => {
  activeEditor.value = subject
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

<style>
    .title{
        font-size: 2vw;
        font-weight: bold;
        display: flex;
        align-items: center;
        }

.teacher-menu {
  padding: 20px;
}

.subjects-grid {
  display: grid;
  grid-template-columns: 20% 20% 20% 21%;
  gap: 5%;
  height: 70%;
}
</style>