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
            <option v-for="n in 4" :value="n" :key="n">{{ n }}</option>
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
          <button @click="insertSubscript('text')" class="toolbar-button" title="Нижний индекс">
  <span class="button-text">x<span class="subscript">2</span></span>
</button>
<button @click="insertSuperscript('text')" class="toolbar-button" title="Верхний индекс">
  <span class="button-text">x<span class="superscript">2</span></span>
</button>
        </div>
        <textarea 
          v-model="newTask.text" 
          placeholder="Введите текст задания..."
          class="task-textarea"
          ref="textTextarea"
        ></textarea>
      </div>

      <!-- Модальное окно для создания/редактирования таблицы -->
      <div v-if="showTableModal" class="modal-overlay">
        <div class="modal-content">
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
            </div>
            <div class="control-row">
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
          
          <!-- Редактируемая таблица -->
          <div class="editable-table-container">
            <table :class="{ 'with-borders': tableBorders }">
              <tr v-for="(row, rowIndex) in tableContent" :key="rowIndex">
                <td v-for="(cell, colIndex) in row" :key="colIndex">
                  <textarea 
                    v-model="tableContent[rowIndex][colIndex]" 
                    class="table-cell-input"
                    @focus="setActiveCell(rowIndex, colIndex)"
                  ></textarea>
                </td>
              </tr>
            </table>
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
        <button @click="insertSubscript('answer')" class="toolbar-button" title="Нижний индекс">
          <span class="button-text">x<span class="subscript">2</span></span>
        </button>
        <button @click="insertSuperscript('answer')" class="toolbar-button" title="Верхний индекс">
          <span class="button-text">x<span class="superscript">2</span></span>
        </button>
      </div>
      <textarea 
        v-model="newTask.answer" 
        placeholder="Введите ответ на задание..."
        class="task-textarea answer-textarea"
        ref="answerTextarea"
      ></textarea>
    </div>

    <!-- Поле для пояснения с инструментами -->
    <div class="text-editor">
      <label>Пояснение к ответу:</label>
      <div class="editor-toolbar">
        <button @click="insertSubscript('explanation')" class="toolbar-button" title="Нижний индекс">
          <span class="button-text">x<span class="subscript">2</span></span>
        </button>
        <button @click="insertSuperscript('explanation')" class="toolbar-button" title="Верхний индекс">
          <span class="button-text">x<span class="superscript">2</span></span>
        </button>
        <button @click="triggerFileInput('explanation')" class="toolbar-button" title="Добавить изображение">
          📷
        </button>
      </div>
      <textarea 
        v-model="newTask.explanation" 
        placeholder="Введите пояснение к ответу (опционально)..."
        class="task-textarea"
        ref="explanationTextarea"
      ></textarea>
      
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

    <!-- Загрузка изображений для основного текста -->
    <div class="image-uploader">
      <label>Изображения для текста задания:</label>
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
      
      <!-- Препросмотр загруженных изображений -->
      <div class="image-preview" v-if="uploadedImages.length > 0">
        <div v-for="(image, index) in uploadedImages" :key="image.id" class="preview-item">
          <img :src="image.preview" class="preview-image">
          <button @click="removeImage(index)" class="remove-image-btn" :disabled="isUploading">
            ×
          </button>
        </div>
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
      subjects: ['Химия ЕГЭ', 'Биология ЕГЭ'],
      selectedSubject: null,
      availableSections: [],
      allTopics: [],
      topicsData: {
        'Химия ЕГЭ': {},
        'Биология ЕГЭ': {}
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
      currentTableHtml: '',
      editingTable: false,
      activeCell: { row: 0, col: 0 },
      tableContent: this.initializeTableContent(2, 2),
      originalTableHtml: '',
      currentTextarea: 'text' // Для отслеживания активного текстового поля
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
      } else {
        if (!this.newTask.part) {
          return Array.from({length: 28}, (_, i) => i + 1);
        }
        return this.newTask.part === 'Первая часть'
          ? Array.from({length: 21}, (_, i) => i + 1)
          : Array.from({length: 7}, (_, i) => i + 22);
      }
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
  methods: {
    initializeTopics() {
      this.topicsData['Химия ЕГЭ'] = processModules(chemTopicsModules);
      this.topicsData['Биология ЕГЭ'] = processModules(bioTopicsModules);
    },
    handleSubjectChange(subject) {
      if (subject === 'Химия ЕГЭ') {
        this.availableSections = chem_ege_sections;
        this.allTopics = Object.values(this.topicsData['Химия ЕГЭ']).flat();
      } else if (subject === 'Биология ЕГЭ') {
        this.availableSections = Object.keys(this.sectionMappings['Биология ЕГЭ']);
        this.allTopics = Object.values(this.topicsData['Биология ЕГЭ']).flat();
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
      this.uploadStatus = 'Файлы не выбраны';
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
    },
    resetTableContent() {
      this.tableContent = this.initializeTableContent(this.tableRows, this.tableCols);
    },
    insertTable(textareaType) {
      this.currentTextarea = textareaType;
      const textarea = this.$refs[`${textareaType}Textarea`];
      if (!textarea) return;
      
      const selectedText = textarea.value.substring(
        textarea.selectionStart,
        textarea.selectionEnd
      );
      
      if (selectedText.trim().startsWith('<table')) {
        this.editingTable = true;
        this.originalTableHtml = selectedText;
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(selectedText, 'text/html');
        const table = doc.querySelector('table');
        
        if (table) {
          this.tableBorders = table.hasAttribute('border');
          this.tableRows = table.rows.length;
          this.tableCols = table.rows[0]?.cells.length || 0;
          
          this.tableContent = [];
          for (let i = 0; i < this.tableRows; i++) {
            const row = [];
            for (let j = 0; j < this.tableCols; j++) {
              const cell = table.rows[i]?.cells[j];
              row.push(cell ? cell.textContent.trim() : '');
            }
            this.tableContent.push(row);
          }
        }
      } else {
        this.editingTable = false;
        this.originalTableHtml = '';
        this.tableRows = 2;
        this.tableCols = 2;
        this.tableBorders = true;
        this.resetTableContent();
      }
      
      this.showTableModal = true;
    },
    insertTableToText() {
      const textarea = this.$refs[`${this.currentTextarea}Textarea`];
      if (!textarea) return;
      
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      
      let html = '<table';
      html += this.tableBorders ? ' border="1" cellpadding="5" cellspacing="0"' : ' style="border-collapse: collapse"';
      html += '>';
      
      for (let i = 0; i < this.tableRows; i++) {
        html += '<tr>';
        for (let j = 0; j < this.tableCols; j++) {
          const content = this.tableContent[i][j] || '&nbsp;';
          html += `<td style="padding: 5px;">${content}</td>`;
        }
        html += '</tr>';
      }
      
      html += '</table>';
      
      const currentValue = this.newTask[this.currentTextarea] || '';
      
      if (this.editingTable) {
        this.newTask[this.currentTextarea] = 
          currentValue.substring(0, startPos) + 
          html + 
          currentValue.substring(endPos);
      } else {
        this.newTask[this.currentTextarea] = 
          currentValue.substring(0, startPos) + 
          html + 
          currentValue.substring(startPos);
      }
      
      // Устанавливаем флаг таблицы только для основного текста задания
      if (this.currentTextarea === 'text') {
        this.newTask.has_table = true;
        this.newTask.table_data = {
          rows: this.tableRows,
          cols: this.tableCols,
          borders: this.tableBorders,
          content: this.tableContent
        };
      }
      
      this.showTableModal = false;
      
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = startPos + html.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    setActiveCell(row, col) {
      this.activeCell = { row, col };
    },
    insertSubscript(textareaType) {
      this.currentTextarea = textareaType;
      const textarea = this.$refs[`${textareaType}Textarea`];
      if (!textarea) return;
      
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      const selectedText = textarea.value.substring(startPos, endPos);
      
      const textToInsert = selectedText 
        ? `<sub>${selectedText}</sub>`
        : '<sub>индекс</sub>';
      
      this.insertFormattedText(textToInsert, startPos, endPos, textarea);
    },
    insertSuperscript(textareaType) {
      this.currentTextarea = textareaType;
      const textarea = this.$refs[`${textareaType}Textarea`];
      if (!textarea) return;
      
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      const selectedText = textarea.value.substring(startPos, endPos);
      
      const textToInsert = selectedText 
        ? `<sup>${selectedText}</sup>`
        : '<sup>степень</sup>';
      
      this.insertFormattedText(textToInsert, startPos, endPos, textarea);
    },
    insertFormattedText(textToInsert, startPos, endPos, textarea) {
      const currentValue = this.newTask[this.currentTextarea] || '';
      
      this.newTask[this.currentTextarea] = 
        currentValue.substring(0, startPos) + 
        textToInsert + 
        currentValue.substring(endPos);
      
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = startPos + textToInsert.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
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
          
          // Добавляем изображение в соответствующий массив
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
        
        for (const img of images) {
          const fileExt = img.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExt}`;
          const subjectFolder = this.selectedSubject === 'Химия ЕГЭ' ? 'chemistry' : 'biology';
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

    async saveTask() {
      try {
        this.isUploading = true;
        
        // Загружаем изображения для каждого типа
        const [textImageUrls, explanationImageUrls] = await Promise.all([
          this.uploadImagesToStorage(this.uploadedImages, 'text'),
          this.uploadImagesToStorage(this.explanationImages, 'explanation')
        ]);
        
        const tableName = this.selectedSubject === 'Химия ЕГЭ' 
          ? 'chemistry_ege_task_bank' 
          : 'biology_ege_task_bank';
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        
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
    }

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
  }
};
</script>



<style scoped>
/* Все стили остаются без изменений */
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
}

.toolbar-button:hover {
  background-color: #e0e0e0;
}

.task-textarea {
  width: 100%;
  min-height: 150px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
  resize: vertical;
  box-sizing: border-box;
}
.answer-textarea {
  min-height: 80px !important;
  height: 80px !important;
  resize: vertical;
}
.task-textarea:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.2);
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

.modal-overlay {
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

.modal-content {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h3 {
  margin-top: 0;
  color: #333;
}

.table-controls {
  margin: 20px 0;
}

.control-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.control-row label {
  margin-right: 10px;
  min-width: 80px;
}

.table-input {
  width: 60px;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.editable-table-container {
  margin: 20px 0;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}

.editable-table-container table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
}

.editable-table-container table.with-borders {
  border: 1px solid #ddd;
}

.editable-table-container table.with-borders td {
  border: 1px solid #ddd;
}

.editable-table-container td {
  padding: 5px;
  vertical-align: top;
  min-width: 100px;
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
.table-cell-input {
  width: 100%;
  height: 60px;
  padding: 5px;
  border: 1px solid #eee;
  resize: none;
  font-family: inherit;
  font-size: 14px;
}

.table-cell-input:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.2);
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.modal-button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f0f0f0;
  cursor: pointer;
}

.modal-button.primary {
  background-color: #b241d1;
  color: white;
  border-color: #9a36b8;
}

.modal-button.primary:hover {
  background-color: #9a36b8;
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

.toolbar-button i sub,
.toolbar-button i sup {
  font-size: 0.7em;
  vertical-align: sub;
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
  
  .task-textarea {
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
  
  .modal-content {
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
  
  .table-cell-input {
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