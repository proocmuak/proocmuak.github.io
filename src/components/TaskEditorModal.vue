<template>
  <div class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Редактирование задания №{{ task.number }}</h2>
        <button class="close-button" @click="closeModal">×</button>
      </div>
      
      <div class="modal-body">
        <div class="form-grid">
          <!-- Выбор раздела -->
          <div class="form-item">
            <label>Раздел:</label>
            <CustomDropdown
              :options="availableSections"
              placeholder="Выберите раздел"
              v-model="editedTask.section"
              :searchable="true"
            />
          </div>

          <!-- Выбор темы -->
          <div class="form-item">
            <label>Тема:</label>
            <CustomDropdown
              :options="filteredTopics"
              placeholder="Выберите тему"
              v-model="editedTask.topic"
              :searchable="true"
            />
          </div>

          <!-- Выбор части -->
          <div class="form-item">
            <label>Часть:</label>
            <CustomDropdown
              :options="parts"
              placeholder="Выберите часть"
              v-model="editedTask.part"
            />
          </div>

          <!-- Выбор номера -->
          <div class="form-item">
            <label>Номер задания:</label>
            <CustomDropdown
              :options="filteredTaskNumbers"
              placeholder="Выберите номер"
              v-model="editedTask.number"
            />
          </div>
          
          <div class="form-item">
            <label>Баллы за задание:</label>
            <select v-model="editedTask.points" class="points-select">
              <option v-for="n in 5" :value="n" :key="n">{{ n }}</option>
            </select>
          </div>

          <div class="form-item">
            <label>Сложность:</label>
            <select v-model="editedTask.difficulty" class="points-select">
              <option value="1">1 (Легкая)</option>
              <option value="2">2 (Средняя)</option>
              <option value="3">3 (Сложная)</option>
            </select>
          </div>
        </div>

        <!-- Текстовое поле задания -->
        <div class="text-editor">
          <label>Текст задания:</label>
          <textarea 
            v-model="editedTask.text" 
            placeholder="Введите текст задания..."
            class="task-textarea"
            rows="4"
          ></textarea>
        </div>

        <!-- Поле ответа -->
        <div class="text-editor">
          <label>Ответ:</label>
          <textarea 
            v-model="editedTask.answer" 
            placeholder="Введите ответ на задание..."
            class="task-textarea answer-textarea"
            rows="2"
          ></textarea>
        </div>

        <!-- Поле для пояснения -->
        <div class="text-editor">
          <label>Пояснение к ответу:</label>
          <textarea 
            v-model="editedTask.explanation" 
            placeholder="Введите пояснение к ответу (опционально)..."
            class="task-textarea"
            rows="3"
          ></textarea>
        </div>

        <!-- Информация о изображениях -->
        <div class="images-info" v-if="hasImages">
          <h4>Загруженные изображения:</h4>
          <div class="images-list">
            <div v-if="task.images && task.images.length" class="image-group">
              <strong>Текст задания:</strong>
              <span>{{ task.images.length }} изображений</span>
            </div>
            <div v-if="task.image_answer && task.image_answer.length" class="image-group">
              <strong>Ответ:</strong>
              <span>{{ task.image_answer.length }} изображений</span>
            </div>
            <div v-if="task.image_explanation && task.image_explanation.length" class="image-group">
              <strong>Пояснение:</strong>
              <span>{{ task.image_explanation.length }} изображений</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <div class="action-buttons">
          <button 
            @click="deleteTask"
            class="delete-button"
            :disabled="isLoading"
          >
            {{ isLoading ? 'Удаление...' : 'Удалить задание' }}
          </button>
          <div class="right-buttons">
            <button 
              @click="closeModal"
              class="cancel-button"
              :disabled="isLoading"
            >
              Отмена
            </button>
            <button 
              @click="saveTask"
              :disabled="!isFormValid || isLoading"
              class="save-button"
            >
              {{ isLoading ? 'Сохранение...' : 'Сохранить изменения' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { supabase } from '../supabase';
import CustomDropdown from './CustomDropdown.vue';

export default {
  name: 'TaskEditorModal',
  components: {
    CustomDropdown
  },
  props: {
    task: {
      type: Object,
      required: true
    },
    subject: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      editedTask: {
        section: '',
        topic: '',
        part: '',
        number: null,
        points: 1,
        difficulty: 2,
        text: '',
        answer: '',
        explanation: ''
      },
      isLoading: false,
      availableSections: [],
      availableTopics: [],
      parts: ['Первая часть', 'Вторая часть']
    };
  },
  computed: {
    hasImages() {
      return (this.task.images && this.task.images.length > 0) ||
             (this.task.image_answer && this.task.image_answer.length > 0) ||
             (this.task.image_explanation && this.task.image_explanation.length > 0);
    },
    isFormValid() {
      return this.editedTask.section &&
             this.editedTask.topic &&
             this.editedTask.part &&
             this.editedTask.number &&
             this.editedTask.text &&
             this.editedTask.answer;
    },
    filteredTopics() {
      if (!this.editedTask.section) return this.availableTopics;
      return this.availableTopics.filter(topic => 
        topic.toLowerCase().includes(this.editedTask.section.toLowerCase())
      );
    },
    filteredTaskNumbers() {
      const config = this.getSubjectConfig();
      if (!config) return [];
      
      const numbers = [];
      const maxNumber = this.editedTask.part === 'Первая часть' 
        ? config.firstPartMax 
        : 35;
      
      const minNumber = this.editedTask.part === 'Первая часть' 
        ? 1 
        : config.firstPartMax + 1;
      
      for (let i = minNumber; i <= maxNumber; i++) {
        numbers.push(i);
      }
      
      return numbers;
    }
  },
  watch: {
    task: {
      immediate: true,
      handler(newTask) {
        if (newTask) {
          this.editedTask = {
            section: newTask.section || '',
            topic: newTask.topic || '',
            part: newTask.part || '',
            number: newTask.number || null,
            points: newTask.points || 1,
            difficulty: newTask.difficulty || 2,
            text: newTask.text || '',
            answer: newTask.answer || '',
            explanation: newTask.explanation || ''
          };
        }
      }
    },
    subject: {
      immediate: true,
      handler(newSubject) {
        if (newSubject) {
          this.loadSectionsAndTopics();
        }
      }
    }
  },
  methods: {
    getSubjectConfig() {
      const configs = {
        'Химия ЕГЭ': { firstPartMax: 28 },
        'Биология ЕГЭ': { firstPartMax: 21 }
      };
      return configs[this.subject];
    },
    async loadSectionsAndTopics() {
      try {
        // Для простоты используем статические данные, можно заменить на запрос к БД
        if (this.subject === 'Химия ЕГЭ') {
          this.availableSections = ['Общая химия', 'Органическая химия', 'Неорганическая химия', 'Задачи'];
          this.availableTopics = [
            'Строение атома', 'Периодический закон', 'Химическая связь',
            'Углеводороды', 'Кислородсодержащие соединения', 'Азотсодержащие соединения',
            'Металлы', 'Неметаллы', 'Расчетные задачи'
          ];
        } else if (this.subject === 'Биология ЕГЭ') {
          this.availableSections = ['Цитология', 'Генетика', 'Анатомия', 'Экология'];
          this.availableTopics = [
            'Строение клетки', 'Обмен веществ', 'Деление клетки',
            'Законы Менделя', 'Наследование признаков', 'Мутации',
            'Системы органов', 'Физиология', 'Экосистемы'
          ];
        }
      } catch (error) {
        console.error('Ошибка загрузки разделов и тем:', error);
      }
    },
    closeModal() {
      this.$emit('close');
    },
    async saveTask() {
      this.isLoading = true;
      
      try {
        const config = this.getSubjectConfig();
        if (!config) throw new Error('Неизвестный предмет');
        
        const tableName = this.subject === 'Химия ЕГЭ' 
          ? 'chemistry_ege_task_bank' 
          : 'biology_ege_task_bank';
        
        const { error } = await supabase
          .from(tableName)
          .update({
            section: this.editedTask.section,
            topic: this.editedTask.topic,
            part: this.editedTask.part,
            number: this.editedTask.number,
            points: this.editedTask.points,
            difficulty: this.editedTask.difficulty,
            text: this.editedTask.text,
            answer: this.editedTask.answer,
            explanation: this.editedTask.explanation,
          })
          .eq('id', this.task.id);
        
        if (error) throw error;
        
        this.$emit('task-updated', {
          ...this.task,
          ...this.editedTask
        });
        
        this.closeModal();
        
      } catch (error) {
        console.error('Ошибка сохранения задания:', error);
        alert('Ошибка при сохранении задания: ' + error.message);
      } finally {
        this.isLoading = false;
      }
    },
    async deleteTask() {
      if (!confirm('Вы уверены, что хотите удалить это задание? Это действие нельзя отменить.')) {
        return;
      }
      
      this.isLoading = true;
      
      try {
        const config = this.getSubjectConfig();
        if (!config) throw new Error('Неизвестный предмет');
        
        const tableName = this.subject === 'Химия ЕГЭ' 
          ? 'chemistry_ege_task_bank' 
          : 'biology_ege_task_bank';
        
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', this.task.id);
        
        if (error) throw error;
        
        this.$emit('task-deleted');
        this.closeModal();
        
      } catch (error) {
        console.error('Ошибка удаления задания:', error);
        alert('Ошибка при удалении задания: ' + error.message);
      } finally {
        this.isLoading = false;
      }
    }
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.modal-header h2 {
  margin: 0;
  color: #333;
  font-size: 1.5rem;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-button:hover {
  background-color: #eee;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-item label {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.points-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
}

.text-editor {
  margin-bottom: 20px;
}

.text-editor label {
  display: block;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.task-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
}

.answer-textarea {
  font-weight: 600;
  color: #2e7d32;
}

.images-info {
  margin-top: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #b241d1;
}

.images-info h4 {
  margin: 0 0 12px 0;
  color: #333;
}

.image-group {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.image-group:last-child {
  border-bottom: none;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #eee;
  background: #f8f9fa;
  border-radius: 0 0 12px 12px;
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.action-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.right-buttons {
  display: flex;
  gap: 12px;
}

.delete-button {
  padding: 10px 16px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.delete-button:hover:not(:disabled) {
  background-color: #c82333;
}

.delete-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.cancel-button {
  padding: 10px 20px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.cancel-button:hover:not(:disabled) {
  background-color: #5a6268;
}

.save-button {
  padding: 10px 20px;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.save-button:hover:not(:disabled) {
  background-color: #9a36b8;
}

.save-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    margin: 10px;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 12px;
  }
  
  .right-buttons {
    width: 100%;
    justify-content: stretch;
  }
  
  .delete-button,
  .cancel-button,
  .save-button {
    flex: 1;
    text-align: center;
  }
}
</style>

