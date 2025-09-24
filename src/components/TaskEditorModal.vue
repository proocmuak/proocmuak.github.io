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
          <div class="editor-toolbar">
            <button @click="insertTable('text')" class="toolbar-button" title="Вставить таблицу">
              <i class="table-icon">📊</i>
            </button>
            <button @click="formatText('text', 'sub')" class="toolbar-button" title="Нижний индекс">
              <span class="button-text">x<span class="subscript">2</span></span>
            </button>
            <button @click="formatText('text', 'sup')" class="toolbar-button" title="Верхний индекс">
              <span class="button-text">x<span class="superscript">2</span></span>
            </button>
            <button @click="clearFormatting('text')" class="toolbar-button" title="Очистить форматирование">
              🧹
            </button>
            <button @click="triggerFileInput('text')" class="toolbar-button" title="Добавить изображение">
              📷
            </button>
          </div>
          <div 
            class="task-editor"
            contenteditable="true"
            ref="textEditor"
            @input="updateEditedTask('text', $event)"
            @paste="handlePaste($event, 'text')"
            placeholder="Введите текст задания..."
          ></div>
          
          <!-- Препросмотр изображений текста задания -->
          <div class="image-preview" v-if="uploadedImages.length > 0">
            <div v-for="(image, index) in uploadedImages" :key="image.id" class="preview-item">
              <img :src="image.preview" class="preview-image">
              <button @click="removeImage(index)" class="remove-image-btn" :disabled="isUploading">
                ×
              </button>
            </div>
          </div>
        </div>

        <!-- Поле ответа -->
        <div class="text-editor" id="answer-editor">
          <label>Ответ:</label>
          <div class="editor-toolbar">
            <button @click="formatText('answer', 'sub')" class="toolbar-button" title="Нижний индекс">
              <span class="button-text">x<span class="subscript">2</span></span>
            </button>
            <button @click="formatText('answer', 'sup')" class="toolbar-button" title="Верхний индекс">
              <span class="button-text">x<span class="superscript">2</span></span>
            </button>
            <button @click="clearFormatting('answer')" class="toolbar-button" title="Очистить форматирование">
              🧹
            </button>
          </div>
          <div 
            class="task-editor answer-editor"
            contenteditable="true"
            ref="answerEditor"
            @input="updateEditedTask('answer', $event)"
            @paste="handlePaste($event, 'answer')"
            placeholder="Введите ответ на задание..."
          ></div>
        </div>

        <!-- Поле для пояснения -->
        <div class="text-editor">
          <label>Пояснение к ответу:</label>
          <div class="editor-toolbar">
            <button @click="formatText('explanation', 'sub')" class="toolbar-button" title="Нижний индекс">
              <span class="button-text">x<span class="subscript">2</span></span>
            </button>
            <button @click="formatText('explanation', 'sup')" class="toolbar-button" title="Верхний индекс">
              <span class="button-text">x<span class="superscript">2</span></span>
            </button>
            <button @click="clearFormatting('explanation')" class="toolbar-button" title="Очистить форматирование">
              🧹
            </button>
            <button @click="triggerFileInput('explanation')" class="toolbar-button" title="Добавить изображение">
              📷
            </button>
          </div>
          <div 
            class="task-editor"
            contenteditable="true"
            ref="explanationEditor"
            @input="updateEditedTask('explanation', $event)"
            @paste="handlePaste($event, 'explanation')"
            placeholder="Введите пояснение к ответу (опционально)..."
          ></div>
          
          <!-- Препросмотр изображений пояснения -->
          <div class="image-preview" v-if="explanationImages.length > 0">
            <div v-for="(image, index) in explanationImages" :key="image.id" class="preview-item">
              <img :src="image.preview" class="preview-image">
              <button @click="removeExplanationImage(index)" class="remove-image-btn" :disabled="isUploading">
                ×
              </button>
            </div>
          </div>
        </div>

        <!-- Загрузка новых изображений -->
        <div class="image-uploader">
          <label>Загрузить новые изображения:</label>
          <div class="upload-controls">
            <input 
              type="file" 
              ref="fileInput" 
              @change="handleFileUpload" 
              multiple 
              accept="image/*" 
              style="display: none"
            >
            <button @click="triggerFileInput('text')" class="upload-button" :disabled="isUploading">
              {{ isUploading ? 'Загрузка...' : 'Выбрать файлы' }}
            </button>
            <span class="file-info">{{ uploadStatus }}</span>
          </div>
        </div>

        <!-- Информация о существующих изображениях -->
        <div class="images-info" v-if="hasExistingImages">
          <h4>Существующие изображения:</h4>
          <div class="images-list">
            <div v-if="task.images && task.images.length" class="image-group">
              <strong>Текст задания:</strong>
              <span>{{ task.images.length }} изображений</span>
              <button @click="removeExistingImages('text')" class="remove-existing-btn" :disabled="isLoading">
                Удалить все
              </button>
            </div>
            <div v-if="task.image_answer && task.image_answer.length" class="image-group">
              <strong>Ответ:</strong>
              <span>{{ task.image_answer.length }} изображений</span>
              <button @click="removeExistingImages('answer')" class="remove-existing-btn" :disabled="isLoading">
                Удалить все
              </button>
            </div>
            <div v-if="task.image_explanation && task.image_explanation.length" class="image-group">
              <strong>Пояснение:</strong>
              <span>{{ task.image_explanation.length }} изображений</span>
              <button @click="removeExistingImages('explanation')" class="remove-existing-btn" :disabled="isLoading">
                Удалить все
              </button>
            </div>
          </div>
        </div>

        <!-- Модальное окно для создания/редактирования таблицы -->
        <div v-if="showTableModal" class="table-modal-overlay">
          <div class="table-modal-content">
            <h3>{{ editingTable ? 'Редактирование таблицы' : 'Создание таблицы' }}</h3>
            
            <div class="table-controls">
              <div class="control-row">
                <label>Строки:</label>
                <input 
                  type="number" 
                  v-model.number="tableRows" 
                  min="1" 
                  max="10" 
                  class="table-input"
                  @change="updateTableSize"
                >
                <label>Столбцы:</label>
                <input 
                  type="number" 
                  v-model.number="tableCols" 
                  min="1" 
                  max="10" 
                  class="table-input"
                  @change="updateTableSize"
                >
              </div>
              <div class="control-row">
                <label>
                  <input type="checkbox" v-model="tableBorders"> Границы таблицы
                </label>
              </div>
            </div>
            
            <!-- Предпросмотр таблицы -->
            <div class="table-preview-section">
              <h4>Предпросмотр:</h4>
              <div class="preview-table-container">
                <table :class="{ 'with-borders': tableBorders }" v-html="generateTablePreviewHtml()"></table>
              </div>
            </div>
            
            <!-- Редактируемая таблица -->
            <div class="editable-table-section">
              <h4>Редактирование содержимого:</h4>
              <div class="editable-table-container">
                <table :class="{ 'with-borders': tableBorders }">
                  <tr v-for="(row, rowIndex) in tableContent" :key="rowIndex">
                    <td v-for="(cell, colIndex) in row" :key="colIndex">
                      <div 
                        class="table-cell-editor"
                        contenteditable="true"
                        @input="handleTableCellInput(rowIndex, colIndex, $event)"
                        @blur="handleTableCellBlur(rowIndex, colIndex, $event)"
                        @focus="activeTableCell = $event.target"
                        ref="tableCells"
                      ></div>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Панель инструментов для ячеек таблицы -->
              <div class="table-toolbar">
                <button @click="formatTableCell('sub')" class="toolbar-button" title="Нижний индекс">
                  <span class="button-text">x<span class="subscript">2</span></span>
                </button>
                <button @click="formatTableCell('sup')" class="toolbar-button" title="Верхний индекс">
                  <span class="button-text">x<span class="superscript">2</span></span>
                </button>
                <button @click="clearTableFormatting()" class="toolbar-button" title="Очистить форматирование">
                  🧹
                </button>
              </div>
            </div>
            
            <div class="modal-buttons">
              <button @click="insertTableToText" class="modal-button primary">
                {{ editingTable ? 'Обновить' : 'Вставить' }}
              </button>
              <button @click="showTableModal = false" class="modal-button">Отмена</button>
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
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase';
import CustomDropdown from './CustomDropdown.vue';
import { chem_ege_sections } from '../assets/arrays/list_of_sections.js';

const chemTopicsModules = import.meta.glob('../assets/arrays/topics/chem_ege/*.js', { eager: true });
const bioTopicsModules = import.meta.glob('../assets/arrays/topics/biology_ege/*.js', { eager: true });

const processModules = (modules) => {
  const result = {};
  for (const path in modules) {
    const fileName = path.split('/').pop().replace('.js', '').replace(/_/g, ' ');
    result[fileName] = modules[path].default;
  }
  return result;
};

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
        explanation: '',
        has_table: false,
        table_data: null
      },
      isLoading: false,
      isUploading: false,
      availableSections: [],
      availableTopics: [],
      parts: ['Первая часть', 'Вторая часть'],
      topicsData: {
        'Химия ЕГЭ': {},
        'Биология ЕГЭ': {}
      },
      sectionMappings: {
        'Химия ЕГЭ': {
          'Общая химия': 'general chemistry',
          'Органическая химия': 'organic chemistry',
          'Неорганическая химия': 'inorganic chemistry',
          'Задачи': 'task chemistry'
        },
        'Биология ЕГЭ': {
          'Цитология': 'citology',
          'Биохимия': 'biochemistry',
          'Метаболизм клетки': 'cell metabolism',
          'Задачи на биосинтез белка': 'task for protein biosynthesis',
          'Клеточный цикл': 'cell cycle',
          'Размножение и развитие': 'reproduction and development',
          'Разнообразие организмов': 'diversity of organisms',
          'Генетика': 'genetics',
          'Биология как наука': 'biology as a science',
          'Задачи на закон Харди-Вайнберга': 'problems with the Hardy-Weinberg law',
          'Селекция и биотехнология': 'breeding and biotechnology',
          'Анатомия и физиология': 'human anatomy',
          'Ботаника': 'botany',
          'Зоология': 'zoology',
          'Эволюция': 'evolution',
          'Экология': 'ecology',
          'Анализ информации': 'information analysis',
          'Методология эксперимента': 'experimental methodology'
        }
      },
      uploadedImages: [],
      explanationImages: [],
      uploadStatus: 'Файлы не выбраны',
      currentUploadType: 'text',
      showTableModal: false,
      tableRows: 2,
      tableCols: 2,
      tableBorders: true,
      editingTable: false,
      tableContent: this.initializeTableContent(2, 2),
      originalTableHtml: '',
      currentTextarea: 'text',
      existingImagesToRemove: {
        text: [],
        answer: [],
        explanation: []
      },
      activeTableCell: null
    };
  },
  computed: {
    hasExistingImages() {
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
      if (!this.editedTask.section || !this.subject) return this.availableTopics;
      
      const sectionKey = this.sectionMappings[this.subject]?.[this.editedTask.section];
      return sectionKey ? this.topicsData[this.subject][sectionKey] || this.availableTopics : this.availableTopics;
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
            explanation: newTask.explanation || '',
            has_table: newTask.has_table || false,
            table_data: newTask.table_data || null
          };
          
          this.$nextTick(() => {
            if (this.$refs.textEditor) this.$refs.textEditor.innerHTML = this.editedTask.text;
            if (this.$refs.answerEditor) this.$refs.answerEditor.innerHTML = this.editedTask.answer;
            if (this.$refs.explanationEditor) this.$refs.explanationEditor.innerHTML = this.editedTask.explanation;
            
            if (this.editedTask.has_table && this.editedTask.table_data) {
              this.syncTableFromData();
            }
          });
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
    },
    tableRows(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.updateTableSize();
      }
    },
    tableCols(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.updateTableSize();
      }
    }
  },
  created() {
    this.initializeTopics();
  },
  mounted() {
    this.$nextTick(() => {
      this.updateTableCellContents();
    });
  },
  methods: {
    initializeTopics() {
      this.topicsData['Химия ЕГЭ'] = processModules(chemTopicsModules);
      this.topicsData['Биология ЕГЭ'] = processModules(bioTopicsModules);
    },
    getSubjectConfig() {
      const configs = {
        'Химия ЕГЭ': { firstPartMax: 28 },
        'Биология ЕГЭ': { firstPartMax: 21 }
      };
      return configs[this.subject];
    },
    async loadSectionsAndTopics() {
      try {
        if (this.subject === 'Химия ЕГЭ') {
          this.availableSections = chem_ege_sections;
          this.availableTopics = Object.values(this.topicsData['Химия ЕГЭ']).flat();
        } else if (this.subject === 'Биология ЕГЭ') {
          this.availableSections = Object.keys(this.sectionMappings['Биология ЕГЭ']);
          this.availableTopics = Object.values(this.topicsData['Биология ЕГЭ']).flat();
        } else {
          this.availableSections = [];
          this.availableTopics = [];
        }
      } catch (error) {
        console.error('Ошибка загрузки разделов и тем:', error);
      }
    },
    initializeTableContent(rows, cols) {
      const content = [];
      for (let i = 0; i < rows; i++) {
        const row = [];
        for (let j = 0; j < cols; j++) {
          row.push('');
        }
        content.push(row);
      }
      return content;
    },
    updateTableSize() {
      const newContent = [];
      
      for (let i = 0; i < this.tableRows; i++) {
        const newRow = [];
        for (let j = 0; j < this.tableCols; j++) {
          if (this.tableContent[i] && this.tableContent[i][j] !== undefined) {
            newRow.push(this.tableContent[i][j]);
          } else {
            newRow.push('');
          }
        }
        newContent.push(newRow);
      }
      
      this.tableContent = newContent;
      
      this.$nextTick(() => {
        this.updateTableCellContents();
      });
    },
    updateTableCellContents() {
      const cells = this.$refs.tableCells;
      if (!cells) return;
      
      cells.forEach((cell, index) => {
        const rowIndex = Math.floor(index / this.tableCols);
        const colIndex = index % this.tableCols;
        
        if (this.tableContent[rowIndex] && this.tableContent[rowIndex][colIndex] !== undefined) {
          cell.innerHTML = this.tableContent[rowIndex][colIndex];
        }
      });
    },
    resetTableContent() {
      this.tableContent = this.initializeTableContent(this.tableRows, this.tableCols);
    },
    
    // Методы для работы с таблицей (без прыгающего курсора)
    handleTableCellInput(rowIndex, colIndex, event) {
      this.tableContent[rowIndex][colIndex] = event.target.innerHTML;
    },
    
    handleTableCellBlur(rowIndex, colIndex, event) {
      const cleanedContent = this.cleanHtmlContent(event.target.innerHTML);
      this.tableContent[rowIndex][colIndex] = cleanedContent;
      
      if (event.target.innerHTML !== cleanedContent) {
        event.target.innerHTML = cleanedContent;
      }
    },
    
    cleanHtmlContent(html) {
      let cleaned = html
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      
      cleaned = cleaned.replace(/<br\s*\/?>/g, '');
      
      return cleaned;
    },
    
    getCursorPosition(element) {
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return 0;
      
      const range = selection.getRangeAt(0);
      const preRange = range.cloneRange();
      preRange.selectNodeContents(element);
      preRange.setEnd(range.endContainer, range.endOffset);
      
      return preRange.toString().length;
    },
    
    setCursorPosition(element, position) {
      const selection = window.getSelection();
      const range = document.createRange();
      
      let currentPos = 0;
      let foundNode = null;
      let foundOffset = 0;
      
      function findPosition(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const length = node.textContent.length;
          if (currentPos + length >= position) {
            foundNode = node;
            foundOffset = position - currentPos;
            return true;
          }
          currentPos += length;
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            if (findPosition(node.childNodes[i])) {
              return true;
            }
          }
        }
        return false;
      }
      
      if (findPosition(element)) {
        range.setStart(foundNode, foundOffset);
        range.setEnd(foundNode, foundOffset);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    },
    
    formatTableCell(formatType) {
      if (!this.activeTableCell) return;
      
      const cursorPosition = this.getCursorPosition(this.activeTableCell);
      const selection = window.getSelection();
      const selectedText = selection.toString();
      
      this.activeTableCell.focus();
      
      if (selectedText.trim()) {
        if (formatType === 'sub') {
          document.execCommand('subscript');
        } else if (formatType === 'sup') {
          document.execCommand('superscript');
        }
      } else {
        const exampleText = formatType === 'sub' ? 'индекс' : 'степень';
        const tag = formatType === 'sub' ? 'sub' : 'sup';
        document.execCommand('insertHTML', false, `<${tag}>${exampleText}</${tag}>`);
      }
      
      this.$nextTick(() => {
        this.setCursorPosition(this.activeTableCell, cursorPosition);
        
        const cells = this.$refs.tableCells;
        if (cells) {
          const index = cells.indexOf(this.activeTableCell);
          if (index !== -1) {
            const rowIndex = Math.floor(index / this.tableCols);
            const colIndex = index % this.tableCols;
            this.tableContent[rowIndex][colIndex] = this.activeTableCell.innerHTML;
          }
        }
      });
    },
    
    clearTableFormatting() {
      if (!this.activeTableCell) return;
      
      const cursorPosition = this.getCursorPosition(this.activeTableCell);
      
      this.activeTableCell.focus();
      document.execCommand('removeFormat');
      document.execCommand('unlink');
      
      this.$nextTick(() => {
        this.setCursorPosition(this.activeTableCell, cursorPosition);
        
        const cells = this.$refs.tableCells;
        if (cells) {
          const index = cells.indexOf(this.activeTableCell);
          if (index !== -1) {
            const rowIndex = Math.floor(index / this.tableCols);
            const colIndex = index % this.tableCols;
            this.tableContent[rowIndex][colIndex] = this.activeTableCell.innerHTML;
          }
        }
      });
    },
    
    insertTable(editorType) {
      this.currentTextarea = editorType;
      const editor = this.$refs[`${editorType}Editor`];
      if (!editor) return;
      
      editor.focus();
      const selection = window.getSelection();
      
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let container = range.startContainer;
        
        while (container && container !== editor) {
          if (container.tagName === 'TABLE') {
            this.editingTable = true;
            this.originalTableHtml = container.outerHTML;
            this.parseTableElement(container);
            break;
          }
          container = container.parentNode;
        }
        
        if (!container || container === editor) {
          this.setupNewTable();
        }
      } else {
        this.setupNewTable();
      }
      
      this.showTableModal = true;
    },
    
    parseTableElement(tableElement) {
      this.tableBorders = tableElement.hasAttribute('border') || 
                         tableElement.style.border !== 'none';
      this.tableRows = tableElement.rows.length;
      this.tableCols = tableElement.rows[0]?.cells.length || 0;
      
      this.tableContent = [];
      for (let i = 0; i < this.tableRows; i++) {
        const row = [];
        for (let j = 0; j < this.tableCols; j++) {
          const cell = tableElement.rows[i]?.cells[j];
          row.push(cell ? cell.innerHTML : '');
        }
        this.tableContent.push(row);
      }
      
      this.$nextTick(() => {
        this.updateTableCellContents();
      });
    },
    
    setupNewTable() {
      this.editingTable = false;
      this.originalTableHtml = '';
      this.tableRows = 2;
      this.tableCols = 2;
      this.tableBorders = true;
      this.resetTableContent();
      
      this.$nextTick(() => {
        this.updateTableCellContents();
      });
    },
    
    insertTableToText() {
      const editor = this.$refs[`${this.currentTextarea}Editor`];
      if (!editor) return;
      
      editor.focus();
      
      const tableHtml = this.generateTableHtml();
      
      if (this.editingTable) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          let container = range.startContainer;
          
          while (container && container !== editor) {
            if (container.tagName === 'TABLE') {
              container.outerHTML = tableHtml;
              break;
            }
            container = container.parentNode;
          }
        }
      } else {
        document.execCommand('insertHTML', false, tableHtml);
      }
      
      this.updateEditedTask(this.currentTextarea, { target: editor });
      
      if (this.currentTextarea === 'text') {
        this.updateTableData();
      }
      
      this.showTableModal = false;
    },
    
    generateTableHtml() {
      let html = '<table';
      html += this.tableBorders ? 
        ' border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; margin: 10px 0;"' : 
        ' style="border-collapse: collapse; border: none; margin: 10px 0;"';
      html += '>';
      
      for (let i = 0; i < this.tableRows; i++) {
        html += '<tr>';
        for (let j = 0; j < this.tableCols; j++) {
          const content = this.tableContent[i][j] || '&nbsp;';
          html += `<td style="padding: 8px; border: ${this.tableBorders ? '1px solid #ddd' : 'none'}; vertical-align: top;">${content}</td>`;
        }
        html += '</tr>';
      }
      
      html += '</table>';
      return html;
    },
    
    updateTableData() {
      this.editedTask.has_table = true;
      this.editedTask.table_data = {
        rows: this.tableRows,
        cols: this.tableCols,
        borders: this.tableBorders,
        content: JSON.parse(JSON.stringify(this.tableContent))
      };
    },
    
    generateTablePreviewHtml() {
      let html = '';
      for (let i = 0; i < this.tableRows; i++) {
        html += '<tr>';
        for (let j = 0; j < this.tableCols; j++) {
          const content = this.tableContent[i][j] || '&nbsp;';
          html += `<td style="padding: 8px; border: 1px solid #ddd; min-height: 40px;">${content}</td>`;
        }
        html += '</tr>';
      }
      return html;
    },
    
    syncTableFromData() {
      if (this.editedTask.table_data) {
        const tableData = this.editedTask.table_data;
        this.tableRows = tableData.rows;
        this.tableCols = tableData.cols;
        this.tableBorders = tableData.borders;
        this.tableContent = JSON.parse(JSON.stringify(tableData.content));
        
        this.$nextTick(() => {
          this.updateTableCellContents();
        });
      }
    },
    
    formatText(editorType, formatType) {
      const editor = this.$refs[`${editorType}Editor`];
      if (!editor) return;
      
      editor.focus();
      const selection = window.getSelection();
      
      if (selection.toString().trim()) {
        if (formatType === 'sub') {
          document.execCommand('subscript');
        } else if (formatType === 'sup') {
          document.execCommand('superscript');
        }
      } else {
        const exampleText = formatType === 'sub' ? 'индекс' : 'степень';
        const tag = formatType === 'sub' ? 'sub' : 'sup';
        document.execCommand('insertHTML', false, `<${tag}>${exampleText}</${tag}>`);
      }
      
      this.updateEditedTask(editorType, { target: editor });
    },
    
    clearFormatting(editorType) {
      const editor = this.$refs[`${editorType}Editor`];
      if (!editor) return;
      
      editor.focus();
      document.execCommand('removeFormat');
      document.execCommand('unlink');
      this.updateEditedTask(editorType, { target: editor });
    },
    
    updateEditedTask(field, event) {
      this.editedTask[field] = event.target.innerHTML;
    },
    
    handlePaste(event, field) {
      event.preventDefault();
      const text = (event.clipboardData || window.clipboardData).getData('text/html') || 
                   (event.clipboardData || window.clipboardData).getData('text/plain');
      
      document.execCommand('insertHTML', false, text);
      this.updateEditedTask(field, { target: this.$refs[`${field}Editor`] });
    },
    
    triggerFileInput(type = 'text') {
      this.currentUploadType = type;
      this.$refs.fileInput.click();
    },
    
    async handleFileUpload(event) {
      const files = event.target.files;
      if (!files.length) return;
      
      this.isUploading = true;
      this.uploadStatus = `Загрузка ${files.length} файла(ов)...`;
      
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          if (file.size > 5 * 1024 * 1024) {
            this.uploadStatus = `Файл ${file.name} слишком большой (макс. 5MB)`;
            continue;
          }
          
          if (!file.type.match('image.*')) {
            this.uploadStatus = `Файл ${file.name} не является изображением`;
            continue;
          }
          
          const preview = await this.getImagePreview(file);
          
          const imageData = {
            file,
            preview,
            name: file.name,
            id: uuidv4()
          };
          
          if (this.currentUploadType === 'explanation') {
            this.explanationImages.push(imageData);
          } else {
            this.uploadedImages.push(imageData);
          }
        }
        
        this.updateUploadStatus();
      } catch (error) {
        console.error('Ошибка загрузки:', error);
        this.uploadStatus = 'Ошибка при загрузке файлов';
      } finally {
        this.isUploading = false;
        this.$refs.fileInput.value = '';
      }
    },
    
    updateUploadStatus() {
      const textCount = this.uploadedImages.length;
      const explanationCount = this.explanationImages.length;
      
      this.uploadStatus = `Текст: ${textCount}, Пояснение: ${explanationCount}`;
    },
    
    getImagePreview(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
    },
    
    removeImage(index) {
      this.uploadedImages.splice(index, 1);
      this.updateUploadStatus();
    },
    
    removeExplanationImage(index) {
      this.explanationImages.splice(index, 1);
      this.updateUploadStatus();
    },
    
    removeExistingImages(type) {
      if (confirm('Вы уверены, что хотите удалить все изображения этого типа?')) {
        this.existingImagesToRemove[type] = this.task[`image_${type}`] || this.task[type] || [];
        if (type === 'text') {
          this.task.images = [];
        } else if (type === 'answer') {
          this.task.image_answer = [];
        } else if (type === 'explanation') {
          this.task.image_explanation = [];
        }
      }
    },
    
    async uploadImagesToStorage(images, folder) {
      if (!images.length) return [];
      
      const uploadedUrls = [];
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) throw new Error('Not authenticated');
        
        for (const img of images) {
          const fileExt = img.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExt}`;
          const subjectFolder = this.subject === 'Химия ЕГЭ' ? 'chemistry' : 'biology';
          const filePath = `tasks/${subjectFolder}/${folder}/${fileName}`;
          
          const { error } = await supabase
            .storage
            .from('task-images')
            .upload(filePath, img.file, {
              upsert: false,
              contentType: img.file.type
            });
          
          if (error) throw error;
          
          const { data: { publicUrl } } = supabase
            .storage
            .from('task-images')
            .getPublicUrl(filePath);
            
          uploadedUrls.push(publicUrl);
        }
        
        return uploadedUrls;
      } catch (error) {
        console.error('Ошибка загрузки:', error);
        throw error;
      }
    },
    
    async deleteImagesFromStorage(imageUrls) {
      if (!imageUrls || !imageUrls.length) return;
      
      try {
        const subjectFolder = this.subject === 'Химия ЕГЭ' ? 'chemistry' : 'biology';
        
        for (const url of imageUrls) {
          const pathParts = url.split('/');
          const fileName = pathParts[pathParts.length - 1];
          const filePath = `tasks/${subjectFolder}/**/${fileName}`;
          
          const { data: files, error: listError } = await supabase
            .storage
            .from('task-images')
            .list(`tasks/${subjectFolder}`, {
              search: fileName
            });
          
          if (listError) {
            console.error('Ошибка поиска файла:', listError);
            continue;
          }
          
          if (files && files.length > 0) {
            const exactPath = files[0].name;
            const fullPath = `tasks/${subjectFolder}/${exactPath}`;
            
            const { error: deleteError } = await supabase
              .storage
              .from('task-images')
              .remove([fullPath]);
            
            if (deleteError) {
              console.error('Ошибка удаления файла:', deleteError);
            }
          }
        }
      } catch (error) {
        console.error('Ошибка при удалении изображений:', error);
      }
    },
    
    closeModal() {
      this.$emit('close');
    },
    
    async saveTask() {
      this.isLoading = true;
      
      try {
        if (this.editedTask.has_table && this.$refs.textEditor) {
          this.syncTableDataFromEditor();
        }
        
        const config = this.getSubjectConfig();
        if (!config) throw new Error('Неизвестный предмет');
        
        const tableName = this.subject === 'Химия ЕГЭ' 
          ? 'chemistry_ege_task_bank' 
          : 'biology_ege_task_bank';
        
        const [newTextImageUrls, newExplanationImageUrls] = await Promise.all([
          this.uploadImagesToStorage(this.uploadedImages, 'text'),
          this.uploadImagesToStorage(this.explanationImages, 'explanation')
        ]);
        
        await Promise.all([
          this.deleteImagesFromStorage(this.existingImagesToRemove.text),
          this.deleteImagesFromStorage(this.existingImagesToRemove.answer),
          this.deleteImagesFromStorage(this.existingImagesToRemove.explanation)
        ]);
        
        const finalTextImages = [
          ...(this.task.images || []).filter(img => !this.existingImagesToRemove.text.includes(img)),
          ...newTextImageUrls
        ];
        
        const finalExplanationImages = [
          ...(this.task.image_explanation || []).filter(img => !this.existingImagesToRemove.explanation.includes(img)),
          ...newExplanationImageUrls
        ];
        
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
            has_table: this.editedTask.has_table,
            table_data: this.editedTask.table_data,
            images: finalTextImages.length ? finalTextImages : null,
            image_explanation: finalExplanationImages.length ? finalExplanationImages : null,
          })
          .eq('id', this.task.id);
        
        if (error) throw error;
        
        this.$emit('task-updated', {
          ...this.task,
          ...this.editedTask,
          images: finalTextImages,
          image_explanation: finalExplanationImages
        });
        
        this.closeModal();
        
      } catch (error) {
        console.error('Ошибка сохранения задания:', error);
        alert('Ошибка при сохранении задания: ' + error.message);
      } finally {
        this.isLoading = false;
      }
    },
    
    syncTableDataFromEditor() {
      const editor = this.$refs.textEditor;
      if (!editor) return;
      
      const tableElement = editor.querySelector('table');
      if (!tableElement) return;
      
      this.parseTableElement(tableElement);
      this.updateTableData();
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
        
        await Promise.all([
          this.deleteImagesFromStorage(this.task.images || []),
          this.deleteImagesFromStorage(this.task.image_answer || []),
          this.deleteImagesFromStorage(this.task.image_explanation || [])
        ]);
        
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
  max-width: 900px;
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
  color: #666;
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
  background-color: #e9ecef;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
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
  background: white;
  font-size: 0.9rem;
}

.text-editor {
  margin-bottom: 20px;
}

.text-editor label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}

.editor-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.toolbar-button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-button:hover {
  background: #f8f9fa;
  border-color: #007bff;
}

.toolbar-button:active {
  background: #e3f2fd;
}

.button-text {
  font-size: 0.9rem;
}

.subscript, .superscript {
  font-size: 0.7em;
  line-height: 1;
}

.subscript {
  vertical-align: sub;
}

.superscript {
  vertical-align: super;
}

.task-editor {
  width: 100%;
  min-height: 80px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.95rem;
  line-height: 1.4;
  resize: vertical;
  font-family: inherit;
  overflow-y: auto;
  background: white;
}

.task-editor:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.task-editor[placeholder]:empty:before {
  content: attr(placeholder);
  color: #6c757d;
  font-style: italic;
}

.answer-editor {
  min-height: 60px;
}

sub, sup {
  font-size: 0.75em;
  line-height: 0;
  position: relative;
  vertical-align: baseline;
}

sub {
  bottom: -0.25em;
}

sup {
  top: -0.5em;
}

.image-preview {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.preview-item {
  position: relative;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
}

.preview-image {
  width: 100px;
  height: 100px;
  object-fit: cover;
}

.remove-image-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(255, 0, 0, 0.8);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-image-btn:hover {
  background: rgba(255, 0, 0, 1);
}

.image-uploader {
  margin: 20px 0;
  padding: 16px;
  border: 2px dashed #ddd;
  border-radius: 8px;
  background: #fafafa;
}

.image-uploader label {
  display: block;
  margin-bottom: 12px;
  font-weight: 600;
  color: #333;
}

.upload-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.upload-button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.upload-button:hover:not(:disabled) {
  background: #0056b3;
}

.upload-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.file-info {
  color: #666;
  font-size: 0.9rem;
}

.images-info {
  margin: 20px 0;
  padding: 16px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: #f8f9fa;
}

.images-info h4 {
  margin: 0 0 12px 0;
  color: #333;
}

.images-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.image-group {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: white;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.image-group strong {
  min-width: 80px;
  color: #495057;
}

.remove-existing-btn {
  padding: 4px 8px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  margin-left: auto;
}

.remove-existing-btn:hover:not(:disabled) {
  background: #c82333;
}

.remove-existing-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.table-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.table-modal-content {
  background: white;
  padding: 24px;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
}

.table-modal-content h3 {
  margin: 0 0 20px 0;
  color: #333;
}

.table-controls {
  margin-bottom: 20px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.control-row label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 600;
  min-width: auto;
}

.table-input {
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 60px;
}

.table-preview-section,
.editable-table-section {
  margin: 15px 0;
}

.table-preview-section h4,
.editable-table-section h4 {
  margin-bottom: 8px;
  color: #333;
}

.preview-table-container {
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 6px;
  background: #fafafa;
  overflow-x: auto;
}

.preview-table-container table {
  width: 100%;
  border-collapse: collapse;
}

.preview-table-container td {
  padding: 8px;
  border: 1px solid #ddd;
  min-height: 40px;
  vertical-align: top;
}

.editable-table-container {
  margin: 10px 0;
  overflow-x: auto;
}

.editable-table-container table {
  width: 100%;
  border-collapse: collapse;
}

.editable-table-container table.with-borders td {
  border: 1px solid #ddd;
}

.editable-table-container td {
  padding: 0;
}

.table-cell-editor {
  padding: 8px;
  min-height: 40px;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  background: white;
  outline: none;
  font-family: inherit;
  font-size: 0.9rem;
}

.table-cell-editor:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.table-toolbar {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.modal-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.modal-button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.modal-button.primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.modal-button.primary:hover {
  background: #0056b3;
  border-color: #0056b3;
}

.modal-button:hover {
  background: #f8f9fa;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #eee;
  background: #f8f9fa;
  border-radius: 0 0 12px 12px;
  position: sticky;
  bottom: 0;
}

.action-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.delete-button {
  padding: 10px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.delete-button:hover:not(:disabled) {
  background: #c82333;
}

.delete-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.right-buttons {
  display: flex;
  gap: 12px;
}

.cancel-button {
  padding: 10px 20px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.cancel-button:hover:not(:disabled) {
  background: #5a6268;
}

.cancel-button:disabled {
  background: #adb5bd;
  cursor: not-allowed;
}

.save-button {
  padding: 10px 20px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.save-button:hover:not(:disabled) {
  background: #218838;
}

.save-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* Адаптивность */
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
    align-items: stretch;
  }
  
  .right-buttons {
    justify-content: stretch;
  }
  
  .cancel-button,
  .save-button,
  .delete-button {
    flex: 1;
    text-align: center;
  }
  
  .table-modal-content {
    padding: 16px;
  }
  
  .control-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .modal-header h2 {
    font-size: 1.2rem;
  }
  
  .upload-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .modal-buttons {
    flex-direction: column;
  }
  
  .modal-button {
    width: 100%;
  }
  
  .table-preview-section,
  .editable-table-section {
    margin: 10px 0;
  }
}
</style>