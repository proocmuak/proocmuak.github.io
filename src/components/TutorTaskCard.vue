<script>
import { supabase } from '../supabase';
import DOMPurify from 'dompurify';
import TaskEditorModal from './TaskEditorModal.vue';

export default {
  name: 'TutorTaskCard',
  components: {
    TaskEditorModal
  },
  props: {
    task: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      showImageModal: false,
      selectedImage: '',
      showEditorModal: false,
      isFirstPart: false
    };
  },
  computed: {
    // Проверяем оба типа таблиц
    hasStructuredTableData() {
      return this.task.table_data && 
             this.task.table_data.content && 
             this.task.table_data.content.length > 0;
    },
    
    hasHtmlTables() {
      return this.task.text && this.task.text.includes('<table');
    },
    
    hasAnyTableData() {
      return this.hasStructuredTableData || this.hasHtmlTables;
    },

    // Извлекаем HTML таблицы из текста
    extractedHtmlTables() {
      if (!this.task.text) return [];
      
      const tables = [];
      const tableRegex = /<table[\s\S]*?<\/table>/gi;
      let match;
      
      while ((match = tableRegex.exec(this.task.text)) !== null) {
        tables.push(match[0]);
      }
      
      return tables;
    },

    // Текст без таблиц (всегда удаляем таблицы)
    taskTextWithoutTables() {
      if (!this.task.text) return '';
      
      let text = this.task.text;
      
      // Всегда удаляем таблицы, так как они рендерятся отдельно
      text = text.replace(/<table[\s\S]*?<\/table>/gi, '');
      
      return this.formatTextWithParagraphs(text);
    },

    formattedAnswer() {
      if (!this.task.answer) return '';
      const answer = this.task.answer.toString();
      
      if (/^\d+$/.test(answer.trim())) {
        return answer;
      }
      
      return this.formatTextWithParagraphs(answer);
    },
    
    formattedExplanation() {
      if (!this.task.explanation) return '';
      const explanation = this.task.explanation.toString();
      
      if (/^\d+$/.test(explanation.trim())) {
        return explanation;
      }
      
      return this.formatTextWithParagraphs(explanation);
    },
    
    hasAnswerImages() {
      return this.task.image_answer && this.task.image_answer.length > 0;
    },
    
    hasExplanationImages() {
      return this.task.image_explanation && this.task.image_explanation.length > 0;
    }
  },
  methods: {
    sanitizeHtml(html) {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'sub', 'sup', 'ul', 'ol', 'li', 'div', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
        ALLOWED_ATTR: ['style', 'class', 'border', 'cellpadding', 'cellspacing', 'width', 'height', 'align', 'valign', 'colspan', 'rowspan']
      });
    },

    formatTextWithParagraphs(text) {
      if (!text) return '';
      
      if (text.includes('<') && text.includes('>')) {
        return text;
      }
      
      let formattedText = text
        .trim()
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
      
      if (!formattedText.startsWith('<p>') && !formattedText.includes('</p>')) {
        formattedText = `<p>${formattedText}</p>`;
      }
      
      return formattedText;
    },

    getImageUrl(imagePath) {
      if (imagePath.startsWith('http')) return imagePath;
      
      const { data: { publicUrl } } = supabase
        .storage
        .from('task-images')
        .getPublicUrl(imagePath);
      
      return publicUrl;
    },

    openImageModal(imageUrl) {
      this.selectedImage = imageUrl;
      this.showImageModal = true;
      document.body.style.overflow = 'hidden';
    },

    closeImageModal() {
      this.showImageModal = false;
      document.body.style.overflow = '';
    },

    openEditor() {
      this.showEditorModal = true;
      document.body.style.overflow = 'hidden';
    },

    closeEditor() {
      this.showEditorModal = false;
      document.body.style.overflow = '';
    },

    async handleTaskUpdated(updatedTask) {
      if (!updatedTask || !updatedTask.id) {
        console.error('Получена невалидная задача:', updatedTask);
        return;
      }
      
      this.$emit('task-updated', updatedTask);
      this.closeEditor();
    },

    async handleTaskDeleted() {
      this.$emit('task-deleted', this.task.id);
      this.closeEditor();
    }
  },
  mounted() {
    this.isFirstPart = this.task.part === 'Первая часть';
  }
}
</script>

<template>
  <div class="task-card">
    <div class="task-header">
      <div class="task-meta">
        <span class="task-number">#{{ task.id }}</span>
        <span class="task-number">Задание №{{ task.number }}</span>
        <span class="task-topic">Тема: {{ task.topic }}</span>
        <span class="task-section">Раздел: {{ task.section }}</span>
        <span class="task-points">{{ task.points }} балл(а)</span>
        <span class="task-difficulty">Сложность: {{ task.difficulty }}</span>
      </div>
      <div class="task-actions">
        <button class="edit-button" @click.stop="openEditor">✏️ Редактировать</button>
      </div>
    </div>
    
    <div class="task-content">
      <!-- Основной текст задания -->
      <div class="task-text" v-html="sanitizeHtml(taskTextWithoutTables)" @copy.prevent></div>
      
      <!-- Единый блок для таблиц -->
      <div v-if="hasAnyTableData" class="tables-container">
        <!-- Приоритет: сначала структурированные таблицы -->
        <div v-if="hasStructuredTableData" class="task-table-container">
          <table :class="{ 'with-borders': task.table_data.borders }">
            <tr v-for="(row, rowIndex) in task.table_data.content" :key="'row-'+rowIndex">
              <td v-for="(cell, colIndex) in row" :key="'cell-'+rowIndex+'-'+colIndex">
                <div v-html="sanitizeHtml(cell || '&nbsp;')"></div>
              </td>
            </tr>
          </table>
        </div>
        
        <!-- Если нет структурированных, показываем HTML таблицы -->
        <div v-else-if="extractedHtmlTables.length > 0" class="html-tables-container">
          <div v-for="(tableHtml, index) in extractedHtmlTables" 
               :key="'html-table-'+index" 
               class="html-table-wrapper">
            <div v-html="sanitizeHtml(tableHtml)" class="html-table-content"></div>
          </div>
        </div>
      </div>
      
      <!-- Изображения задания -->
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
              @click.stop="openImageModal(getImageUrl(image))"
              loading="lazy"
            >
          </div>
        </div>
      </div>

      <div class="answer-section">
        <div class="correct-answer">
          <strong>Правильный ответ:</strong> 
          <span v-html="sanitizeHtml(formattedAnswer)"></span>
          
          <div v-if="hasAnswerImages" class="answer-images">
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
                  @click.stop="openImageModal(getImageUrl(image))"
                  loading="lazy"
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="task.explanation || hasExplanationImages" class="explanation-section">
        <div class="explanation-title">Пояснение:</div>
        <div v-if="task.explanation" class="explanation-content">
          <span v-html="sanitizeHtml(formattedExplanation)"></span>
        </div>
        
        <div v-if="hasExplanationImages" class="explanation-images">
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
                @click.stop="openImageModal(getImageUrl(image))"
                loading="lazy"
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для изображений -->
    <div v-if="showImageModal" class="image-modal" @click.self="closeImageModal">
      <div class="modal-content">
        <img :src="selectedImage" class="modal-image">
        <button class="close-modal" @click="closeImageModal">×</button>
      </div>
    </div>

    <!-- Модальное окно редактора (рендерится в body) -->
    <Teleport to="body">
      <TaskEditorModal
        v-if="showEditorModal"
        :task="task"
        :subject="task.subject"
        @close="closeEditor"
        @task-updated="handleTaskUpdated"
        @task-deleted="handleTaskDeleted"
      />
    </Teleport>
  </div>
</template>

<style scoped>
*{
  font-family: Evolventa;
}
.task-card {
  border: 0.0625rem solid #b241d1;
  border-radius: 0.5rem;
  padding: 1.25rem;
  background: white;
  width: 100%;
  margin-bottom: 1.25rem;
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.1);
  overflow: hidden;
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
}

.task-card:hover {
  box-shadow: 0 0.25rem 1rem rgba(178, 65, 209, 0.2);
  transform: translateY(-2px);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.9rem;
  padding-bottom: 0.6rem;
  border-bottom: 0.0625rem solid #eee;
  gap: 0.6rem;
  position: relative;
}

.task-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.task-number {
  font-weight: bold;
  color: #b241d1;
  font-size: 1.1rem;
}

.task-topic, .task-section, .task-points, .task-difficulty {
  font-size: 0.9rem;
  color: #666;
}

.task-actions {
  flex-shrink: 0;
}

.edit-button {
  padding: 0.5rem 1rem;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 0.4rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.edit-button:hover {
  background-color: #9a36b8;
}

.task-content {
  margin-bottom: 0.9rem;
  width: 100%;
}

.task-text {
  line-height: 1.6;
  color: #333;
  margin-bottom: 1.25rem;
  font-size: 1rem;
  word-break: break-word;
  overflow-wrap: anywhere;
  hyphens: auto;
}

.task-text :deep(p) {
  margin-bottom: 0.8rem;
}

.task-text :deep(br) {
  content: "";
  display: block;
  margin-bottom: 0.4rem;
}

.task-text :deep(ul),
.task-text :deep(ol) {
  margin: 0.8rem 0;
  padding-left: 1.5rem;
}

.task-text :deep(li) {
  margin-bottom: 0.4rem;
}

/* Стили для структурированных таблиц */
.task-table-container {
  margin: 1rem 0;
  overflow-x: auto;
}

.task-table-container table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}

.task-table-container table.with-borders {
  border: 1px solid #ddd;
}

.task-table-container table.with-borders td,
.task-table-container table.with-borders th {
  border: 1px solid #ddd;
  padding: 8px;
}

.task-table-container td, 
.task-table-container th {
  padding: 8px;
  vertical-align: top;
}

.task-table-container th {
  background-color: #f5f5f5;
  font-weight: bold;
}

.task-table-container tr:nth-child(even) {
  background-color: #f9f9f9;
}

/* Стили для HTML таблиц */
.html-tables-container {
  margin: 1rem 0;
}

.html-table-wrapper {
  margin: 1rem 0;
  overflow-x: auto;
}

.html-table-content {
  width: 100%;
}

.html-table-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.html-table-content :deep(table) {
  border: 1px solid #ddd;
}

.html-table-content :deep(td),
.html-table-content :deep(th) {
  border: 1px solid #ddd;
  padding: 8px;
  vertical-align: top;
}

.html-table-content :deep(th) {
  background-color: #f5f5f5;
  font-weight: bold;
}

.html-table-content :deep(tr:nth-child(even)) {
  background-color: #f9f9f9;
}

/* Остальные стили */
.task-images {
  margin-bottom: 1.25rem;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.8rem;
  margin-top: 0.8rem;
}

.image-container {
  position: relative;
  padding-top: 100%;
  overflow: hidden;
  border-radius: 0.4rem;
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
  transition: transform 0.3s ease;
}

.task-image:hover {
  transform: scale(1.03);
}

.answer-section {
  margin-top: 1.25rem;
  padding: 0.9rem;
  background-color: #f0faf0;
  border-left: 0.25rem solid #2e7d32;
  border-radius: 0.4rem;
  color: #2e7d32;
}

.correct-answer :deep(p) {
  margin: 0.5rem 0;
  color: #2e7d32;
}

.explanation-section {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  border-left: 4px solid #b241d1;
}

.explanation-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.explanation-content {
  line-height: 1.6;
  color: #444;
}

.explanation-content :deep(p) {
  margin-bottom: 0.8rem;
}

.explanation-content :deep(p:last-child) {
  margin-bottom: 0;
}

.explanation-content :deep(br) {
  content: "";
  display: block;
  margin-bottom: 0.4rem;
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
  z-index: 10000;
  padding: 1rem;
}
.task-table-container :deep(sub),
.html-table-content :deep(sub) {
  vertical-align: sub;
  font-size: 0.8em;
}

.task-table-container :deep(sup),
.html-table-content :deep(sup) {
  vertical-align: super;
  font-size: 0.8em;
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
  border-radius: 0.4rem;
  box-shadow: 0 0 1rem rgba(0, 0, 0, 0.5);
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

@media (max-width: 48rem) {
  .task-card {
    padding: 0.9rem;
    border-radius: 0.4rem;
  }
  
  .task-header {
    flex-direction: column;
    gap: 0.3rem;
  }
  
  .task-actions {
    align-self: flex-start;
    margin-top: 0.5rem;
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
  
  /* Адаптивные стили для таблиц */
  .task-table-container,
  .html-table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .task-table-container table,
  .html-table-content :deep(table) {
    min-width: 500px;
  }
}
</style>