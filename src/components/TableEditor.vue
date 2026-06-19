<template>
  <div class="editor-container">
    <button @click="GoBackToEditPage" class="back-button">← Вернуться к выбору</button>
    
    <div class="container">
      <h1 class="page-title">Редактирование: {{ tableTitle }}</h1>
      
      <div class="tabs">
        <button 
          @click="activeTab = 'add'" 
          :class="{ active: activeTab === 'add' }"
          class="tab-button"
        >
          ➕ Добавить запись
        </button>
        <button 
          @click="activeTab = 'table'" 
          :class="{ active: activeTab === 'table' }"
          class="tab-button"
        >
          📋 Просмотр записей
        </button>
      </div>

      <!-- === Вкладка добавления === -->
      <div v-if="activeTab === 'add'" class="add-form">
        <h2>Новая запись</h2>
        
        <form @submit.prevent="addNewRow">
          <div class="form-group">
            <label>Номер:</label>
            <div class="number-display">{{ nextId }}</div>
          </div>
          
          <div v-for="field in filteredFields" :key="field.name" class="form-group">
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
              class="form-input"
            >
            
            <textarea 
              v-else 
              v-model="newRow[field.name]"
              class="form-textarea"
              rows="4"
            ></textarea>
          </div>
          
          <!-- Видео -->
          <div class="form-group">
            <label>Видео iframe (можно несколько, разделяйте пустой строкой):</label>
            <textarea 
              v-model="videoTextInput"
              @input="processVideoTextInput"
              placeholder="Вставьте iframe коды здесь, разделяя их пустой строкой"
              class="form-textarea"
              rows="4"
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

          <!-- Альтернативные ссылки -->
          <div class="form-group">
            <label>Альтернативные ссылки (можно несколько):</label>
            <div class="links-input-container">
              <div v-for="(link, index) in newRow.alternativeLinks" :key="index" class="link-input-group">
                <input 
                  type="url" 
                  v-model="newRow.alternativeLinks[index]"
                  placeholder="https://example.com"
                  class="form-input link-input"
                >
                <button @click="removeAlternativeLink(index)" type="button" class="btn-remove-small">×</button>
              </div>
              <button @click="addAlternativeLink" type="button" class="btn-add-link">+ Добавить ссылку</button>
            </div>
          </div>

          <!-- Рабочие тетради -->
          <div class="form-group">
            <label>Рабочие тетради:</label>
            <div class="file-management">
              <div class="file-upload-section">
                <FileUploader 
                  @files-uploaded="handleWorkbooksUploaded"
                  file-type="workbook"
                  :row-id="nextId" 
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  multiple
                />
              </div>
              <div v-if="newRow.workbook && newRow.workbook.length > 0" class="files-preview">
                <div v-for="(filePath, index) in newRow.workbook" :key="index" class="file-item">
                  <span class="file-name">📄 {{ getDisplayName(filePath) }}</span>
                  <a :href="getProxyUrl(filePath)" target="_blank" class="file-link">Открыть</a>
                  <button @click="removeWorkbook(index)" class="btn-remove-small">×</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Практические задания -->
          <div class="form-group">
            <label>Практические задания:</label>
            <div class="file-management">
              <div class="file-upload-section">
                <FileUploader 
                  @files-uploaded="handlePracticesUploaded"
                  file-type="practice"
                  :row-id="nextId" 
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  multiple
                />
              </div>
              <div v-if="newRow.practice && newRow.practice.length > 0" class="files-preview">
                <div v-for="(filePath, index) in newRow.practice" :key="index" class="file-item">
                  <span class="file-name">📝 {{ getDisplayName(filePath) }}</span>
                  <a :href="getProxyUrl(filePath)" target="_blank" class="file-link">Открыть</a>
                  <button @click="removePractice(index)" class="btn-remove-small">×</button>
                </div>
              </div>
            </div>
          </div>
          
          <button type="submit" class="btn-add" :disabled="!newRow.title">
            💾 Сохранить запись
          </button>
        </form>
      </div>

      <!-- === Вкладка просмотра === -->
      <div v-if="activeTab === 'table'" class="table-container">
        <h2>Существующие записи</h2>
        
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="col-number">№</th>
                <th v-for="field in filteredFields" :key="field.name" class="table-header">
                  {{ field.label }}
                </th>
                <th class="col-video">Видео</th>
                <th class="col-links">Ссылки</th>
                <th class="col-files">Тетради</th>
                <th class="col-files">Практика</th>
                <th class="col-actions">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row[primaryKey]" class="table-row">
                <td class="col-number">{{ row[primaryKey] }}</td>
                
                <td v-for="field in filteredFields" :key="field.name" class="table-cell">
                  <input 
                    v-if="field.type !== 'textarea'" 
                    :type="field.type" 
                    v-model="row[field.name]"
                    @change="updateRow(row)"
                    class="table-input"
                  >
                  <textarea 
                    v-else 
                    v-model="row[field.name]"
                    @change="updateRow(row)"
                    class="table-textarea"
                    rows="2"
                  ></textarea>
                </td>
                
                <!-- Видео -->
                <td class="table-cell col-video">
                  <div class="video-management">
                    <textarea
                      :value="getVideoTextForRow(row)"
                      @input="(e) => updateRowVideosFromText(row, e.target.value)"
                      placeholder="Вставьте iframe коды, разделяя пустой строкой"
                      rows="2"
                      class="table-textarea video-textarea"
                    ></textarea>
                    <div v-if="row.video && row.video.length > 0" class="video-count">
                      Видео: {{ row.video.length }}
                    </div>
                  </div>
                </td>
                
                <!-- Альтернативные ссылки -->
                <td class="table-cell col-links">
                  <div class="links-list">
                    <div v-for="(link, index) in row.alternativeLinks" :key="index" class="link-item">
                      <input 
                        type="url" 
                        v-model="row.alternativeLinks[index]"
                        @change="updateRow(row)"
                        placeholder="https://example.com"
                        class="link-input-small"
                      >
                      <button @click="removeAlternativeLinkFromRow(row, index)" class="btn-remove-small">×</button>
                    </div>
                    <button @click="addAlternativeLinkToRow(row)" class="btn-add-link-small">+ Добавить</button>
                  </div>
                </td>
                
                <!-- Тетради -->
                <td class="table-cell col-files">
                  <div class="file-cell">
                    <div class="file-cell-actions">
                      <FileUploader 
                        @files-uploaded="(urls) => updateRowFiles(row, 'workbook', urls)"
                        :current-files="row.workbook || []"
                        file-type="workbook"
                        :row-id="row[primaryKey]"
                        compact
                        multiple
                      />
                    </div>
                    <div v-if="row.workbook && row.workbook.length > 0" class="files-list">
                      <div v-for="(filePath, index) in row.workbook" :key="index" class="file-item-compact">
                        <a :href="getProxyUrl(filePath)" target="_blank" class="file-link" :title="getDisplayName(filePath)">📘</a>
                        <button @click="removeWorkbookFromRow(row, index)" class="btn-remove-small">×</button>
                      </div>
                    </div>
                  </div>
                </td>
                
                <!-- Практика -->
                <td class="table-cell col-files">
                  <div class="file-cell">
                    <div class="file-cell-actions">
                      <FileUploader 
                        @files-uploaded="(urls) => updateRowFiles(row, 'practice', urls)"
                        :current-files="row.practice || []"
                        file-type="practice"
                        :row-id="row[primaryKey]"
                        compact
                        multiple
                      />
                    </div>
                    <div v-if="row.practice && row.practice.length > 0" class="files-list">
                      <div v-for="(filePath, index) in row.practice" :key="index" class="file-item-compact">
                        <a :href="getProxyUrl(filePath)" target="_blank" class="file-link" :title="getDisplayName(filePath)">📝</a>
                        <button @click="removePracticeFromRow(row, index)" class="btn-remove-small">×</button>
                      </div>
                    </div>
                  </div>
                </td>
                
                <td class="table-cell col-actions">
                  <button @click="deleteRow(row[primaryKey])" class="btn-delete">🗑 Удалить</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div v-if="rows.length === 0" class="empty-state">
          <p>📭 Записей пока нет</p>
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
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase.js'
import FileUploader from './FileUploader.vue'

// === Конфигурация прокси (как в lesson.vue) ===
const getProxyUrl = (url) => {
  if (!url) return '';
  if (url.includes('supabase.co/storage/v1/object/public/')) {
    return url.replace('https://mltqewxnxinaytavbmds.supabase.co/storage/v1/object/public/', '/storage/');
  }
  return url;
};

const getDisplayName = (filePath) => {
  if (!filePath) return ''
  const fileName = filePath.split('/').pop()
  
  let cleanName = fileName.replace(/^(workbook|practice)_\d+_\d+_/, '')
  cleanName = cleanName.replace(/_\d+_[a-z0-9]{9}\./, '.')
  if (cleanName.length > 40) {
    const ext = cleanName.split('.').pop()
    const name = cleanName.slice(0, 36)
    return `${name}...${ext}`
  }
  return cleanName
}

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

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
    required: true
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

// === Фильтрация полей ===
const filteredFields = computed(() => {
  const excludeFields = ['video', 'content', 'homework', 'workbook', 'practice', 'number']
  return props.fields.filter(field => !excludeFields.includes(field.name))
})

// === Работа с iframe ===
const extractIframesFromText = (text) => {
  if (!text) return []
  
  const blocks = text.split(/\n\s*\n/).filter(block => block.trim())
  const iframes = []
  
  blocks.forEach(block => {
    const trimmedBlock = block.trim()
    const iframeRegex = /<iframe[\s\S]*?<\/iframe>/gi
    const foundIframes = trimmedBlock.match(iframeRegex)
    
    if (foundIframes && foundIframes.length > 0) {
      iframes.push(...foundIframes)
    } else if (trimmedBlock.startsWith('<iframe') && !trimmedBlock.includes('</iframe>')) {
      iframes.push(trimmedBlock + '</iframe>')
    } else if (trimmedBlock) {
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

// === Альтернативные ссылки ===
const addAlternativeLink = () => {
  if (!newRow.value.alternativeLinks) {
    newRow.value.alternativeLinks = []
  }
  newRow.value.alternativeLinks.push('')
}

const removeAlternativeLink = (index) => {
  newRow.value.alternativeLinks.splice(index, 1)
}

const addAlternativeLinkToRow = (row) => {
  if (!row.alternativeLinks) {
    row.alternativeLinks = []
  }
  row.alternativeLinks.push('')
  updateRow(row)
}

const removeAlternativeLinkFromRow = async (row, index) => {
  try {
    const updatedLinks = [...row.alternativeLinks]
    updatedLinks.splice(index, 1)
    
    const updatedRow = { ...row, alternativeLinks: updatedLinks }
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
    console.error('Ошибка:', error)
    alert('Ошибка удаления ссылки: ' + error.message)
  }
}

// === Инициализация ===
const initNewRow = () => {
  const initialData = props.fields.reduce((obj, field) => {
    if (field.name === 'number') {
      obj[field.name] = null
    } else {
      obj[field.name] = getDefaultValue(field.type)
    }
    return obj
  }, {})
  
  initialData.video = []
  initialData.alternativeLinks = []
  initialData.workbook = []
  initialData.practice = []
  
  newRow.value = { ...initialData }
  videoTextInput.value = ''
}

const getDefaultValue = (fieldType) => {
  switch (fieldType) {
    case 'number': return 0
    case 'date': return null
    default: return ''
  }
}

const processVideoTextInput = () => {
  const iframes = extractIframesFromText(videoTextInput.value)
  newRow.value.video = iframes
}

const removeVideo = (index) => {
  newRow.value.video.splice(index, 1)
  videoTextInput.value = iframesToText(newRow.value.video)
}

// === Обработчики загрузки файлов ===
const handleWorkbooksUploaded = (paths) => {
  newRow.value.workbook = [...(newRow.value.workbook || []), ...paths]
}

const handlePracticesUploaded = (paths) => {
  newRow.value.practice = [...(newRow.value.practice || []), ...paths]
}

const removeWorkbook = (index) => {
  newRow.value.workbook.splice(index, 1)
}

const removePractice = (index) => {
  newRow.value.practice.splice(index, 1)
}

// === Работа с базой данных ===
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
    console.error('Ошибка:', error)
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
      alternativeLinks: convertToArray(row.alternativeLinks),
      workbook: convertToArray(row.workbook),
      practice: convertToArray(row.practice)
    })) || []
    
  } catch (error) {
    console.error('Ошибка:', error)
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
  cleaned.alternativeLinks = JSON.stringify(Array.isArray(cleaned.alternativeLinks) ? cleaned.alternativeLinks : [])
  cleaned.workbook = JSON.stringify(Array.isArray(cleaned.workbook) ? cleaned.workbook : [])
  cleaned.practice = JSON.stringify(Array.isArray(cleaned.practice) ? cleaned.practice : [])
  
  return cleaned
}

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
    console.error('Ошибка:', error)
    alert('Ошибка: ' + error.message)
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
    console.error('Ошибка обновления:', error)
    alert('Ошибка обновления: ' + error.message)
  }
}

const getVideoTextForRow = (row) => {
  return iframesToText(row.video || [])
}

let updateTimeout = null

const updateRowVideosFromText = (row, text) => {
  const iframes = extractIframesFromText(text)
  row.video = iframes
  
  if (updateTimeout) clearTimeout(updateTimeout)
  updateTimeout = setTimeout(() => {
    updateRow(row)
  }, 1000)
}

const updateRowFiles = async (row, fieldName, paths) => {
  try {
    const currentFiles = Array.isArray(row[fieldName]) ? [...row[fieldName]] : []
    const updatedFiles = [...currentFiles, ...paths]
    
    const updatedRow = { ...row, [fieldName]: updatedFiles }
    const cleanedData = prepareDataForDb(updatedRow)
    
    const { error } = await supabase
      .from(props.tableName)
      .update(cleanedData)
      .eq(props.primaryKey, row[props.primaryKey])

    if (error) throw error
    
    const index = rows.value.findIndex(r => r[props.primaryKey] === row[props.primaryKey])
    if (index !== -1) {
      rows.value[index] = updatedRow
    }
    
  } catch (error) {
    console.error('Ошибка:', error)
    alert('Ошибка обновления файлов: ' + error.message)
  }
}

const removeWorkbookFromRow = async (row, index) => {
  try {
    const updatedWorkbooks = [...row.workbook]
    updatedWorkbooks.splice(index, 1)
    
    const updatedRow = { ...row, workbook: updatedWorkbooks }
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
    console.error('Ошибка:', error)
    alert('Ошибка удаления тетради: ' + error.message)
  }
}

const removePracticeFromRow = async (row, index) => {
  try {
    const updatedPractices = [...row.practice]
    updatedPractices.splice(index, 1)
    
    const updatedRow = { ...row, practice: updatedPractices }
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
    console.error('Ошибка:', error)
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
    console.error('Ошибка:', error)
    alert('Ошибка удаления: ' + error.message)
  }
}

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
* {
  font-family: Evolventa, sans-serif;
  box-sizing: border-box;
}

.editor-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
  background: #f5f7fa;
  z-index: 100;
  padding: 20px;
}

.back-button {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 10px 20px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  margin-bottom: 20px;
}

.back-button:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

.container {
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 24px;
}

.tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0;
}

.tab-button {
  padding: 12px 24px;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  color: #718096;
  transition: all 0.2s ease;
}

.tab-button:hover {
  color: #2d3748;
}

.tab-button.active {
  color: #b241d1;
  border-bottom-color: #b241d1;
}

.add-form, .table-container {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

h2 {
  font-size: 20px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #4a5568;
  font-size: 14px;
}

.number-display {
  padding: 10px 14px;
  background: #f7fafc;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #b241d1;
  border: 1.5px solid #e2e8f0;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.2s ease;
  font-family: Evolventa, sans-serif;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 3px rgba(178, 65, 209, 0.1);
}

.form-textarea {
  min-height: 80px;
  resize: vertical;
}

.links-input-container {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
  background: #f7fafc;
}

.link-input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.link-input-group:last-child {
  margin-bottom: 0;
}

.link-input {
  flex: 1;
}

.btn-add-link {
  padding: 6px 14px;
  background: #48bb78;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  margin-top: 8px;
}

.btn-add-link:hover {
  background: #38a169;
}

.btn-add-link-small {
  padding: 4px 10px;
  background: #48bb78;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-add-link-small:hover {
  background: #38a169;
}

.btn-remove-small {
  padding: 2px 8px;
  background: #fc8181;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.btn-remove-small:hover {
  background: #f56565;
}

.files-preview {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f7fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.file-name {
  flex: 1;
  font-size: 13px;
  color: #4a5568;
}

.file-link {
  color: #b241d1;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.file-link:hover {
  background: rgba(178, 65, 209, 0.1);
  text-decoration: underline;
}

.iframe-previews {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.iframe-preview-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
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

.btn-add {
  padding: 12px 24px;
  background: #b241d1;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s ease;
  width: 100%;
}

.btn-add:hover:not(:disabled) {
  background: #9a36b8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(178, 65, 209, 0.3);
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.table-wrapper {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th {
  background: #f7fafc;
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #4a5568;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}

.data-table td {
  padding: 10px 16px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: middle;
}

.data-table tr:hover {
  background: #f7fafc;
}

.col-number {
  width: 60px;
  min-width: 60px;
  max-width: 60px;
  text-align: center;
  font-weight: 700;
  color: #b241d1;
  font-size: 15px;
}

.col-video {
  min-width: 200px;
}

.col-links {
  min-width: 200px;
}

.col-files {
  min-width: 100px;
}

.col-actions {
  width: 100px;
  text-align: center;
}

.table-input, .table-textarea {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.2s ease;
  font-family: Evolventa, sans-serif;
}

.table-input:focus, .table-textarea:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.1);
}

.table-textarea {
  min-height: 40px;
  resize: vertical;
}

.video-textarea {
  font-family: monospace;
  font-size: 12px;
  min-height: 60px;
}

.video-count {
  font-size: 12px;
  color: #666;
  margin-top: 5px;
}

.links-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.link-item {
  display: flex;
  gap: 4px;
  align-items: center;
}

.link-input-small {
  flex: 1;
  min-width: 100px;
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 12px;
}

.link-input-small:focus {
  outline: none;
  border-color: #b241d1;
}

.files-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.file-item-compact {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  background: #f7fafc;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.file-item-compact .file-link {
  font-size: 18px;
  text-decoration: none;
  padding: 0 4px;
}

.btn-delete {
  padding: 4px 12px;
  background: #fc8181;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-delete:hover {
  background: #f56565;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #a0aec0;
  font-size: 16px;
}

.success {
  margin-top: 16px;
  padding: 12px 16px;
  background: #c6f6d5;
  color: #276749;
  border-radius: 10px;
  border: 1px solid #9ae6b4;
}

.error {
  margin-top: 16px;
  padding: 12px 16px;
  background: #fed7d7;
  color: #c53030;
  border-radius: 10px;
  border: 1px solid #feb2b2;
}

/* === Управление файлами === */
.file-management {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.file-upload-section {
  display: flex;
  align-items: center;
}

.file-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-cell-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

@media (max-width: 768px) {
  .editor-container {
    padding: 12px;
  }
  
  .tabs {
    flex-direction: column;
    gap: 8px;
  }
  
  .tab-button {
    padding: 10px 16px;
  }
  
  .add-form, .table-container {
    padding: 16px;
  }
  
  .data-table {
    font-size: 12px;
  }
  
  .data-table th,
  .data-table td {
    padding: 6px 8px;
  }
  
  .col-number {
    width: 40px;
    min-width: 40px;
    max-width: 40px;
    font-size: 13px;
  }
  
  .col-actions {
    width: 70px;
  }
}
</style>