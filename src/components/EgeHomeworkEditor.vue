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

        <div class="form-group">
          <label for="lesson-number">Номер урока:</label>
          <input
            id="lesson-number"
            v-model="currentHomework.lesson_number"
            type="text"
            placeholder="Введите номер урока"
          />
        </div>

        <div class="form-group">
          <label for="lesson-name">Название урока:</label>
          <input
            id="lesson-name"
            v-model="currentHomework.lesson_name"
            type="text"
            placeholder="Введите название урока"
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
    <EgeTaskHomeworkEditor
      v-if="showTaskEditor"
      :homework-id="currentHomework.homework_id"
      :homework-name="currentHomework.homework_name"
      :subject="subject"
      @close="closeTaskEditor"
    />
  </div>
</template>

<script>
import { supabase } from '../supabase'
import CustomDropdown from './CustomDropdown.vue'
import EgeTaskHomeworkEditor from './EgeTaskHomeworkEditor.vue'


export default {
  name: 'EgeHomeworkEditor',
  components: {
    CustomDropdown,
    EgeTaskHomeworkEditor
  },
  props: {
    subject: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      homeworks: [],
      selectedHomework: null,
      currentHomework: {
        homework_id: null,
        homework_name: '',
        lesson_number: '',
        lesson_name: ''
      },
      isLoading: false,
      nextHomeworkId: 1,
      showTaskEditor: false
    }
  },
  computed: {
    tableName() {
      return `${this.subject}_ege_homework_list`
    },
    subjectName() {
      return this.subject === 'biology' ? 'биологии' : 'химии'
    },
    dropdownOptions() {
      const options = this.homeworks.map(hw => ({
        value: hw.homework_id,
        label: `${hw.homework_name} (Урок ${hw.lesson_number}. ${hw.lesson_name})`
      }))
      return [{ value: 'new', label: '+ Создать новую домашнюю работу' }, ...options]
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
      }
    }
  },
  methods: {
    async fetchHomeworks() {
      this.isLoading = true
      try {
        const { data, error } = await supabase
          .from(this.tableName)
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        
        this.homeworks = data
        this.calculateNextId()
        this.resetForm()
      } catch (error) {
        console.error(`Ошибка при загрузке домашних работ по ${this.subjectName}:`, error)
        alert(`Не удалось загрузить список домашних работ по ${this.subjectName}`)
      } finally {
        this.isLoading = false
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
          this.currentHomework = { ...selected }
        }
      }
    },
    async saveHomework() {
      if (!this.currentHomework.homework_name?.trim()) {
        alert('Пожалуйста, введите название домашней работы')
        return
      }

      if (!this.currentHomework.lesson_number?.trim()) {
        alert('Пожалуйста, введите номер урока')
        return
      }

      if (!this.currentHomework.lesson_name?.trim()) {
        alert('Пожалуйста, введите название урока')
        return
      }

      try {
        const homeworkData = {
          homework_name: this.currentHomework.homework_name.trim(),
          lesson_number: this.currentHomework.lesson_number.trim(),
          lesson_name: this.currentHomework.lesson_name.trim()
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
        lesson_name: ''
      }
      this.selectedHomework = 'new'
    },
    async refreshData() {
      await this.fetchHomeworks()
    },
openHomework() {
      if (!this.currentHomework.homework_id) {
        alert('Не удалось определить ID домашней работы')
        return
      }
      
      // Отправляем данные о выбранной домашней работе родителю
      this.$emit('homework-selected', {
        subject: this.subject,
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
*{
  font-family: Evolventa;
}
.homework-editor {
  max-width: 100%;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Evolventa', sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.refresh-button {
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.refresh-button:hover {
  background-color: #e0e0e0;
}

.homework-selector {
  margin-bottom: 30px;
}

.editor-form {
  background-color: #fff;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: #b241d1;
  outline: none;
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
</style>