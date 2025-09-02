<template>
  <div class="editor-container">
    <button @click="GoBackToEditPage" class="back-button">Вернуться к выбору</button>
    <div class="container">
      <h1>Редактирование таблицы {{ tableTitle }}</h1>
      
      <div class="tabs">
        <button 
          @click="activeTab = 'add'" 
          :class="{ 'active': activeTab === 'add' }"
          class="tab-button"
        >
          Добавить запись
        </button>
        <button 
          @click="activeTab = 'table'" 
          :class="{ 'active': activeTab === 'table' }"
          class="tab-button"
        >
          Просмотр записей
        </button>
      </div>

      <div v-if="activeTab === 'add'" class="add-form">
        <h2>Добавить новую запись</h2>
        
        <!-- Отладочная информация -->
        <div class="debug-info" v-if="debugMode">
          <h4>Отладка:</h4>
          <p>Текущее видео: {{ newRow.video || 'не установлено' }}</p>
          <p>Рабочая тетрадь: {{ newRow.workbook || 'не установлено' }}</p>
          <p>Практика: {{ newRow.practice || 'не установлено' }}</p>
          <p>Следующий ID: {{ nextId }}</p>
        </div>
        
        <form @submit.prevent="addNewRow">
          <div v-for="field in fields" :key="field.name" class="form-group">
            <label>{{ field.label }}:</label>
            <input 
              v-if="field.type !== 'textarea'" 
              :type="field.type" 
              v-model="newRow[field.name]"
              :disabled="field.disabled"
              class="form-input"
            >
            <textarea 
              v-else 
              v-model="newRow[field.name]"
              class="form-textarea"
            ></textarea>
          </div>
          
          <!-- Компонент загрузки видео -->
          <div class="form-group">
            <label>Видео:</label>
            <VideoUploader 
              @video-uploaded="handleVideoUpload"
              :current-video="newRow.video"
            />
            <div v-if="newRow.video" class="file-preview">
              <strong>Текущая ссылка:</strong>
              <a :href="newRow.video" target="_blank" class="file-link">{{ newRow.video }}</a>
            </div>
          </div>

          <!-- Загрузка рабочей тетради -->
          <div class="form-group">
            <label>Рабочая тетрадь:</label>
            <FileUploader 
              @file-uploaded="(url) => handleFileUpload('workbook', url)"
              :current-file="newRow.workbook"
              file-type="workbook"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
            />
            <div v-if="newRow.workbook" class="file-preview">
              <strong>Текущий файл:</strong>
              <a :href="newRow.workbook" target="_blank" class="file-link">{{ getFileName(newRow.workbook) }}</a>
            </div>
          </div>

          <!-- Загрузка практики -->
          <div class="form-group">
            <label>Практика на занятие:</label>
            <FileUploader 
              @file-uploaded="(url) => handleFileUpload('practice', url)"
              :current-file="newRow.practice"
              file-type="practice"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
            />
            <div v-if="newRow.practice" class="file-preview">
              <strong>Текущий файл:</strong>
              <a :href="newRow.practice" target="_blank" class="file-link">{{ getFileName(newRow.practice) }}</a>
            </div>
          </div>
          
          <button type="submit" class="btn-add">Добавить запись</button>
        </form>
      </div>

      <div v-if="activeTab === 'table'" class="table-container">
        <h2>Существующие записи</h2>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th v-for="field in fields" :key="field.name" class="table-header">
                  {{ field.label }}
                </th>
                <th class="table-header">Видео</th>
                <th class="table-header">Рабочая тетрадь</th>
                <th class="table-header">Практика</th>
                <th class="table-header">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row[primaryKey]" class="table-row">
                <td v-for="field in fields" :key="field.name" class="table-cell">
                  <input 
                    v-if="field.type !== 'textarea'" 
                    :type="field.type" 
                    v-model="row[field.name]"
                    @change="updateRow(row)"
                    :disabled="field.disabled"
                    class="table-input"
                  >
                  <textarea 
                    v-else 
                    v-model="row[field.name]"
                    @change="updateRow(row)"
                    class="table-textarea"
                  ></textarea>
                </td>
                <td class="table-cell">
                  <VideoUploader 
                    @video-uploaded="(url) => handleRowVideoUpload(row, url)"
                    :current-video="row.video"
                    compact
                  />
                  <div v-if="row.video" class="file-preview-small">
                    <a :href="row.video" target="_blank" class="file-link-small">↗</a>
                  </div>
                </td>
                <td class="table-cell">
                  <FileUploader 
                    @file-uploaded="(url) => handleRowFileUpload(row, 'workbook', url)"
                    :current-file="row.workbook"
                    file-type="workbook"
                    compact
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                  />
                  <div v-if="row.workbook" class="file-preview-small">
                    <a :href="row.workbook" target="_blank" class="file-link-small">📄</a>
                  </div>
                </td>
                <td class="table-cell">
                  <FileUploader 
                    @file-uploaded="(url) => handleRowFileUpload(row, 'practice', url)"
                    :current-file="row.practice"
                    file-type="practice"
                    compact
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                  />
                  <div v-if="row.practice" class="file-preview-small">
                    <a :href="row.practice" target="_blank" class="file-link-small">📄</a>
                  </div>
                </td>
                <td class="table-cell actions-cell">
                  <button @click="deleteRow(row[primaryKey])" class="btn-delete">Удалить</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div v-if="rows.length === 0" class="empty-state">
          <p>Записей пока нет</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase } from '../supabase.js'
import VideoUploader from './VideoUploader.vue'
import FileUploader from './FileUploader.vue' // Новый компонент для загрузки файлов

const props = defineProps({
  tableTitle: {
    type: String,
    required: true
  },
  tableName: {
    type: String,
    required: true
  },
  primaryKey: {
    type: String,
    default: 'number'
  },
  fields: {
    type: Array,
    required: true,
    validator: (fields) => fields.every(f => f.name && f.label && f.type)
  }
})

const emit = defineEmits(['back-to-edit'])
const activeTab = ref('add')
const rows = ref([])
const newRow = ref({})
const nextId = ref(1)
const debugMode = ref(true)

// Следим за изменениями newRow для отладки
watch(newRow, (value) => {
  console.log('newRow изменён:', JSON.parse(JSON.stringify(value)))
}, { deep: true })

// Получение имени файла из URL
const getFileName = (url) => {
  if (!url) return ''
  const parts = url.split('/')
  return parts[parts.length - 1]
}

// Инициализация новой строки
const initNewRow = () => {
  const initialData = props.fields.reduce((obj, field) => {
    obj[field.name] = field.type === 'number' ? 0 : ''
    return obj
  }, {})
  
  // Добавляем поля для файлов
  initialData.video = ''
  initialData.workbook = ''
  initialData.practice = ''
  
  newRow.value = { ...initialData }
  console.log('Инициализирован newRow:', newRow.value)
}

// Обработчик загрузки видео
const handleVideoUpload = (videoUrl) => {
  console.log('Получена ссылка на видео:', videoUrl)
  newRow.value = {
    ...newRow.value,
    video: videoUrl
  }
}

// Обработчик загрузки файлов
const handleFileUpload = (fieldName, fileUrl) => {
  console.log(`Получена ссылка на файл ${fieldName}:`, fileUrl)
  newRow.value = {
    ...newRow.value,
    [fieldName]: fileUrl
  }
}

// Обработчик для существующих записей (видео)
const handleRowVideoUpload = async (row, videoUrl) => {
  console.log('Обновление видео для строки:', row[props.primaryKey], videoUrl)
  
  const updatedRow = {
    ...row,
    video: videoUrl
  }
  
  const index = rows.value.findIndex(r => r[props.primaryKey] === row[props.primaryKey])
  if (index !== -1) {
    rows.value[index] = updatedRow
    await updateRow(updatedRow)
  }
}

// Обработчик для существующих записей (файлы)
const handleRowFileUpload = async (row, fieldName, fileUrl) => {
  console.log(`Обновление ${fieldName} для строки:`, row[props.primaryKey], fileUrl)
  
  const updatedRow = {
    ...row,
    [fieldName]: fileUrl
  }
  
  const index = rows.value.findIndex(r => r[props.primaryKey] === row[props.primaryKey])
  if (index !== -1) {
    rows.value[index] = updatedRow
    await updateRow(updatedRow)
  }
}

// Вычисление следующего ID
const calculateNextId = async () => {
  try {
    const { data, error } = await supabase
      .from(props.tableName)
      .select(props.primaryKey)
      .order(props.primaryKey, { ascending: false })
      .limit(1)
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      nextId.value = 1
      return
    }
    
    const maxId = data[0][props.primaryKey]
    nextId.value = maxId + 1
    
    if (newRow.value[props.primaryKey] !== undefined) {
      newRow.value[props.primaryKey] = nextId.value
    }
    
    console.log('Следующий ID:', nextId.value)
  } catch (error) {
    console.error('Ошибка при вычислении ID:', error)
    nextId.value = Date.now()
  }
}

// Загрузка данных
const fetchRows = async () => {
  try {
    console.log('Загрузка данных из таблицы:', props.tableName)
    
    const { data, error } = await supabase
      .from(props.tableName)
      .select('*')
      .order(props.primaryKey, { ascending: true })
    
    if (error) throw error
    
    rows.value = data || []
    console.log('Загружены строки:', rows.value.length)
    
  } catch (error) {
    console.error('Ошибка при загрузке данных:', error)
    alert('Ошибка загрузки данных: ' + error.message)
  }
}

// Добавление новой строки
const addNewRow = async () => {
  try {
    console.log('Попытка добавления записи:', newRow.value)
    
    const rowToInsert = {
      ...newRow.value,
      [props.primaryKey]: nextId.value
    }
    
    console.log('Данные для вставки в БД:', rowToInsert)
    
    const { error } = await supabase
      .from(props.tableName)
      .insert([rowToInsert])
    
    if (error) {
      console.error('Ошибка Supabase:', error)
      throw error
    }
    
    console.log('Запись успешно добавлена в БД')
    await fetchRows()
    await calculateNextId()
    initNewRow()
    
    alert('Запись успешно добавлена!')
    activeTab.value = 'table'
    
  } catch (error) {
    console.error('Ошибка при добавлении записи:', error)
    alert('Произошла ошибка при добавлении записи: ' + error.message)
  }
}

// Обновление строки
const updateRow = async (row) => {
  try {
    console.log('Обновление строки:', row)
    
    const { error } = await supabase
      .from(props.tableName)
      .update(row)
      .eq(props.primaryKey, row[props.primaryKey])
    
    if (error) throw error
    
    console.log('Запись успешно обновлена в БД')
    
  } catch (error) {
    console.error('Ошибка при обновлении записи:', error)
    alert('Ошибка обновления: ' + error.message)
  }
}

// Удаление строки
const deleteRow = async (id) => {
  if (!confirm('Вы уверены, что хотите удалить эту запись?')) return
  
  try {
    console.log('Удаление записи с ID:', id)
    
    const { error } = await supabase
      .from(props.tableName)
      .delete()
      .eq(props.primaryKey, id)
    
    if (error) throw error
    
    await fetchRows()
    await calculateNextId()
    
    alert('Запись успешно удалена!')
    
  } catch (error) {
    console.error('Ошибка при удалении записи:', error)
    alert('Произошла ошибка при удалении записи: ' + error.message)
  }
}

// Инициализация компонента
onMounted(async () => {
  console.log('Инициализация TableEditor для таблицы:', props.tableName)
  initNewRow()
  await fetchRows()
  await calculateNextId()
})

const GoBackToEditPage = () => {
  emit('back-to-edit')
}
</script>

<style scoped>
/* Обновленные стили для файлов */
.file-preview {
  margin-top: 10px;
  padding: 10px;
  background: #e8f5e8;
  border-radius: 4px;
  border: 1px solid #c8e6c9;
}

.file-link {
  display: block;
  margin-top: 5px;
  color: #2e7d32;
  text-decoration: none;
  word-break: break-all;
}

.file-link:hover {
  text-decoration: underline;
}

.file-preview-small {
  margin-top: 5px;
  text-align: center;
}

.file-link-small {
  color: #2e7d32;
  text-decoration: none;
  font-weight: bold;
  font-size: 16px;
}

/* Остальные стили остаются без изменений */
.editor-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
  background: white;
  z-index: 100;
  padding: 20px;
}

.back-button {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 10px 20px;
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  z-index: 101;
}

.back-button:hover {
  background-color: #1976D2;
}

.container {
  position: absolute;
  top: 60px;
  left: 20px;
  right: 20px;
  bottom: 20px;
  overflow-y: auto;
}

.tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
  padding-top: 10px;
}

.tab-button {
  padding: 12px 24px;
  background: #f1f1f1;
  border: none;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s;
  margin-right: 5px;
  border-radius: 4px 4px 0 0;
}

.tab-button:hover {
  background: #ddd;
}

.tab-button.active {
  background: #4CAF50;
  color: white;
}

.add-form, .table-container {
  background: #f9f9f9;
  padding: 24px;
  border-radius: 8px;
  margin-bottom: 30px;
  border: 1px solid #e0e0e0;
}

h1 {
  color: #333;
  margin-bottom: 24px;
  font-size: 28px;
}

h2 {
  color: #444;
  margin-bottom: 20px;
  font-size: 22px;
}

.debug-info {
  background: #fff3cd;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  border: 1px solid #ffeaa7;
}

.debug-info h4 {
  margin: 0 0 8px 0;
  color: #856404;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-weight: bold;
  color: #555;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 14px;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #4CAF50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

.form-textarea {
  min-height: 100px;
  resize: vertical;
}

.btn-add, .btn-delete {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  font-size: 14px;
  transition: background-color 0.3s;
}

.btn-add {
  background-color: #4CAF50;
  color: white;
}

.btn-add:hover {
  background-color: #45a049;
}

.btn-add:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.btn-delete {
  background-color: #f44336;
  color: white;
  padding: 8px 16px;
  font-size: 12px;
}

.btn-delete:hover {
  background-color: #da190b;
}

.table-wrapper {
  overflow-x: auto;
  margin-bottom: 20px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  background: white;
}

.table-header {
  background-color: #f5f5f5;
  padding: 12px;
  text-align: left;
  font-weight: bold;
  border: 1px solid #ddd;
  color: #333;
}

.table-row:hover {
  background-color: #f9f9f9;
}

.table-cell {
  border: 1px solid #ddd;
  padding: 12px;
  vertical-align: top;
}

.table-input, .table-textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #eee;
  border-radius: 3px;
  font-size: 13px;
}

.table-input:focus, .table-textarea:focus {
  outline: none;
  border-color: #4CAF50;
}

.table-textarea {
  min-height: 60px;
  resize: vertical;
}

.actions-cell {
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
  font-style: italic;
}

@media (max-width: 768px) {
  .container {
    left: 10px;
    right: 10px;
  }
  
  .tabs {
    flex-direction: column;
  }
  
  .tab-button {
    margin-bottom: 5px;
    border-radius: 4px;
  }
  
  .table-wrapper {
    font-size: 14px;
  }
  
  .table-cell {
    padding: 8px;
  }
}
</style>