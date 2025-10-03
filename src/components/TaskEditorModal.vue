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
const chemOgeTopicsModules = import.meta.glob('../assets/arrays/topics/chem_oge/*.js', { eager: true });
const bioOgeTopicsModules = import.meta.glob('../assets/arrays/topics/biology_oge/*.js', { eager: true });

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
        'Биология ЕГЭ': {},
        'Химия ОГЭ': {},
        'Биология ОГЭ': {}
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
        },
        'Химия ОГЭ': {
          'Основные понятия. Строение атома и периодический закон': 'Basic Concepts. Atomic Structure and the Periodic Law',
          'Химическая связь и свойства элементов': 'Chemical Bond and Properties of Elements',
          'Неорганическая химия': 'Inorganic Chemistry',
          'Химические реакции': 'Chemical Reactions',
          'Электролитическая диссоциация': 'Electrolytic Dissociation',
          'Расчёты в химии': 'Calculations in Chemistry',
          'Практические и экспериментальные задания': 'Practical and Experimental Tasks'
        },
        'Биология ОГЭ': {
          'Биология – наука о живой природе. Методы научного познания': 'Biology - The Science of Living Nature. Methods of Scientific Knowledge',
          'Среда обитания. Природные и искусственные сообщества. Человек и окружающая среда': 'Habitat. Natural and Artificial Communities',
          'Эволюционное развитие растений, животных и человека': 'Evolutionary Development of Plants, Animals, and Humans',
          'Организмы бактерий, грибов и лишайников': 'Organisms of Bacteria, Fungi, and Lichens',
          'Растительный организм. Систематические группы растений': 'The Plant Organism. Systematic Groups of Plants',
          'Животный организм. Систематические группы животных': 'The Animal Organism. Systematic Groups of Animals',
          'Человек и его здоровье': 'Humans and Their Health'
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
      if (!this.subject) return [];
      
      if (this.subject === 'Химия ЕГЭ') {
        if (!this.editedTask.part) {
          return Array.from({length: 34}, (_, i) => i + 1);
        }
        return this.editedTask.part === 'Первая часть'
          ? Array.from({length: 28}, (_, i) => i + 1)
          : Array.from({length: 6}, (_, i) => i + 29);
      } else if (this.subject === 'Биология ЕГЭ') {
        if (!this.editedTask.part) {
          return Array.from({length: 28}, (_, i) => i + 1);
        }
        return this.editedTask.part === 'Первая часть'
          ? Array.from({length: 21}, (_, i) => i + 1)
          : Array.from({length: 7}, (_, i) => i + 22);
      } else if (this.subject === 'Химия ОГЭ') {
        if (!this.editedTask.part) {
          return Array.from({length: 23}, (_, i) => i + 1);
        }
        return this.editedTask.part === 'Первая часть'
          ? Array.from({length: 19}, (_, i) => i + 1)
          : Array.from({length: 4}, (_, i) => i + 20);
      } else if (this.subject === 'Биология ОГЭ') {
        if (!this.editedTask.part) {
          return Array.from({length: 26}, (_, i) => i + 1);
        }
        return this.editedTask.part === 'Первая часть'
          ? Array.from({length: 21}, (_, i) => i + 1)
          : Array.from({length: 5}, (_, i) => i + 22);
      }
      
      return [];
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
    // Новый метод для определения имени таблицы
    getTaskTableName() {
      const subjectMap = {
        'Химия ЕГЭ': 'chemistry_ege_task_bank',
        'Химия ОГЭ': 'chemistry_oge_task_bank',
        'Биология ЕГЭ': 'biology_ege_task_bank',
        'Биология ОГЭ': 'biology_oge_task_bank'
      };
      return subjectMap[this.subject] || 'tasks';
    },

    initializeTopics() {
      this.topicsData['Химия ЕГЭ'] = processModules(chemTopicsModules);
      this.topicsData['Биология ЕГЭ'] = processModules(bioTopicsModules);
      this.topicsData['Химия ОГЭ'] = processModules(chemOgeTopicsModules);
      this.topicsData['Биология ОГЭ'] = processModules(bioOgeTopicsModules);
    },
    async loadSectionsAndTopics() {
      try {
        if (this.subject === 'Химия ЕГЭ') {
          this.availableSections = chem_ege_sections;
          this.availableTopics = Object.values(this.topicsData['Химия ЕГЭ']).flat();
        } else if (this.subject === 'Биология ЕГЭ') {
          this.availableSections = Object.keys(this.sectionMappings['Биология ЕГЭ']);
          this.availableTopics = Object.values(this.topicsData['Биология ЕГЭ']).flat();
        } else if (this.subject === 'Химия ОГЭ') {
          this.availableSections = Object.keys(this.sectionMappings['Химия ОГЭ']);
          this.availableTopics = Object.values(this.topicsData['Химия ОГЭ']).flat();
        } else if (this.subject === 'Биология ОГЭ') {
          this.availableSections = Object.keys(this.sectionMappings['Биология ОГЭ']);
          this.availableTopics = Object.values(this.topicsData['Биология ОГЭ']).flat();
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
    
    updateEditedTask(field, event) {
      this.editedTask[field] = event.target.innerHTML;
      
      if (field === 'text') {
        const hasTable = event.target.innerHTML.includes('<table');
        if (hasTable !== this.editedTask.has_table) {
          this.editedTask.has_table = hasTable;
        }
      }
    },
    
    handlePaste(event, field) {
      event.preventDefault();
      const text = (event.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    },
    
    formatText(field, formatType) {
      const editor = this.$refs[`${field}Editor`];
      if (!editor) return;
      
      editor.focus();
      const selection = window.getSelection();
      const selectedText = selection.toString();
      
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
      
      this.updateEditedTask(field, { target: editor });
    },
    
    clearFormatting(field) {
      const editor = this.$refs[`${field}Editor`];
      if (!editor) return;
      
      editor.focus();
      document.execCommand('removeFormat');
      document.execCommand('unlink');
      this.updateEditedTask(field, { target: editor });
    },
    
    triggerFileInput(type) {
      this.currentUploadType = type;
      this.$refs.fileInput.click();
    },
    
    async handleFileUpload(event) {
      const files = Array.from(event.target.files);
      if (files.length === 0) return;
      
      this.isUploading = true;
      this.uploadStatus = `Загрузка ${files.length} файла(ов)...`;
      
      try {
        const uploadPromises = files.map(file => this.uploadImage(file));
        const uploadedUrls = await Promise.all(uploadPromises);
        
        const imageObjects = uploadedUrls.map(url => ({
          id: uuidv4(),
          url,
          preview: url
        }));
        
        if (this.currentUploadType === 'text') {
          this.uploadedImages.push(...imageObjects);
        } else if (this.currentUploadType === 'explanation') {
          this.explanationImages.push(...imageObjects);
        }
        
        this.uploadStatus = `Успешно загружено ${files.length} файла(ов)`;
        
        setTimeout(() => {
          this.uploadStatus = 'Файлы не выбраны';
        }, 3000);
        
      } catch (error) {
        console.error('Ошибка загрузки файлов:', error);
        this.uploadStatus = 'Ошибка загрузки файлов';
      } finally {
        this.isUploading = false;
        event.target.value = '';
      }
    },
    
    async uploadImage(file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `task-images/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);
      
      if (uploadError) {
        throw new Error(uploadError.message);
      }
      
      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);
      
      return data.publicUrl;
    },
    
    removeImage(index) {
      this.uploadedImages.splice(index, 1);
    },
    
    removeExplanationImage(index) {
      this.explanationImages.splice(index, 1);
    },
    
    async removeExistingImages(type) {
      if (!this.task.id) return;
      
      this.isLoading = true;
      
      try {
        const tableName = this.getTaskTableName();
        const imageFieldMap = {
          text: 'images',
          answer: 'image_answer',
          explanation: 'image_explanation'
        };
        
        const field = imageFieldMap[type];
        if (!field) return;
        
        const { data: taskData, error: fetchError } = await supabase
          .from(tableName)
          .select(field)
          .eq('id', this.task.id)
          .single();
        
        if (fetchError) throw fetchError;
        
        const imagesToRemove = taskData[field] || [];
        
        const deletePromises = imagesToRemove.map(async (imageUrl) => {
          const fileName = imageUrl.split('/').pop();
          const { error: deleteError } = await supabase.storage
            .from('images')
            .remove([`task-images/${fileName}`]);
          
          if (deleteError) {
            console.error('Ошибка удаления файла:', deleteError);
          }
        });
        
        await Promise.all(deletePromises);
        
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ [field]: [] })
          .eq('id', this.task.id);
        
        if (updateError) throw updateError;
        
        this.$emit('task-updated');
        this.closeModal();
        
      } catch (error) {
        console.error('Ошибка удаления изображений:', error);
        alert('Ошибка удаления изображений');
      } finally {
        this.isLoading = false;
      }
    },
    
  async saveTask() {
    if (!this.isFormValid) return;
    
    this.isLoading = true;
    
    try {
      const tableName = this.getTaskTableName();
      const updatedTask = {
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
        table_data: this.editedTask.table_data
      };
      
      const { data, error } = await supabase
        .from(tableName)
        .update(updatedTask)
        .eq('id', this.task.id)
        .select(); // ← ДОБАВИТЬ .select() для получения обновленных данных
      
      if (error) throw error;
      
      // Передаем обновленную задачу с сохраненным ID
      const updatedTaskWithId = {
        ...data[0],
        id: this.task.id // гарантируем, что ID сохранится
      };
      
      this.$emit('task-updated', updatedTaskWithId);
      this.closeModal();
      
    } catch (error) {
      console.error('Ошибка сохранения задания:', error);
      alert('Ошибка сохранения задания');
    } finally {
      this.isLoading = false;
    }
  },
  
  async deleteTask() {
    if (!confirm('Вы уверены, что хотите удалить это задание?')) return;
    
    this.isLoading = true;
    
    try {
      const tableName = this.getTaskTableName();
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', this.task.id);
      
      if (error) throw error;
      
      this.$emit('task-deleted', this.task.id);
      this.closeModal();
      
    } catch (error) {
      console.error('Ошибка удаления задания:', error);
      alert('Ошибка удаления задания');
    } finally {
      this.isLoading = false;
    }
  },
  
  async removeExistingImages(type) {
    if (!this.task.id) return;
    
    this.isLoading = true;
    
    try {
      const tableName = this.getTaskTableName();
      const imageFieldMap = {
        text: 'images',
        answer: 'image_answer',
        explanation: 'image_explanation'
      };
      
      const field = imageFieldMap[type];
      if (!field) return;
      
      const { data: taskData, error: fetchError } = await supabase
        .from(tableName)
        .select(field)
        .eq('id', this.task.id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const imagesToRemove = taskData[field] || [];
      
      const deletePromises = imagesToRemove.map(async (imageUrl) => {
        const fileName = imageUrl.split('/').pop();
        const { error: deleteError } = await supabase.storage
          .from('images')
          .remove([`task-images/${fileName}`]);
        
        if (deleteError) {
          console.error('Ошибка удаления файла:', deleteError);
        }
      });
      
      await Promise.all(deletePromises);
      
      const { data, error: updateError } = await supabase
        .from(tableName)
        .update({ [field]: [] })
        .eq('id', this.task.id)
        .select(); // ← ДОБАВИТЬ .select()
      
      if (updateError) throw updateError;
      
      // Передаем обновленную задачу
      const updatedTask = {
        ...data[0],
        id: this.task.id
      };
      
      this.$emit('task-updated', updatedTask);
      this.closeModal();
      
    } catch (error) {
      console.error('Ошибка удаления изображений:', error);
      alert('Ошибка удаления изображений');
    } finally {
      this.isLoading = false;
    }
  },
    
    closeModal() {
      this.$emit('close');
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
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  color: #333;
  font-size: 1.5rem;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  color: #333;
  background-color: #f0f0f0;
  border-radius: 50%;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-item label {
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
}

.points-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background-color: white;
}

.text-editor {
  margin-bottom: 20px;
}

.text-editor label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.editor-toolbar {
  display: flex;
  gap: 5px;
  margin-bottom: 8px;
  padding: 8px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.toolbar-button {
  padding: 6px 10px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 32px;
}

.toolbar-button:hover {
  background-color: #f0f0f0;
}

.toolbar-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-text {
  position: relative;
  font-size: 14px;
}

.subscript, .superscript {
  font-size: 10px;
  position: absolute;
}

.subscript {
  bottom: -4px;
}

.superscript {
  top: -4px;
}

.task-editor {
  min-height: 100px;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px;
  font-size: 14px;
  line-height: 1.5;
  background-color: white;
  overflow-y: auto;
  max-height: 200px;
}

.task-editor:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.task-editor[contenteditable="true"]:empty:before {
  content: attr(placeholder);
  color: #999;
  font-style: italic;
}

.answer-editor {
  min-height: 60px;
  max-height: 120px;
}

.image-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.preview-item {
  position: relative;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 5px;
  background: white;
}

.preview-image {
  max-width: 100px;
  max-height: 100px;
  display: block;
}

.remove-image-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-image-btn:hover {
  background: #c82333;
}

.remove-image-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.image-uploader {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.image-uploader label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.upload-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.upload-button {
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.upload-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.upload-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.file-info {
  font-size: 14px;
  color: #666;
}

.images-info {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
}

.images-info h4 {
  margin: 0 0 10px 0;
  color: #856404;
}

.images-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.image-group {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: white;
  border-radius: 4px;
  border: 1px solid #ffeaa7;
}

.image-group strong {
  min-width: 100px;
  color: #333;
}

.remove-existing-btn {
  padding: 4px 8px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-left: auto;
}

.remove-existing-btn:hover:not(:disabled) {
  background-color: #c82333;
}

.remove-existing-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

.action-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.delete-button {
  padding: 10px 16px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.delete-button:hover:not(:disabled) {
  background-color: #c82333;
}

.delete-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.right-buttons {
  display: flex;
  gap: 10px;
}

.cancel-button {
  padding: 10px 20px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-button:hover:not(:disabled) {
  background-color: #545b62;
}

.cancel-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-button {
  padding: 10px 20px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.save-button:hover:not(:disabled) {
  background-color: #218838;
}

.save-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

/* Стили для модального окна таблицы */
.table-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.table-modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  padding: 20px;
  overflow-y: auto;
}

.table-modal-content h3 {
  margin: 0 0 20px 0;
  color: #333;
  text-align: center;
}

.table-controls {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.control-row label {
  font-weight: 500;
  color: #333;
  white-space: nowrap;
}

.table-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  text-align: center;
}

.table-preview-section,
.editable-table-section {
  margin-bottom: 20px;
}

.table-preview-section h4,
.editable-table-section h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.preview-table-container,
.editable-table-container {
  overflow-x: auto;
  margin-bottom: 10px;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 10px;
  background-color: white;
}

.preview-table-container table,
.editable-table-container table {
  width: 100%;
  border-collapse: collapse;
}

.preview-table-container table.with-borders td,
.editable-table-container table.with-borders td {
  border: 1px solid #ddd;
}

.preview-table-container table:not(.with-borders) td,
.editable-table-container table:not(.with-borders) td {
  border: none;
}

.table-cell-editor {
  min-height: 40px;
  padding: 8px;
  border: 1px solid #e9ecef;
  border-radius: 2px;
  background-color: white;
  outline: none;
  font-size: 14px;
  line-height: 1.4;
}

.table-cell-editor:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.table-toolbar {
  display: flex;
  gap: 5px;
  padding: 8px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.modal-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.modal-button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  min-width: 100px;
}

.modal-button.primary {
  background-color: #007bff;
  color: white;
}

.modal-button.primary:hover {
  background-color: #0056b3;
}

.modal-button:hover {
  background-color: #f8f9fa;
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
    gap: 10px;
  }
  
  .right-buttons {
    width: 100%;
    justify-content: space-between;
  }
  
  .table-modal-content {
    width: 95%;
    margin: 10px;
  }
  
  .control-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>