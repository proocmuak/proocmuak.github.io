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
        
        <form @submit.prevent="addNewRow">
          <div v-for="field in fields" :key="field.name" class="form-group">
            <label>{{ field.label }}:</label>
            
            <input 
              v-if="field.type === 'date'" 
              type="date" 
              v-model="newRow[field.name]"
              class="form-input"
            >
            
            <input 
              v-else-if="field.type !== 'textarea'" 
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
          
          <!-- Видео (массив iframe) -->
          <div class="form-group">
            <label>Видео iframe (можно несколько, разделяйте пустой строкой):</label>
            <textarea 
              v-model="videoTextInput"
              @input="processVideoTextInput"
              placeholder="Вставьте iframe коды здесь, разделяя их пустой строкой"
              class="form-textarea"
              rows="6"
            ></textarea>
            
            <div v-if="newRow.video && newRow.video.length > 0" class="files-preview">
              <h4>Добавленные видео ({{ newRow.video.length }}):</h4>
              <div class="iframe-previews">
                <div v-for="(iframeHtml, index) in newRow.video" :key="index" class="iframe-preview-item">
                  <div class="iframe-preview-header">
                    <span>Видео {{ index + 1 }}</span>
                    <button @click="removeVideo(index)" class="btn-remove-small">×</button>
                  </div>
                  <div class="iframe-preview-content" v-html="iframeHtml"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Рабочие тетради (массив ссылок) -->
          <div class="form-group">
            <label>Рабочие тетради (можно несколько):</label>
            <FileUploader 
              @files-uploaded="handleWorkbooksUploaded"
              file-type="workbook"
              :row-id="nextId" 
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              multiple
            />
            <div v-if="newRow.workbook && newRow.workbook.length > 0" class="files-preview">
              <h4>Загруженные тетради:</h4>
              <ul>
                <li v-for="(url, index) in newRow.workbook" :key="index" class="file-item">
                  <a :href="url" target="_blank" class="file-link">Тетрадь {{ index + 1 }}</a>
                  <button @click="removeWorkbook(index)" class="btn-remove-small">×</button>
                </li>
              </ul>
            </div>
          </div>

          <!-- Практические задания (массив ссылок) -->
          <div class="form-group">
            <label>Практические задания (можно несколько):</label>
            <FileUploader 
              @files-uploaded="handlePracticesUploaded"
              file-type="practice"
              :row-id="nextId" 
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              multiple
            />
            <div v-if="newRow.practice && newRow.practice.length > 0" class="files-preview">
              <h4>Загруженные задания:</h4>
              <ul>
                <li v-for="(url, index) in newRow.practice" :key="index" class="file-item">
                  <a :href="url" target="_blank" class="file-link">Задание {{ index + 1 }}</a>
                  <button @click="removePractice(index)" class="btn-remove-small">×</button>
                </li>
              </ul>
            </div>
          </div>
          
          <button type="submit" class="btn-add" :disabled="!newRow.title">
            Добавить запись
          </button>
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
                <th class="table-header">Тетради</th>
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
                
                <!-- Видео -->
                <td class="table-cell">
                  <div class="video-management">
                    <div class="video-text-input">
        <textarea
          :value="getVideoTextForRow(row)"
          @input="(e) => updateRowVideosFromText(row, e.target.value)"
          placeholder="Вставьте iframe коды, разделяя пустой строкой"
          rows="4"
          class="table-textarea video-textarea"
        ></textarea>
                    </div>
                    <div v-if="row.video && row.video.length > 0" class="files-list-compact">
                      <div class="video-count">Видео: {{ row.video.length }}</div>
                      <div class="video-previews">
                        <div v-for="(iframeHtml, index) in row.video" :key="index" class="video-preview-item">
                          <div class="video-preview" v-html="iframeHtml"></div>
                          <button @click="removeRowVideo(row, index)" class="btn-remove-small">×</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
                
                <!-- Тетради -->
                <td class="table-cell">
                  <FileUploader 
                    @files-uploaded="(urls) => updateRowFiles(row, 'workbook', urls)"
                    :current-files="row.workbook || []"
                    file-type="workbook"
                    :row-id="row[primaryKey]"
                    compact
                    multiple
                  />
                  <div v-if="row.workbook && row.workbook.length > 0" class="files-list-compact">
                    <div v-for="(url, index) in row.workbook" :key="index" class="file-item-compact">
                      <a :href="url" target="_blank" class="file-link">📘</a>
                      <span class="file-tooltip">Тетрадь {{ index + 1 }}</span>
                      <button @click="removeWorkbookFromRow(row, index)" class="btn-remove-small">×</button>
                    </div>
                  </div>
                </td>
                
                <!-- Практика -->
                <td class="table-cell">
                  <FileUploader 
                    @files-uploaded="(urls) => updateRowFiles(row, 'practice', urls)"
                    :current-files="row.practice || []"
                    file-type="practice"
                    :row-id="row[primaryKey]"
                    compact
                    multiple
                  />
                  <div v-if="row.practice && row.practice.length > 0" class="files-list-compact">
                    <div v-for="(url, index) in row.practice" :key="index" class="file-item-compact">
                      <a :href="url" target="_blank" class="file-link">📝</a>
                      <span class="file-tooltip">Задание {{ index + 1 }}</span>
                      <button @click="removePracticeFromRow(row, index)" class="btn-remove-small">×</button>
                    </div>
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

      <div v-if="done" class="success">
        ✅ Запись успешно добавлена!
      </div>

      <div v-if="error" class="error">
        ❌ {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase.js'
import FileUploader from './FileUploader.vue'

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
const videoTextInput = ref('')
const nextId = ref(1)
const error = ref(null)
const done = ref(false)

// Утилиты
const formatBytes = (n) => {
  if (n === 0) return "0 B"
  const k = 1024, units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(n) / Math.log(k))
  return `${(n / Math.pow(k, i)).toFixed(2)} ${units[i]}`
}

const getDefaultValue = (fieldType) => {
  switch (fieldType) {
    case 'number': return 0
    case 'date': return null
    case 'textarea':
    case 'text':
    default: return ''
  }
}

// Функции для работы с iframe
const extractIframesFromText = (text) => {
  if (!text) return []
  
  // Разделяем на блоки по пустым строкам
  const blocks = text.split(/\n\s*\n/).filter(block => block.trim())
  
  const iframes = []
  
  blocks.forEach(block => {
    const trimmedBlock = block.trim()
    
    // Ищем iframe теги в блоке
    const iframeRegex = /<iframe[\s\S]*?<\/iframe>/gi
    const foundIframes = trimmedBlock.match(iframeRegex)
    
    if (foundIframes && foundIframes.length > 0) {
      // Добавляем все найденные iframe
      iframes.push(...foundIframes)
    } else if (trimmedBlock.startsWith('<iframe') && !trimmedBlock.includes('</iframe>')) {
      // Если iframe не закрыт, добавляем закрывающий тег
      iframes.push(trimmedBlock + '</iframe>')
    } else if (trimmedBlock) {
      // Если это просто URL, создаем iframe
      const urlMatch = trimmedBlock.match(/(https?:\/\/[^\s]+)/)
      if (urlMatch) {
        iframes.push(`<iframe src="${urlMatch[1]}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`)
      }
    }
  })
  
  return iframes
}

const iframesToText = (iframes) => {
  if (!iframes || !Array.isArray(iframes)) return ''
  return iframes.join('\n\n')
}


// Инициализация
const initNewRow = () => {
  const initialData = props.fields.reduce((obj, field) => {
    obj[field.name] = getDefaultValue(field.type)
    return obj
  }, {})
  
  initialData.video = []
  initialData.workbook = []
  initialData.practice = []
  initialData.homework = []
  
  newRow.value = { ...initialData }
  videoTextInput.value = ''
}

// Обработчики для новой записи
const processVideoTextInput = () => {
  const iframes = extractIframesFromText(videoTextInput.value)
  newRow.value.video = iframes
}

const handleWorkbooksUploaded = (urls) => {
  newRow.value.workbook = [...(newRow.value.workbook || []), ...urls]
}

const handlePracticesUploaded = (urls) => {
  newRow.value.practice = [...(newRow.value.practice || []), ...urls]
}

const removeVideo = (index) => {
  newRow.value.video.splice(index, 1)
  videoTextInput.value = iframesToText(newRow.value.video)
}

const removeWorkbook = (index) => {
  newRow.value.workbook.splice(index, 1)
}

const removePractice = (index) => {
  newRow.value.practice.splice(index, 1)
}

// Работа с базой данных
const calculateNextId = async () => {
  try {
    const { data, error } = await supabase
      .from(props.tableName)
      .select(props.primaryKey)
      .order(props.primaryKey, { ascending: false })
      .limit(1)
    
    if (error) throw error
    nextId.value = data && data.length > 0 ? data[0][props.primaryKey] + 1 : 1
  } catch (error) {
    console.error('Ошибка при вычислении ID:', error)
    nextId.value = Date.now()
  }
}

const fetchRows = async () => {
  try {
    const { data, error } = await supabase
      .from(props.tableName)
      .select('*')
      .order(props.primaryKey, { ascending: true })
    
    if (error) throw error
    
    rows.value = data.map(row => ({
      ...row,
      video: convertToArray(row.video),
      workbook: convertToArray(row.workbook),
      practice: convertToArray(row.practice),
      homework: convertToArray(row.homework)
    })) || []
    
  } catch (error) {
    console.error('Ошибка при загрузке данных:', error)
    alert('Ошибка загрузки данных: ' + error.message)
  }
}

const convertToArray = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return [value]
    }
  }
  return value || []
}

const prepareDataForDb = (data) => {
  const cleaned = { ...data }
  
  props.fields.forEach(field => {
    if (field.type === 'date' && (cleaned[field.name] === '' || cleaned[field.name] === null)) {
      cleaned[field.name] = null
    }
  })
  
  cleaned.video = JSON.stringify(Array.isArray(cleaned.video) ? cleaned.video : [])
  cleaned.workbook = JSON.stringify(Array.isArray(cleaned.workbook) ? cleaned.workbook : [])
  cleaned.practice = JSON.stringify(Array.isArray(cleaned.practice) ? cleaned.practice : [])
  cleaned.homework = JSON.stringify(Array.isArray(cleaned.homework) ? cleaned.homework : [])
  
  return cleaned
}

// Основные операции
const addNewRow = async () => {
  try {
    const rowToInsert = prepareDataForDb({
      ...newRow.value,
      [props.primaryKey]: nextId.value
    })

    const { error } = await supabase
      .from(props.tableName)
      .insert([rowToInsert])

    if (error) throw error

    await fetchRows()
    await calculateNextId()
    initNewRow()
    
    done.value = true
    setTimeout(() => { done.value = false }, 3000)
    
  } catch (error) {
    console.error('Ошибка при добавлении записи:', error)
    alert('Произошла ошибка: ' + error.message)
  }
}

const updateRow = async (row) => {
  try {
    const cleanedData = prepareDataForDb(row)
    const { error } = await supabase
      .from(props.tableName)
      .update(cleanedData)
      .eq(props.primaryKey, row[props.primaryKey])

    if (error) throw error
    
  } catch (error) {
    console.error('Ошибка при обновлении:', error)
    alert('Ошибка обновления: ' + error.message)
  }
}

const getVideoTextForRow = (row) => {
  return iframesToText(row.video || [])
}


// Функции для работы с видео в существующих записях
let updateTimeout = null

const updateRowVideosFromText = (row, text) => {
  const iframes = extractIframesFromText(text)
  row.video = iframes
  
  // Используем debounce для избежания слишком частых обновлений
  if (updateTimeout) clearTimeout(updateTimeout)
  updateTimeout = setTimeout(() => {
    updateRow(row)
  }, 1000) // Обновляем через 1 секунду после последнего изменения
}

const removeRowVideo = (row, index) => {
  row.video.splice(index, 1)
  updateRow(row)
}

// Функции для работы с файлами в существующих записях
const updateRowFiles = async (row, fieldName, urls) => {
  try {
    // Создаем копию текущего массива файлов и добавляем новые
    const currentFiles = Array.isArray(row[fieldName]) ? [...row[fieldName]] : []
    const updatedFiles = [...currentFiles, ...urls]
    
    // Обновляем локальное состояние
    const updatedRow = {
      ...row,
      [fieldName]: updatedFiles
    }
    
    // Обновляем в базе данных
    const cleanedData = prepareDataForDb(updatedRow)
    const { error } = await supabase
      .from(props.tableName)
      .update(cleanedData)
      .eq(props.primaryKey, row[props.primaryKey])

    if (error) throw error
    
    // Обновляем локальный массив rows
    const index = rows.value.findIndex(r => r[props.primaryKey] === row[props.primaryKey])
    if (index !== -1) {
      rows.value[index] = updatedRow
    }
    
  } catch (error) {
    console.error('Ошибка при обновлении файлов:', error)
    alert('Ошибка обновления файлов: ' + error.message)
  }
}

const removeWorkbookFromRow = async (row, index) => {
  try {
    const updatedWorkbooks = [...row.workbook]
    updatedWorkbooks.splice(index, 1)
    
    const updatedRow = {
      ...row,
      workbook: updatedWorkbooks
    }
    
    const cleanedData = prepareDataForDb(updatedRow)
    const { error } = await supabase
      .from(props.tableName)
      .update(cleanedData)
      .eq(props.primaryKey, row[props.primaryKey])

    if (error) throw error
    
    const rowIndex = rows.value.findIndex(r => r[props.primaryKey] === row[props.primaryKey])
    if (rowIndex !== -1) {
      rows.value[rowIndex] = updatedRow
    }
    
  } catch (error) {
    console.error('Ошибка при удалении тетради:', error)
    alert('Ошибка удаления тетради: ' + error.message)
  }
}

const removePracticeFromRow = async (row, index) => {
  try {
    const updatedPractices = [...row.practice]
    updatedPractices.splice(index, 1)
    
    const updatedRow = {
      ...row,
      practice: updatedPractices
    }
    
    const cleanedData = prepareDataForDb(updatedRow)
    const { error } = await supabase
      .from(props.tableName)
      .update(cleanedData)
      .eq(props.primaryKey, row[props.primaryKey])

    if (error) throw error
    
    const rowIndex = rows.value.findIndex(r => r[props.primaryKey] === row[props.primaryKey])
    if (rowIndex !== -1) {
      rows.value[rowIndex] = updatedRow
    }
    
  } catch (error) {
    console.error('Ошибка при удалении задания:', error)
    alert('Ошибка удаления задания: ' + error.message)
  }
}

const deleteRow = async (id) => {
  if (!confirm('Удалить эту запись?')) return

  try {
    const { error } = await supabase
      .from(props.tableName)
      .delete()
      .eq(props.primaryKey, id)

    if (error) throw error

    await fetchRows()
    await calculateNextId()
    
  } catch (error) {
    console.error('Ошибка при удалении:', error)
    alert('Ошибка удаления: ' + error.message)
  }
}

// Инициализация
onMounted(async () => {
  initNewRow()
  await fetchRows()
  await calculateNextId()
})

const GoBackToEditPage = () => {
  emit('back-to-edit')
}
</script>
<style scoped>
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

.files-preview {
  margin-top: 10px;
  padding: 10px;
  background: #f0f8ff;
  border-radius: 4px;
  border: 1px solid #b8daff;
}

.files-preview h4 {
  margin: 0 0 10px 0;
  color: #004085;
}

.iframe-previews {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.iframe-preview-item {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  background: white;
}

.iframe-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 5px;
  border-bottom: 1px solid #eee;
}

.iframe-preview-content {
  display: flex;
  justify-content: center;
}

.iframe-preview-content iframe {
  max-width: 100%;
  height: 200px;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  margin-bottom: 5px;
  background: white;
  border-radius: 3px;
  border: 1px solid #dee2e6;
}

.btn-remove-small {
  padding: 2px 6px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.btn-add {
  padding: 12px 24px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  font-size: 16px;
}

.btn-add:hover {
  background-color: #45a049;
}

.btn-add:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
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
.video-textarea {
  font-family: monospace;
  font-size: 12px;
  min-height: 120px;
}

.video-management {
  min-width: 300px;
}

.video-text-input {
  margin-bottom: 10px;
}

.video-count {
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.video-previews {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.video-preview-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.video-preview {
  flex: 1;
  display: flex;
  justify-content: center;
}

.video-preview iframe {
  max-width: 100%;
  height: 80px;
}

.file-link {
  color: #2e7d32;
  text-decoration: none;
}

.file-link:hover {
  text-decoration: underline;
}

.files-list-compact {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}

.file-item-compact {
  position: relative;
  display: inline-block;
}

.file-item-compact .file-link {
  display: block;
  padding: 4px;
  font-size: 16px;
  text-decoration: none;
}

.file-tooltip {
  visibility: hidden;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: white;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 100;
}

.file-item-compact:hover .file-tooltip {
  visibility: visible;
}

.actions-cell {
  white-space: nowrap;
  text-align: center;
}

.btn-delete {
  padding: 6px 12px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.btn-delete:hover {
  background-color: #c82333;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
  font-style: italic;
}

.success {
  margin-top: 12px;
  color: #16a34a;
  font-weight: 600;
  padding: 10px;
  background: #d1fae5;
  border-radius: 4px;
  border: 1px solid #86efac;
}

.error {
  margin-top: 12px;
  color: #dc2626;
  padding: 10px;
  background: #fee2e2;
  border-radius: 4px;
  border: 1px solid #fca5a5;
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
  
  .video-management {
    min-width: auto;
  }
}
</style>