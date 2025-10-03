<template>
  <div class="task-bank">
    <filter_menu @filters-changed="handleFiltersChanged" />
    <TeacherTaskList 
      :filters="filters"
      :homework-id="homeworkId"
      :homework-name="homeworkName"
      :subject="subject"
      :exam-type="examType"
    />
  </div>
</template>

<script>
import filter_menu from './components/filter_menu.vue';
import TeacherTaskList from './components/TeacherTaskList.vue';

export default {
    name: 'TeacherTaskBank',
    components: {
        filter_menu,
        TeacherTaskList
    },
    props: {
      homeworkId: {
        type: Number,
        required: true
      },
      homeworkName: {
        type: String,
        required: true
      },
      subject: {
        type: String,
        required: true
      },
      examType: {
        type: String,
        required: true
      }
    },
    data() {
        return {
            filters: {
              subject: null,
              sections: [],
              topics: [],
              part: null,
              taskNumber: null,
              difficulty: null,
              showCompleted: 'all'
            }
        };
    }, 
    created() {
      // Формируем полное название предмета для фильтров
      const subjectNames = {
        'biology': 'Биология',
        'chemistry': 'Химия'
      };
      const examTypeNames = {
        'ege': 'ЕГЭ',
        'oge': 'ОГЭ'
      };
      
      this.filters.subject = `${subjectNames[this.subject]} ${examTypeNames[this.examType]}`;
    },
    methods: {
        handleFiltersChanged(newFilters) {
          this.filters = { ...this.filters, ...newFilters };
        }
    }
}
</script>

<style scoped>
.task-bank {
  width: 100%;
  height: 100%;
}
</style>