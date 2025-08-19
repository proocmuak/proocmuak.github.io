<script>
import { supabase } from '../supabase';
import DOMPurify from 'dompurify';

export default {
  name: 'TeacherTaskCard',
  props: {
    task: {
      type: Object,
      required: true
    },
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
      required: true,
    }
  },
  data() {
    return {
      showImageModal: false,
      selectedImage: '',
      isAdded: false
    };
  },
  computed: {
    hasTableData() {
      return this.task.table_data && 
             this.task.table_data.content && 
             this.task.table_data.content.length > 0;
    },
    taskTextWithoutTables() {
      if (!this.task.text) return '';
      return this.hasTableData ? this.task.text.replace(/<table[\s\S]*?<\/table>/gi, '') : this.task.text;
    },
    homeworkTableName() {
      return `${this.subject}_ege_homework_tasks`;
    }
  },
  methods: {
    sanitizeHtml(html) {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'sub', 'sup', 'ul', 'ol', 'li', 'div', 'span'],
        ALLOWED_ATTR: ['style', 'class']
      });
    },
    getImageUrl(imagePath) {
      if (imagePath.startsWith('http')) return imagePath;
      
      const { data: { publicUrl } } = supabase
        .storage
        .from('task-images')
        .getPublicUrl(imagePath);
      
      return publicUrl;
    },
    async addToHomework() {
      try {
        const { error } = await supabase
          .from(this.homeworkTableName)
          .insert({
            task_id: this.task.id,
            homework_id: this.homeworkId,
            homework_name: this.homeworkName
          });
        
        if (error) throw error;
        
        this.isAdded = true;
        this.$emit('task-added', this.task.id);
      } catch (error) {
        console.error('Ошибка при добавлении задания:', error);
        alert('Не удалось добавить задание в домашнюю работу');
      }
    },
    openImageModal(imageUrl) {
      this.selectedImage = imageUrl;
      this.showImageModal = true;
      document.body.style.overflow = 'hidden';
    },
    closeImageModal() {
      this.showImageModal = false;
      document.body.style.overflow = '';
    }
  }
}
</script>

<template>
  <div class="task-card">
    <div class="task-header">
      <div class="task-meta">
        <span class="task-topic">Тема: {{ task.topic }}</span>
        <span class="task-id">#{{ task.id }}</span>
      </div>
      <button 
        @click="addToHomework" 
        class="add-button"
        :disabled="isAdded"
      >
        {{ isAdded ? 'Добавлено' : 'Выбрать задание' }}
      </button>
    </div>
    
    <div class="task-content">
      <div class="task-text" v-html="sanitizeHtml(taskTextWithoutTables)"></div>
      
      <div v-if="hasTableData" class="task-table-container">
        <table :class="{ 'with-borders': task.table_data.borders }">
          <tr v-for="(row, rowIndex) in task.table_data.content" :key="'row-'+rowIndex">
            <td v-for="(cell, colIndex) in row" :key="'cell-'+rowIndex+'-'+colIndex">
              <div v-html="sanitizeHtml(cell || '&nbsp;')"></div>
            </td>
          </tr>
        </table>
      </div>
      
      <div class="task-images" v-if="task.images && task.images.length">
        <div class="image-grid">
          <div 
            class="image-container" 
            v-for="(image, index) in task.images" 
            :key="index"
          >
            <img 
              :src="getImageUrl(image)" 
              :alt="'Изображение задания ' + task.id" 
              class="task-image"
              @click="openImageModal(getImageUrl(image))"
              loading="lazy"
            >
          </div>
        </div>
      </div>

      <div class="answer-section">
        <div class="correct-answer">
          Правильный ответ: {{ task.answer }}
        </div>
      </div>
    </div>
    
    <div v-if="task.explanation" class="explanation-section">
      <div class="explanation-title">Пояснение:</div>
      <div class="explanation-content" v-html="sanitizeHtml(task.explanation)"></div>
    </div>
    
    <div v-if="showImageModal" class="image-modal" @click.self="closeImageModal">
      <div class="modal-content">
        <img :src="selectedImage" class="modal-image">
        <button class="close-modal" @click="closeImageModal">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.task-meta {
  display: flex;
  flex-direction: column;
}

.task-topic {
  font-weight: bold;
  margin-bottom: 4px;
}

.task-id {
  color: #666;
  font-size: 0.9em;
}

.add-button {
  padding: 8px 16px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.9rem;
  white-space: nowrap;
}

.add-button:hover:not(:disabled) {
  background-color: #369f6e;
}

.add-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.task-content {
  margin-bottom: 16px;
}

.task-text {
  margin-bottom: 16px;
  line-height: 1.5;
}

.task-table-container {
  margin: 16px 0;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}

table.with-borders {
  border: 1px solid #ddd;
}

table.with-borders td {
  border: 1px solid #ddd;
  padding: 8px;
}

td {
  padding: 4px;
  vertical-align: top;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin: 16px 0;
}

.task-image {
  max-width: 100%;
  max-height: 200px;
  cursor: pointer;
  border-radius: 4px;
  transition: transform 0.2s;
}

.task-image:hover {
  transform: scale(1.02);
}

.answer-section {
  margin-top: 16px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.correct-answer {
  font-weight: bold;
  color: #2c3e50;
}

.explanation-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.explanation-title {
  font-weight: bold;
  margin-bottom: 8px;
}

.explanation-content {
  line-height: 1.5;
}

.image-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
}

.modal-image {
  max-width: 100%;
  max-height: 80vh;
  display: block;
}

.close-modal {
  position: absolute;
  top: -40px;
  right: 0;
  background: none;
  border: none;
  color: white;
  font-size: 2rem;
  cursor: pointer;
}
</style>