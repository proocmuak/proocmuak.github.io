<script>
import { supabase } from '../supabase';
import DOMPurify from 'dompurify';

// === Конфигурация прокси сервера ===
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const PROXY_CONFIG = {
  enabled: true,
  baseUrl: isLocalhost 
    ? 'https://schoolpurto.ru/storage' 
    : '/storage'
};

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
    },
    examType: {
      type: String,
      required: true
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
      return `${this.subject}_${this.examType}_homework_tasks`;
    }
  },
  methods: {
    sanitizeHtml(html) {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'sub', 'sup', 'ul', 'ol', 'li', 'div', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
        ALLOWED_ATTR: ['style', 'class', 'border', 'cellpadding', 'cellspacing', 'width', 'height', 'align', 'valign', 'colspan', 'rowspan']
      });
    },

    // === ИСПРАВЛЕННАЯ ФУНКЦИЯ: получение URL изображения через прокси ===
    getImageUrl(imagePath) {
      if (!imagePath) return '';
      
      let path = String(imagePath);
      
      // Если это абсолютный URL
      if (path.startsWith('http')) {
        // Если это старый URL Supabase, конвертируем в проксированный
        if (path.includes('supabase.co')) {
          const match = path.match(/\/storage\/v1\/object\/public\/task-images\/(.+)$/);
          if (match) {
            return `${PROXY_CONFIG.baseUrl}/task-images/${match[1]}`;
          }
        }
        return path;
      }
      
      // Очищаем путь от возможных префиксов
      let cleanPath = path;
      if (cleanPath.startsWith('task-images/')) {
        cleanPath = cleanPath.replace('task-images/', '');
      }
      
      // Всегда используем прокси, если он включён
      if (PROXY_CONFIG.enabled) {
        return `${PROXY_CONFIG.baseUrl}/task-images/${cleanPath}`;
      }
      
      // Fallback только если прокси выключен
      try {
        const { data: { publicUrl } } = supabase
          .storage
          .from('task-images')
          .getPublicUrl(cleanPath);
        return publicUrl;
      } catch (err) {
        console.error('Ошибка получения URL изображения:', err);
        return '';
      }
    },

    async checkIfAlreadyAdded() {
      try {
        const { data, error } = await supabase
          .from(this.homeworkTableName)
          .select('task_id')
          .eq('homework_id', this.homeworkId)
          .eq('task_id', this.task.id)
          .maybeSingle();
        
        if (data) {
          this.isAdded = true;
        }
      } catch (error) {
        console.error('Ошибка проверки:', error);
      }
    },

    async addToHomework() {
      try {
        // Проверяем, не добавлено ли уже задание
        const { data: existingTask, error: checkError } = await supabase
          .from(this.homeworkTableName)
          .select('task_id')
          .eq('homework_id', this.homeworkId)
          .eq('task_id', this.task.id)
          .maybeSingle();
        
        if (existingTask) {
          this.isAdded = true;
          alert('Это задание уже добавлено в домашнюю работу');
          return;
        }
        
        // ВЫЧИСЛЯЕМ НОМЕР ЗАДАНИЯ
        const { data: tasksData, error: tasksError } = await supabase
          .from(this.homeworkTableName)
          .select('number')
          .eq('homework_id', this.homeworkId)
          .order('number', { ascending: false });
        
        if (tasksError) {
          console.error('Ошибка получения максимального номера:', tasksError);
          var nextNumber = 1;
        } else {
          var nextNumber = tasksData && tasksData.length > 0 
            ? Math.max(...tasksData.map(task => task.number || 0)) + 1 
            : 1;
        }
        
        // Добавляем задание с вычисленным номером
        const { error } = await supabase
          .from(this.homeworkTableName)
          .insert({
            task_id: this.task.id,
            homework_id: this.homeworkId,
            homework_name: this.homeworkName,
            number: nextNumber,
          });
        
        if (error) {
          if (error.code === '23505') {
            this.isAdded = true;
            alert('Это задание уже есть в домашней работе');
          } else {
            throw error;
          }
        } else {
          this.isAdded = true;
          this.$emit('task-added', this.task.id);
          alert(`Задание добавлено под номером ${nextNumber}!`);
        }
        
      } catch (error) {
        console.error('Ошибка добавления:', error);
        alert('Ошибка при добавлении задания: ' + error.message);
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
  },
  async created() {
    await this.checkIfAlreadyAdded();
  }
}
</script>

<template>
  <div class="task-card">
    <div class="task-header">
      <div class="task-meta">
        <span class="task-topic">Тема: {{ task.topic }}</span>
        <span class="task-id">#{{ task.id }}</span>
        <span class="task-number">Задание №{{ task.number }}</span>
        <span class="task-points">Баллов: {{ task.points }}</span>
      </div>
      <button 
        @click="addToHomework" 
        class="add-button"
        :disabled="isAdded"
      >
        {{ isAdded ? '✓ Уже в домашке' : '➕ Добавить' }}
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
          <strong>Правильный ответ:</strong> 
          <span v-html="sanitizeHtml(task.answer)"></span>
          
          <!-- Изображения ответа -->
          <div v-if="task.image_answer && task.image_answer.length" class="answer-images">
            <div class="image-grid">
              <div 
                class="image-container" 
                v-for="(image, index) in task.image_answer" 
                :key="'answer-'+index"
              >
                <img 
                  :src="getImageUrl(image)" 
                  :alt="'Изображение ответа ' + task.id" 
                  class="task-image"
                  @click="openImageModal(getImageUrl(image))"
                  loading="lazy"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="task.explanation" class="explanation-section">
      <div class="explanation-title">Пояснение:</div>
      <div class="explanation-content" v-html="sanitizeHtml(task.explanation)"></div>
      
      <!-- Изображения пояснения -->
      <div v-if="task.image_explanation && task.image_explanation.length" class="explanation-images">
        <div class="image-grid">
          <div 
            class="image-container" 
            v-for="(image, index) in task.image_explanation" 
            :key="'explanation-'+index"
          >
            <img 
              :src="getImageUrl(image)" 
              :alt="'Изображение пояснения ' + task.id" 
              class="task-image"
              @click="openImageModal(getImageUrl(image))"
              loading="lazy"
            >
          </div>
        </div>
      </div>
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
  align-items: flex-start;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
  flex-wrap: wrap;
  gap: 10px;
}

.task-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.task-topic {
  font-weight: bold;
  color: #333;
}

.task-id {
  color: #666;
  font-size: 0.9em;
}

.task-number {
  color: #b241d1;
  font-weight: 600;
  font-size: 0.9em;
}

.task-points {
  color: #28a745;
  font-weight: 600;
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
  height: fit-content;
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

.task-text :deep(p) {
  margin-bottom: 0.8rem;
}

.task-text :deep(p:last-child) {
  margin-bottom: 0;
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
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  margin: 16px 0;
}

.image-container {
  position: relative;
  padding-top: 100%;
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid #eee;
  background: #f8f9fa;
}

.task-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s;
}

.task-image:hover {
  transform: scale(1.02);
}

.answer-section {
  margin-top: 16px;
  padding: 12px;
  background-color: #f0faf0;
  border-radius: 4px;
  border-left: 4px solid #2e7d32;
}

.correct-answer {
  font-weight: 500;
  color: #2e7d32;
}

.correct-answer strong {
  color: #1b5e20;
}

.answer-images,
.explanation-images {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(46, 125, 50, 0.2);
}

.explanation-section {
  margin-top: 16px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border-left: 4px solid #b241d1;
}

.explanation-title {
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
}

.explanation-content {
  line-height: 1.5;
  color: #444;
}

.explanation-content :deep(p) {
  margin-bottom: 0.8rem;
}

.explanation-content :deep(p:last-child) {
  margin-bottom: 0;
}

.image-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
}

.modal-image {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 4px;
}

.close-modal {
  position: absolute;
  top: -1.5rem;
  right: -1.5rem;
  background: #b241d1;
  color: white;
  border: none;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.close-modal:hover {
  background: #9a36b8;
}

/* Адаптивность */
@media (max-width: 768px) {
  .task-card {
    padding: 12px;
  }
  
  .task-header {
    flex-direction: column;
  }
  
  .add-button {
    align-self: flex-start;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
  
  .close-modal {
    top: -1rem;
    right: -1rem;
    width: 2rem;
    height: 2rem;
    font-size: 1.2rem;
  }
  
  .task-table-container {
    overflow-x: auto;
  }
  
  .task-table-container table {
    min-width: 500px;
  }
}
</style>