<template>
  <div class="homework-editor">
    <!-- Основной редактор -->
    <div v-if="!showTaskEditor">
      <div class="header">
        <h2>Редактор домашних работ по {{ subjectName }}</h2>
        <button @click="refreshData" class="refresh-button">Обновить</button>
      </div>

      <div class="homework-selector">
        <CustomDropdown
          :options="dropdownOptions"
          :modelValue="selectedHomework"
          @update:modelValue="handleHomeworkSelect"
          placeholder="Выберите домашнюю работу"
        />  
      </div>

      <div v-if="selectedHomework" class="editor-form">
        <!-- Форма редактирования -->
        <div class="form-group">
          <label for="homework-name">Название домашней работы:</label>
          <input
            id="homework-name"
            v-model="currentHomework.homework_name"
            type="text"
            placeholder="Введите название"
          />
        </div>

        <!-- Выбор урока из выпадающего списка -->
        <div class="form-group lesson-select-group">
          <label for="lesson-select">Урок:</label>
          <CustomDropdown
            id="lesson-select"
            :options="lessonOptions"
            :modelValue="selectedLessonNumber"
            @update:modelValue="handleLessonSelect"
            placeholder="Выберите урок"
          />
        </div>

        <!-- Отображение выбранного урока -->
        <div v-if="selectedLesson" class="selected-lesson-info">
          <span class="lesson-badge" :title="`Урок ${selectedLesson.number}: ${selectedLesson.title}`">
            Урок {{ selectedLesson.number }}: {{ truncateText(selectedLesson.title, 40) }}
          </span>
          <span v-if="selectedLesson.date" class="lesson-date-badge">
            📅 {{ formatDate(selectedLesson.date) }}
          </span>
        </div>

        <!-- Поле для дедлайна с типом date -->
        <div class="form-group">
          <label for="deadline">Дедлайн:</label>
          <input
            id="deadline"
            v-model="currentHomework.deadline"
            type="date"
          />
        </div>

        <div class="action-buttons">
          <button @click="saveHomework" class="save-button">
            {{ isEditing ? 'Обновить' : 'Создать' }}
          </button>
          <button
            v-if="isEditing"
            @click="deleteHomework"
            class="delete-button"
          >
            Удалить
          </button>
          <button @click="resetForm" class="cancel-button">Отмена</button>
          <button 
            v-if="isEditing"
            @click="openHomework"
            class="open-button"
          >
            Открыть домашнее задание
          </button>
        </div>
      </div>
    </div>

    <!-- Редактор заданий (открывается на весь экран) -->
    <TaskHomeworkEditor
      v-if="showTaskEditor"
      :homework-id="currentHomework.homework_id"
      :homework-name="currentHomework.homework_name"
      :subject="subject"
      :exam-type="examType"
      @close="closeTaskEditor"
    />
  </div>
</template>

<script>
import { supabase } from '../supabase'
import CustomDropdown from './CustomDropdown.vue'
import TaskHomeworkEditor from './TaskHomeworkEditor.vue'

export default {
  name: 'HomeworkEditor',
  components: {
    CustomDropdown,
    TaskHomeworkEditor
  },
  props: {
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
      homeworks: [],
      lessons: [],
      selectedHomework: null,
      selectedLessonNumber: null,
      currentHomework: {
        homework_id: null,
        homework_name: '',
        lesson_number: '',
        lesson_name: '',
        deadline: null
      },
      isLoading: false,
      nextHomeworkId: 1,
      showTaskEditor: false
    }
  },
  computed: {
    tableName() {
      return `${this.subject}_${this.examType}_homework_list`
    },
    lessonsTableName() {
      return `${this.subject}_${this.examType}`
    },
    subjectName() {
      const subjects = {
        'biology': 'биологии',
        'chemistry': 'химии'
      }
      const examTypes = {
        'ege': 'ЕГЭ',
        'oge': 'ОГЭ'
      }
      return `${subjects[this.subject]} ${examTypes[this.examType]}`
    },
    dropdownOptions() {
      const options = this.homeworks.map(hw => ({
        value: hw.homework_id,
        label: `${hw.homework_name} (Урок ${hw.lesson_number}. ${hw.lesson_name})${hw.deadline ? ` [До: ${this.formatDate(hw.deadline)}]` : ''}`
      }))
      return [{ value: 'new', label: '+ Создать новую домашнюю работу' }, ...options]
    },
    lessonOptions() {
      return this.lessons.map(lesson => ({
        value: lesson.number,
        label: `Урок ${lesson.number}: ${this.truncateText(lesson.title || 'Без названия', 35)}`
      }))
    },
    selectedLesson() {
      return this.lessons.find(l => l.number === this.selectedLessonNumber) || null
    },
    isEditing() {
      return this.selectedHomework !== 'new' && this.selectedHomework !== null
    }
  },
  watch: {
    subject: {
      immediate: true,
      handler() {
        this.fetchHomeworks()
        this.fetchLessons()
      }
    },
    examType: {
      immediate: true,
      handler() {
        this.fetchHomeworks()
        this.fetchLessons()
      }
    }
  },
  methods: {
    truncateText(text, maxLength = 40) {
      if (!text) return ''
      if (text.length <= maxLength) return text
      return text.slice(0, maxLength) + '...'
    },
    async fetchHomeworks() {
      this.isLoading = true
      try {
        const { data, error } = await supabase
          .from(this.tableName)
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        
        this.homeworks = data || []
        this.calculateNextId()
        this.resetForm()
      } catch (error) {
        console.error(`Ошибка при загрузке домашних работ:`, error)
        alert(`Не удалось загрузить список домашних работ`)
      } finally {
        this.isLoading = false
      }
    },
    async fetchLessons() {
      try {
        const { data, error } = await supabase
          .from(this.lessonsTableName)
          .select('number, title, date')
          .order('number', { ascending: true })

        if (error) throw error
        
        this.lessons = data || []
      } catch (error) {
        console.error(`Ошибка при загрузке уроков:`, error)
      }
    },
    calculateNextId() {
      if (this.homeworks.length === 0) {
        this.nextHomeworkId = 1
      } else {
        const maxId = Math.max(...this.homeworks.map(hw => hw.homework_id))
        this.nextHomeworkId = maxId + 1
      }
    },
    handleHomeworkSelect(value) {
      this.selectedHomework = value
      
      if (value === 'new') {
        this.resetForm()
      } else {
        const selected = this.homeworks.find(hw => hw.homework_id === value)
        if (selected) {
          this.currentHomework = { 
            ...selected,
            deadline: selected.deadline ? this.formatDateForInput(selected.deadline) : null
          }
          this.selectedLessonNumber = parseInt(selected.lesson_number) || null
        }
      }
    },
    handleLessonSelect(value) {
      this.selectedLessonNumber = value
      const lesson = this.lessons.find(l => l.number === value)
      if (lesson) {
        this.currentHomework.lesson_number = String(lesson.number)
        this.currentHomework.lesson_name = lesson.title || ''
      }
    },
    formatDate(dateString) {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    },
    formatDateForInput(dateString) {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toISOString().split('T')[0]
    },
    async saveHomework() {
      if (!this.currentHomework.homework_name?.trim()) {
        alert('Пожалуйста, введите название домашней работы')
        return
      }

      if (!this.selectedLessonNumber) {
        alert('Пожалуйста, выберите урок')
        return
      }

      try {
        const homeworkData = {
          homework_name: this.currentHomework.homework_name.trim(),
          lesson_number: this.currentHomework.lesson_number,
          lesson_name: this.currentHomework.lesson_name,
          deadline: this.currentHomework.deadline || null
        }

        if (this.isEditing) {
          const { error } = await supabase
            .from(this.tableName)
            .update(homeworkData)
            .eq('homework_id', this.currentHomework.homework_id)

          if (error) throw error
          alert('Домашняя работа успешно обновлена')
        } else {
          homeworkData.homework_id = this.nextHomeworkId
          
          const { data, error } = await supabase
            .from(this.tableName)
            .insert([homeworkData])
            .select()

          if (error) throw error
          this.currentHomework.homework_id = data[0].homework_id
          this.nextHomeworkId++
          alert('Новая домашняя работа успешно создана')
        }

        await this.fetchHomeworks()
        this.selectedHomework = this.currentHomework.homework_id
      } catch (error) {
        console.error('Ошибка при сохранении:', error)
        alert(`Не удалось сохранить домашнюю работу: ${error.message}`)
      }
    },
    async deleteHomework() {
      if (!confirm('Вы уверены, что хотите удалить эту домашнюю работу?')) {
        return
      }

      try {
        const { error } = await supabase
          .from(this.tableName)
          .delete()
          .eq('homework_id', this.currentHomework.homework_id)

        if (error) throw error
        alert('Домашняя работа успешно удалена')
        await this.fetchHomeworks()
        this.resetForm()
      } catch (error) {
        console.error('Ошибка при удалении:', error)
        alert('Не удалось удалить домашнюю работу')
      }
    },
    resetForm() {
      this.currentHomework = {
        homework_id: null,
        homework_name: '',
        lesson_number: '',
        lesson_name: '',
        deadline: null
      }
      this.selectedLessonNumber = null
      this.selectedHomework = 'new'
    },
    async refreshData() {
      await this.fetchHomeworks()
      await this.fetchLessons()
    },
    openHomework() {
      if (!this.currentHomework.homework_id) {
        alert('Не удалось определить ID домашней работы')
        return
      }
      
      this.$emit('homework-selected', {
        subject: this.subject,
        examType: this.examType,
        homeworkId: this.currentHomework.homework_id,
        homeworkName: this.currentHomework.homework_name
      })
      
      this.showTaskEditor = true
    },
    closeTaskEditor() {
      this.showTaskEditor = false
    }
  }
}
</script>

<style scoped>
* {
  font-family: Evolventa, sans-serif;
  box-sizing: border-box;
}

.homework-editor {
  max-width: 100%;
  margin: 0 auto;
  padding: 20px;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.header h2 {
  font-size: clamp(1rem, 2vw, 1.5rem);
  margin: 0;
  flex: 1;
  min-width: 200px;
  word-break: break-word;
}

.refresh-button {
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.refresh-button:hover {
  background-color: #e0e0e0;
}

.homework-selector {
  margin-bottom: 30px;
  max-width: 100%;
}

.editor-form {
  background-color: #fff;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  max-width: 100%;
  overflow: hidden;
}

.form-group {
  margin-bottom: 20px;
  max-width: 100%;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  max-width: 100%;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: #b241d1;
  outline: none;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.1);
}

.form-group input[type="date"] {
  font-family: 'Evolventa', sans-serif;
  max-width: 200px;
}

/* Ограничиваем ширину дропдауна выбора урока */
.lesson-select-group {
  max-width: 100%;
}

/* Информация о выбранном уроке */
.selected-lesson-info {
  display: flex;
  gap: 10px;
  margin-top: -8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  max-width: 100%;
}

.lesson-badge {
  display: inline-block;
  background-color: #f0f0ff;
  border: 1px solid #b241d1;
  color: #b241d1;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lesson-date-badge {
  display: inline-block;
  background-color: #e8f5e9;
  border: 1px solid #4caf50;
  color: #2e7d32;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  white-space: nowrap;
  flex-shrink: 0;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-top: 30px;
  flex-wrap: wrap;
}

.save-button,
.delete-button,
.cancel-button,
.open-button {
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  border: none;
  font-size: 14px;
  white-space: nowrap;
}

.save-button {
  background-color: #b241d1;
  color: white;
}

.save-button:hover {
  background-color: #9a36b8;
}

.delete-button {
  background-color: #ff4444;
  color: white;
}

.delete-button:hover {
  background-color: #cc0000;
}

.cancel-button {
  background-color: #f0f0f0;
  border: 1px solid #ddd;
}

.cancel-button:hover {
  background-color: #e0e0e0;
}

.open-button {
  background-color: #42b983;
  color: white;
}

.open-button:hover {
  background-color: #369f6e;
}

/* Адаптивность для мобильных устройств */
@media (max-width: 768px) {
  .homework-editor {
    padding: 12px;
  }
  
  .editor-form {
    padding: 16px;
  }
  
  .header h2 {
    font-size: 1.1rem;
    min-width: 150px;
  }
  
  .form-group input {
    font-size: 14px;
    padding: 8px 12px;
  }
  
  .form-group input[type="date"] {
    max-width: 100%;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .save-button,
  .delete-button,
  .cancel-button,
  .open-button {
    width: 100%;
    justify-content: center;
    text-align: center;
    white-space: normal;
  }
  
  .selected-lesson-info {
    flex-direction: column;
    gap: 6px;
  }
  
  .lesson-badge {
    max-width: 100%;
    white-space: normal;
    word-break: break-word;
    overflow-wrap: break-word;
  }
}

@media (max-width: 480px) {
  .header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .refresh-button {
    align-self: flex-start;
  }
}
</style>