<template>
  <div class="editor-container">
    <!-- Выбор предмета -->
    <div class="subject-selector">
      <h2>Редактор заданий</h2>
      <CustomDropdown
        :options="subjects"
        placeholder="Выберите предмет"
        v-model="selectedSubject"
        @change="handleSubjectChange"
      />
    </div>

    <!-- Форма редактора -->
    <div class="editor-form" v-if="selectedSubject">
      <div class="form-grid">
        <!-- Выбор раздела -->
        <div class="form-item">
          <label>Раздел:</label>
          <CustomDropdown
            :options="availableSections"
            placeholder="Выберите раздел"
            v-model="newTask.section"
            :searchable="true"
          />
        </div>

        <!-- Выбор темы -->
        <div class="form-item">
          <label>Тема:</label>
          <CustomDropdown
            :options="filteredTopics"
            placeholder="Выберите тему"
            v-model="newTask.topic"
            :searchable="true"
          />
        </div>

        <!-- Выбор части -->
        <div class="form-item">
          <label>Часть:</label>
          <CustomDropdown
            :options="parts"
            placeholder="Выберите часть"
            v-model="newTask.part"
          />
        </div>

        <!-- Выбор номера -->
        <div class="form-item">
          <label>Номер задания:</label>
          <CustomDropdown
            :options="filteredTaskNumbers"
            placeholder="Выберите номер"
            v-model="newTask.number"
          />
        </div>
        <div class="form-item">
          <label>Баллы за задание:</label>
          <select v-model="newTask.points" class="points-select">
            <option v-for="n in 5" :value="n" :key="n">{{ n }}</option>
          </select>
        </div>

        <div class="form-item">
          <label>Сложность:</label>
          <select v-model="newTask.difficulty" class="points-select">
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
          @input="updateNewTask('text', $event)"
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
          @input="updateNewTask('answer', $event)"
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
          @input="updateNewTask('explanation', $event)"
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

      <!-- Загрузка изображений -->
      <div class="image-uploader">
        <label>Загрузить изображения:</label>
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

      <!-- Уведомление о сохранении -->
      <div v-if="showSuccess" class="success-notification">
        <div class="success-icon">✓</div>
        <div class="success-text">Задание успешно сохранено</div>
      </div>

      <!-- Кнопка сохранения -->
      <div class="action-buttons">
        <button 
          @click="saveTask"
          :disabled="!isFormValid || isUploading"
          class="save-button"
        >
          {{ isUploading ? 'Сохранение...' : 'Сохранить задание' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { v4 as uuidv4 } from 'uuid';
import { markRaw } from 'vue';
import CustomDropdown from './CustomDropdown.vue';
import { chem_ege_sections } from '../assets/arrays/list_of_sections.js';
import { supabase } from '../supabase';

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
  name: 'TaskEditor',
  components: {
    CustomDropdown: markRaw(CustomDropdown)
  },
  data() {
    return {
      subjects: ['Химия ЕГЭ', 'Биология ЕГЭ', 'Химия ОГЭ', 'Биология ОГЭ'],
      selectedSubject: null,
      availableSections: [],
      allTopics: [],
      topicsData: {
        'Химия ЕГЭ': {},
        'Биология ЕГЭ': {},
        'Химия ОГЭ': {},
        'Биология ОГЭ': {}
      },
      parts: ['Первая часть', 'Вторая часть'],
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
      newTask: {
        text: '',
        answer: '',
        explanation: '',
        section: null,
        topic: null,
        part: null,
        number: null,
        points: 1,
        has_table: false,
        table_data: null,
        difficulty: '1',
      },
      uploadedImages: [],
      explanationImages: [],
      uploadStatus: 'Файлы не выбраны',
      currentUploadType: 'text',
      isUploading: false,
      showSuccess: false,
      showTableModal: false,
      tableRows: 2,
      tableCols: 2,
      tableBorders: true,
      editingTable: false,
      tableContent: this.initializeTableContent(2, 2),
      originalTableHtml: '',
      currentTextarea: 'text',
      activeTableCell: null
    };
  },
  computed: {
    filteredTopics() {
      if (!this.newTask.section || !this.selectedSubject) return this.allTopics;
      
      const sectionKey = this.sectionMappings[this.selectedSubject]?.[this.newTask.section];
      return sectionKey ? this.topicsData[this.selectedSubject][sectionKey] || this.allTopics : this.allTopics;
    },
    filteredTaskNumbers() {
      if (!this.selectedSubject) return [];
      
      if (this.selectedSubject === 'Химия ЕГЭ') {
        if (!this.newTask.part) {
          return Array.from({length: 34}, (_, i) => i + 1);
        }
        return this.newTask.part === 'Первая часть'
          ? Array.from({length: 28}, (_, i) => i + 1)
          : Array.from({length: 6}, (_, i) => i + 29);
      } else if (this.selectedSubject === 'Биология ЕГЭ') {
        if (!this.newTask.part) {
          return Array.from({length: 28}, (_, i) => i + 1);
        }
        return this.newTask.part === 'Первая часть'
          ? Array.from({length: 21}, (_, i) => i + 1)
          : Array.from({length: 7}, (_, i) => i + 22);
      } else if (this.selectedSubject === 'Химия ОГЭ') {
        if (!this.newTask.part) {
          return Array.from({length: 23}, (_, i) => i + 1);
        }
        return this.newTask.part === 'Первая часть'
          ? Array.from({length: 19}, (_, i) => i + 1)
          : Array.from({length: 4}, (_, i) => i + 20);
      } else if (this.selectedSubject === 'Биология ОГЭ') {
        if (!this.newTask.part) {
          return Array.from({length: 26}, (_, i) => i + 1);
        }
        return this.newTask.part === 'Первая часть'
          ? Array.from({length: 21}, (_, i) => i + 1)
          : Array.from({length: 5}, (_, i) => i + 22);
      }
      
      return [];
    },
    isFormValid() {
      return (
        this.newTask.text &&
        this.newTask.answer &&
        this.newTask.section &&
        this.newTask.topic &&
        this.newTask.part &&
        this.newTask.number &&
        this.newTask.points &&
        this.newTask.difficulty
      );
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
  watch: {
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
  methods: {
    initializeTopics() {
      this.topicsData['Химия ЕГЭ'] = processModules(chemTopicsModules);
      this.topicsData['Биология ЕГЭ'] = processModules(bioTopicsModules);
      this.topicsData['Химия ОГЭ'] = processModules(chemOgeTopicsModules);
      this.topicsData['Биология ОГЭ'] = processModules(bioOgeTopicsModules);
    },
    handleSubjectChange(subject) {
      if (subject === 'Химия ЕГЭ') {
        this.availableSections = chem_ege_sections;
        this.allTopics = Object.values(this.topicsData['Химия ЕГЭ']).flat();
      } else if (subject === 'Биология ЕГЭ') {
        this.availableSections = Object.keys(this.sectionMappings['Биология ЕГЭ']);
        this.allTopics = Object.values(this.topicsData['Биология ЕГЭ']).flat();
      } else if (subject === 'Химия ОГЭ') {
        this.availableSections = Object.keys(this.sectionMappings['Химия ОГЭ']);
        this.allTopics = Object.values(this.topicsData['Химия ОГЭ']).flat();
      } else if (subject === 'Биология ОГЭ') {
        this.availableSections = Object.keys(this.sectionMappings['Биология ОГЭ']);
        this.allTopics = Object.values(this.topicsData['Биология ОГЭ']).flat();
      } else {
        this.availableSections = [];
        this.allTopics = [];
      }
      this.resetForm();
    },
    resetForm() {
      this.newTask = {
        text: '',
        answer: '',
        explanation: '',
        section: null,
        topic: null,
        part: null,
        number: null,
        points: 1,
        has_table: false,
        table_data: null,
        difficulty: '1'
      };
      this.uploadedImages = [];
      this.explanationImages = [];
      this.uploadStatus = 'Файлы не выбраны';
      
      this.$nextTick(() => {
        if (this.$refs.textEditor) this.$refs.textEditor.innerHTML = '';
        if (this.$refs.answerEditor) this.$refs.answerEditor.innerHTML = '';
        if (this.$refs.explanationEditor) this.$refs.explanationEditor.innerHTML = '';
      });
    },
    
    // Методы для работы с таблицей
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
    },
    
    setupNewTable() {
      this.editingTable = false;
      this.originalTableHtml = '';
      this.tableRows = 2;
      this.tableCols = 2;
      this.tableBorders = true;
      this.resetTableContent();
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
      
      this.updateNewTask(this.currentTextarea, { target: editor });
      
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
      this.newTask.has_table = true;
      this.newTask.table_data = {
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
      
      this.updateNewTask(editorType, { target: editor });
    },
    
    clearFormatting(editorType) {
      const editor = this.$refs[`${editorType}Editor`];
      if (!editor) return;
      
      editor.focus();
      document.execCommand('removeFormat');
      document.execCommand('unlink');
      this.updateNewTask(editorType, { target: editor });
    },
    
    updateNewTask(field, event) {
      this.newTask[field] = event.target.innerHTML;
    },
    
    handlePaste(event, field) {
      event.preventDefault();
      const text = (event.clipboardData || window.clipboardData).getData('text/html') || 
                   (event.clipboardData || window.clipboardData).getData('text/plain');
      
      document.execCommand('insertHTML', false, text);
      this.updateNewTask(field, { target: this.$refs[`${field}Editor`] });
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
    
    async uploadImagesToStorage(images, folder) {
      if (!images.length) return [];
      
      const uploadedUrls = [];
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) throw new Error('Not authenticated');
        
        // Определяем папку предмета
        let subjectFolder;
        if (this.selectedSubject === 'Химия ЕГЭ' || this.selectedSubject === 'Химия ОГЭ') {
          subjectFolder = 'chemistry';
        } else if (this.selectedSubject === 'Биология ЕГЭ' || this.selectedSubject === 'Биология ОГЭ') {
          subjectFolder = 'biology';
        } else {
          subjectFolder = 'other';
        }
        
        // Определяем тип экзамена
        const examType = this.selectedSubject.includes('ЕГЭ') ? 'ege' : 'oge';
        
        for (const img of images) {
          const fileExt = img.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExt}`;
          const filePath = `tasks/${subjectFolder}/${examType}/${folder}/${fileName}`;
          
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

    async saveTask() {
      try {
        this.isUploading = true;
        
        // Загрузка изображений
        const [textImageUrls, explanationImageUrls] = await Promise.all([
          this.uploadImagesToStorage(this.uploadedImages, 'text'),
          this.uploadImagesToStorage(this.explanationImages, 'explanation')
        ]);
        
        // Определяем таблицу в зависимости от предмета
        let tableName;
        if (this.selectedSubject === 'Химия ЕГЭ') {
          tableName = 'chemistry_ege_task_bank';
        } else if (this.selectedSubject === 'Биология ЕГЭ') {
          tableName = 'biology_ege_task_bank';
        } else if (this.selectedSubject === 'Химия ОГЭ') {
          tableName = 'chemistry_oge_task_bank';
        } else if (this.selectedSubject === 'Биология ОГЭ') {
          tableName = 'biology_oge_task_bank';
        } else {
          throw new Error('Неизвестный предмет');
        }
        
        // Получаем информацию о пользователе
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        
        // Сохраняем задание в соответствующую таблицу
        const { data, error } = await supabase
          .from(tableName)
          .insert([{
            text: this.newTask.text,
            answer: this.newTask.answer,
            explanation: this.newTask.explanation || null,
            section: this.newTask.section,
            topic: this.newTask.topic,
            part: this.newTask.part,
            number: this.newTask.number,
            points: this.newTask.points,
            difficulty: parseInt(this.newTask.difficulty),
            images: textImageUrls.length ? textImageUrls : null,
            image_explanation: explanationImageUrls.length ? explanationImageUrls : null,
            has_table: this.newTask.has_table,
            table_data: this.newTask.table_data,
          }])
          .select();

        if (error) throw error;

        this.showSuccess = true;
        this.uploadedImages = [];
        this.explanationImages = [];
        this.uploadStatus = 'Файлы не выбраны';
        
        setTimeout(() => {
          this.showSuccess = false;
          this.resetForm();
        }, 3000);

      } catch (error) {
        console.error('Ошибка при сохранении:', error);
        alert(`Не удалось сохранить задание: ${error.message}`);
      } finally {
        this.isUploading = false;
      }
    }
  }
};
</script>

<style scoped>
.editor-container {
  width: 100%;
  min-height: 100%;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background-color: #f8f9fa;
}

.subject-selector {
  width: 100%;
  margin-bottom: 20px;
}

.subject-selector h2 {
  margin: 0 0 15px 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.editor-form {
  width: 100%;
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(4, minmax(110px, 1fr));
  gap: 15px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: Evolventa;
}

.form-item label {
  font-size: 14px;
  font-weight: 500;
  color: #555;
}

.text-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editor-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.toolbar-button {
  padding: 6px 10px;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.toolbar-button:hover {
  background-color: #e0e0e0;
}

.task-editor {
  width: 100%;
  min-height: 150px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
  resize: vertical;
  font-family: inherit;
  overflow-y: auto;
  background: white;
}

.task-editor:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.2);
}

.task-editor[placeholder]:empty:before {
  content: attr(placeholder);
  color: #6c757d;
  font-style: italic;
}

.answer-editor {
  min-height: 80px;
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

.points-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
}

.points-select:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.2);
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
  z-index: 1000;
}

.table-modal-content {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
}

.table-modal-content h3 {
  margin-top: 0;
  color: #333;
}

.table-controls {
  margin: 20px 0;
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
  width: 60px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
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

.image-uploader {
  margin-bottom: 20px;
}

.image-uploader label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #555;
}

.upload-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.upload-button {
  padding: 8px 16px;
  background-color: #e9ecef;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-button:hover:not(:disabled) {
  background-color: #dee2e6;
}

.upload-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.file-info {
  font-size: 14px;
  color: #666;
}

.image-preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
}

.preview-item {
  position: relative;
  border: 1px solid #eee;
  border-radius: 6px;
  overflow: hidden;
  height: 120px;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.remove-image-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 25px;
  height: 25px;
  background-color: #ff6b6b;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-image-btn:hover:not(:disabled) {
  background-color: #ff5252;
}

.remove-image-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.success-notification {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: #f0faf0;
  border: 1px solid #4caf50;
  border-radius: 6px;
  color: #2e7d32;
  margin-bottom: 20px;
  animation: fadeIn 0.3s ease-out;
}

.success-icon {
  font-size: 24px;
  font-weight: bold;
}

.success-text {
  font-size: 16px;
  font-weight: 500;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
}

.save-button {
  padding: 10px 20px;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.save-button:hover:not(:disabled) {
  background-color: #9a36b8;
}

.save-button:disabled {
  background-color: #ddd;
  cursor: not-allowed;
}

.button-text {
  font-style: italic;
}

.subscript {
  vertical-align: sub;
  font-size: 0.7em;
}

.superscript {
  vertical-align: super;
  font-size: 0.7em;
}

@media (max-width: 768px) {
  .editor-container {
    padding: 15px;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .subject-selector h2 {
    font-size: 20px;
  }
  
  .task-editor {
    min-height: 120px;
  }
  
  .save-button {
    width: 100%;
    padding: 12px;
  }

  .success-notification {
    flex-direction: column;
    text-align: center;
    padding: 12px;
  }
  
  .upload-controls {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .table-modal-content {
    width: 95%;
    padding: 15px;
  }
  
  .control-row {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .modal-buttons {
    justify-content: center;
  }
  
  .editable-table-container {
    max-height: 200px;
  }
  
  .table-cell-editor {
    height: 40px;
    font-size: 12px;
  }
}

:deep(.dropdown-header) {
  padding: 10px 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

:deep(.selected-value) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  max-width: 100%;
}

:deep(.dropdown-options) {
  max-width: 100%;
}

:deep(.dropdown-option) {
  white-space: normal;
  word-break: break-word;
  padding: 10px 15px;
  min-height: 40px;
  display: flex;
  align-items: center;
}

:deep(.dropdown-option:hover) {
  background-color: #f5f5f5;
}

:deep(.dropdown-option.is-selected) {
  background-color: #f0e6ff;
}
</style>