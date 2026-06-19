<template>
  <div class="upload-materials">
    <div class="header">
      <h2>Управление полезными материалами</h2>
      <button @click="loadMaterials" class="refresh-btn" :disabled="loading">
        🔄 Обновить
      </button>
    </div>

    <!-- Форма загрузки -->
    <div class="upload-form">
      <h3>Загрузить новый материал</h3>
      
      <form @submit.prevent="uploadMaterial" class="form-grid">
        <div class="form-group">
          <label for="material-name">Название *</label>
          <input
            id="material-name"
            v-model="newMaterial.name"
            type="text"
            required
            placeholder="Введите название материала"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="material-type">Тип *</label>
          <CustomDropdown
            id="material-type"
            v-model="newMaterial.type"
            :options="typeOptions"
            placeholder="Выберите тип"
            required
          />
        </div>

        <div class="form-group">
          <label for="material-subject">Предмет *</label>
          <CustomDropdown
            id="material-subject"
            v-model="newMaterial.subject"
            :options="subjectOptions"
            placeholder="Выберите предмет"
            required
          />
        </div>

        <div class="form-group">
          <label for="material-description">Описание</label>
          <textarea
            id="material-description"
            v-model="newMaterial.description"
            placeholder="Введите описание материала"
            class="form-textarea"
            rows="3"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="material-file">Файл *</label>
          <div class="file-upload-area">
            <input
              id="material-file"
              ref="fileInput"
              type="file"
              @change="handleFileSelect"
              required
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
              class="file-input"
            />
            <label for="material-file" class="file-label">
              <span class="file-icon">📁</span>
              <span v-if="newMaterial.fileName">{{ newMaterial.fileName }}</span>
              <span v-else>Выберите файл</span>
            </label>
            <span v-if="newMaterial.fileSize" class="file-size">
              {{ formatFileSize(newMaterial.fileSize) }}
            </span>
          </div>
        </div>

        <button type="submit" class="submit-btn" :disabled="uploading || !isFormValid">
          {{ uploading ? 'Загрузка...' : '📤 Загрузить материал' }}
        </button>
      </form>
    </div>

    <!-- Список материалов -->
    <div class="materials-list">
      <div class="materials-header">
        <h3>Существующие материалы</h3>
        <div v-if="materials.length > 0" class="filter-controls">
          <CustomDropdown
            v-model="filterSubject"
            :options="filterSubjectOptions"
            placeholder="Все предметы"
            class="filter-dropdown"
          />
          <CustomDropdown
            v-model="filterType"
            :options="filterTypeOptions"
            placeholder="Все типы"
            class="filter-dropdown"
          />
        </div>
      </div>
      
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Загрузка материалов...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <span class="error-icon">⚠️</span>
        <p>{{ error }}</p>
        <button @click="loadMaterials" class="retry-btn">Повторить</button>
      </div>

      <div v-else-if="filteredMaterials.length === 0" class="empty-state">
        <span class="empty-icon">📭</span>
        <p v-if="materials.length === 0">Нет загруженных материалов</p>
        <p v-else>Нет материалов, соответствующих фильтрам</p>
      </div>

      <div v-else class="materials-grid">
        <div 
          v-for="material in filteredMaterials" 
          :key="material.id"
          class="material-item"
        >
          <div class="material-item-header">
            <span class="material-type-badge" :class="material.type">
              {{ getTypeLabel(material.type) }}
            </span>
            <span class="material-subject-badge">
              {{ material.subject }}
            </span>
            <button 
              @click="deleteMaterial(material.id)" 
              class="delete-btn"
              :disabled="deleting"
              title="Удалить материал"
            >
              🗑️
            </button>
          </div>
          
          <div class="material-item-content">
            <h4>{{ material.name }}</h4>
            <p v-if="material.description">{{ material.description }}</p>
            <span class="file-name">📄 {{ getFileName(material.link) }}</span>
          </div>
          
          <div class="material-item-actions">
            <a :href="getMaterialUrl(material.link)" target="_blank" class="download-link">
              📥 Скачать
            </a>
            <span class="created-at">{{ formatDate(material.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Уведомления -->
    <div v-if="notification.show" class="notification" :class="notification.type">
      {{ notification.message }}
    </div>
  </div>
</template>

<script>
import { supabase } from '../supabase.js'
import CustomDropdown from './CustomDropdown.vue'

// === Конфигурация прокси сервера ===
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

const PROXY_CONFIG = {
  enabled: true,
  baseUrl: isLocalhost 
    ? 'https://schoolpurto.ru/storage' 
    : '/storage'
}

export default {
  name: 'UploadUsefulMaterials',
  components: {
    CustomDropdown
  },
  data() {
    return {
      materials: [],
      loading: false,
      uploading: false,
      deleting: false,
      error: null,
      filterSubject: null,
      filterType: null,
      notification: {
        show: false,
        message: '',
        type: 'success'
      },
      newMaterial: {
        name: '',
        description: '',
        type: null,
        subject: null,
        file: null,
        fileName: '',
        fileSize: 0
      }
    }
  },
  computed: {
    // Опции для типов
    typeOptions() {
      return [
        { value: 'textbook', label: '📚 Учебник' },
        { value: 'taskbook', label: '📝 Задачник' }
      ]
    },
    
    // Опции для предметов
    subjectOptions() {
      return [
        { value: 'Химия ЕГЭ', label: 'Химия ЕГЭ' },
        { value: 'Химия ОГЭ', label: 'Химия ОГЭ' },
        { value: 'Биология ЕГЭ', label: 'Биология ЕГЭ' },
        { value: 'Биология ОГЭ', label: 'Биология ОГЭ' }
      ]
    },

    // Опции фильтра по предметам
    filterSubjectOptions() {
      const subjects = [...new Set(this.materials.map(m => m.subject))].filter(Boolean)
      return [
        { value: null, label: 'Все предметы' },
        ...subjects.map(s => ({ value: s, label: s }))
      ]
    },

    // Опции фильтра по типам
    filterTypeOptions() {
      return [
        { value: null, label: 'Все типы' },
        { value: 'textbook', label: '📚 Учебники' },
        { value: 'taskbook', label: '📝 Задачники' }
      ]
    },

    // Отфильтрованные материалы
    filteredMaterials() {
      return this.materials.filter(m => {
        if (this.filterSubject && m.subject !== this.filterSubject) return false
        if (this.filterType && m.type !== this.filterType) return false
        return true
      })
    },

    isFormValid() {
      return this.newMaterial.name.trim() &&
             this.newMaterial.type &&
             this.newMaterial.subject &&
             this.newMaterial.file
    }
  },
  mounted() {
    this.loadMaterials()
  },
  methods: {
    // === Загрузка материалов ===
    async loadMaterials() {
      this.loading = true
      this.error = null
      
      try {
        const { data, error } = await supabase
          .from('useful_material')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        
        this.materials = data || []
      } catch (err) {
        console.error('Ошибка загрузки материалов:', err)
        this.error = 'Не удалось загрузить материалы'
        this.showNotification('Ошибка загрузки материалов', 'error')
      } finally {
        this.loading = false
      }
    },

    // === Санитизация имени файла ===
    sanitizeFileName(fileName) {
      if (!fileName) return 'file'
      
      const lastDotIndex = fileName.lastIndexOf('.')
      const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : ''
      const nameWithoutExt = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName
      
      const cleanedName = nameWithoutExt
        .replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 100)
      
      const finalName = cleanedName || `file_${Date.now()}`
      
      return `${finalName}${extension}`
    },

    // === Работа с файлами ===
    handleFileSelect(event) {
      const file = event.target.files[0]
      if (!file) return

      if (file.size > 50 * 1024 * 1024) {
        this.showNotification('Файл слишком большой. Максимальный размер 50MB', 'error')
        this.resetFileInput()
        return
      }

      this.newMaterial.file = file
      this.newMaterial.fileName = file.name
      this.newMaterial.fileSize = file.size
    },

    resetFileInput() {
      this.newMaterial.file = null
      this.newMaterial.fileName = ''
      this.newMaterial.fileSize = 0
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = ''
      }
    },

    formatFileSize(bytes) {
      if (!bytes) return ''
      const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
      const i = Math.floor(Math.log(bytes) / Math.log(1024))
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
    },

    getFileName(link) {
      if (!link) return ''
      const parts = link.split('/')
      return parts[parts.length - 1] || 'material'
    },

    getTypeLabel(type) {
      return type === 'textbook' ? '📚 Учебник' : '📝 Задачник'
    },

    getMaterialUrl(link) {
      if (!link) return '#'
      
      if (link.startsWith('http')) {
        if (link.includes('supabase.co')) {
          const match = link.match(/\/storage\/v1\/object\/public\/useful_materials\/(.+)$/)
          if (match) {
            return `${PROXY_CONFIG.baseUrl}/useful_materials/${match[1]}`
          }
        }
        return link
      }
      
      if (PROXY_CONFIG.enabled) {
        return `${PROXY_CONFIG.baseUrl}/useful_materials/${link}`
      }
      
      try {
        const { data: { publicUrl } } = supabase
          .storage
          .from('useful_materials')
          .getPublicUrl(link)
        return publicUrl
      } catch (err) {
        console.error('Ошибка получения URL:', err)
        return '#'
      }
    },

    // === Загрузка материала ===
    async uploadMaterial() {
      if (!this.isFormValid) {
        this.showNotification('Заполните все обязательные поля', 'error')
        return
      }

      this.uploading = true
      
      try {
        const sanitizedFileName = this.sanitizeFileName(this.newMaterial.file.name)
        const timestamp = Date.now()
        
        const transliteratedName = sanitizedFileName
          .replace(/[а-яА-Я]/g, (match) => {
            const map = {
              'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
              'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
              'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
              'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
              'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
            }
            return map[match.toLowerCase()] || match
          })
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')

        const fileName = `${timestamp}_${transliteratedName || 'file'}`
        const filePath = `useful_materials/${fileName}`

        console.log('Загрузка файла:', filePath)

        const { error: uploadError } = await supabase.storage
          .from('useful_materials')
          .upload(filePath, this.newMaterial.file, {
            cacheControl: '3600',
            upsert: false,
            contentType: this.newMaterial.file.type || 'application/octet-stream'
          })

        if (uploadError) {
          console.error('Ошибка загрузки файла:', uploadError)
          throw uploadError
        }

        // Сохраняем запись в БД
        const { data, error: dbError } = await supabase
          .from('useful_material')
          .insert([
            {
              name: this.newMaterial.name.trim(),
              description: this.newMaterial.description.trim() || null,
              type: this.newMaterial.type,
              subject: this.newMaterial.subject,
              link: filePath
            }
          ])
          .select()

        if (dbError) {
          await supabase.storage
            .from('useful_materials')
            .remove([filePath])
          throw dbError
        }

        if (data && data.length > 0) {
          this.materials.unshift(data[0])
        }

        this.newMaterial.name = ''
        this.newMaterial.description = ''
        this.newMaterial.type = null
        this.newMaterial.subject = null
        this.resetFileInput()

        this.showNotification('Материал успешно загружен!', 'success')

      } catch (err) {
        console.error('Ошибка загрузки:', err)
        this.showNotification('Ошибка загрузки материала: ' + err.message, 'error')
      } finally {
        this.uploading = false
      }
    },

    // === Удаление материала ===
    async deleteMaterial(id) {
      if (!confirm('Вы уверены, что хотите удалить этот материал?')) return

      this.deleting = true
      
      try {
        const material = this.materials.find(m => m.id === id)
        if (!material) throw new Error('Материал не найден')

        const { error: deleteError } = await supabase.storage
          .from('useful_materials')
          .remove([material.link])

        if (deleteError) {
          console.warn('Ошибка удаления файла:', deleteError)
        }

        const { error: dbError } = await supabase
          .from('useful_material')
          .delete()
          .eq('id', id)

        if (dbError) throw dbError

        this.materials = this.materials.filter(m => m.id !== id)

        this.showNotification('Материал успешно удален', 'success')

      } catch (err) {
        console.error('Ошибка удаления:', err)
        this.showNotification('Ошибка удаления материала: ' + err.message, 'error')
      } finally {
        this.deleting = false
      }
    },

    // === Уведомления ===
    showNotification(message, type = 'success') {
      this.notification.message = message
      this.notification.type = type
      this.notification.show = true
      
      setTimeout(() => {
        this.notification.show = false
      }, 4000)
    },

    formatDate(dateString) {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }
}
</script>

<style scoped>
.upload-materials {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.header h2 {
  color: #5a2d7a;
  font-size: clamp(1.4rem, 3vw, 1.8rem);
  margin: 0;
}

.refresh-btn {
  padding: 8px 16px;
  background: #f0e6f7;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.3s ease;
  color: #5a2d7a;
}

.refresh-btn:hover:not(:disabled) {
  background: #e0d0f0;
  transform: translateY(-2px);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ===== ФОРМА ЗАГРУЗКИ ===== */
.upload-form {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(178, 65, 209, 0.08);
  border: 1px solid #f0e6f7;
  margin-bottom: 32px;
}

.upload-form h3 {
  color: #5a2d7a;
  font-size: 1.2rem;
  margin: 0 0 20px 0;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group:last-of-type {
  grid-column: 1 / -1;
}

.form-group label {
  font-weight: 500;
  color: #333;
  font-size: 0.95rem;
}

.form-input,
.form-textarea {
  padding: 10px 14px;
  border: 1.5px solid #e0d0e8;
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: Evolventa, sans-serif;
  transition: all 0.3s ease;
  width: 100%;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 3px rgba(178, 65, 209, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.file-upload-area {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.file-input {
  display: none;
}

.file-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #f5f0f8;
  border: 2px dashed #d8c4e8;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  flex: 1;
  min-width: 200px;
}

.file-label:hover {
  background: #ede5f5;
  border-color: #b241d1;
}

.file-icon {
  font-size: 1.2rem;
}

.file-size {
  color: #666;
  font-size: 0.85rem;
}

.submit-btn {
  grid-column: 1 / -1;
  padding: 12px 24px;
  background: linear-gradient(135deg, #b241d1 0%, #8a2be2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 4px;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(178, 65, 209, 0.3);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ===== СПИСОК МАТЕРИАЛОВ ===== */
.materials-list {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(178, 65, 209, 0.08);
  border: 1px solid #f0e6f7;
}

.materials-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.materials-header h3 {
  color: #5a2d7a;
  font-size: 1.2rem;
  margin: 0;
}

.filter-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-dropdown {
  min-width: 160px;
  max-width: 200px;
}

.materials-grid {
  display: grid;
  gap: 12px;
}

.material-item {
  background: #faf8fc;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #f0e6f7;
  transition: all 0.3s ease;
}

.material-item:hover {
  border-color: #b241d1;
  box-shadow: 0 2px 8px rgba(178, 65, 209, 0.06);
}

.material-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.material-type-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.material-type-badge.textbook {
  background: #e8f5e9;
  color: #2e7d32;
}

.material-type-badge.taskbook {
  background: #fff3e0;
  color: #ef6c00;
}

.material-subject-badge {
  padding: 4px 12px;
  background: #e3f2fd;
  color: #1565c0;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.3s ease;
  margin-left: auto;
}

.delete-btn:hover:not(:disabled) {
  background: #ffebee;
  transform: scale(1.1);
}

.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.material-item-content h4 {
  color: #333;
  font-size: 1rem;
  margin: 0 0 4px 0;
}

.material-item-content p {
  color: #666;
  font-size: 0.9rem;
  margin: 0 0 4px 0;
}

.file-name {
  color: #999;
  font-size: 0.85rem;
}

.material-item-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f0e6f7;
}

.download-link {
  color: #b241d1;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.download-link:hover {
  color: #8a2be2;
  text-decoration: underline;
}

.created-at {
  color: #999;
  font-size: 0.8rem;
}

/* ===== СОСТОЯНИЯ ===== */
.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f0e6f7;
  border-top: 4px solid #b241d1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state {
  background: #fef2f2;
  border-radius: 8px;
  border: 1px solid #fecaca;
}

.error-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 8px;
}

.error-state p {
  color: #dc2626;
  margin-bottom: 12px;
}

.retry-btn {
  padding: 6px 16px;
  background: #b241d1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.retry-btn:hover {
  background: #9a36b8;
}

.empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 8px;
}

/* ===== УВЕДОМЛЕНИЯ ===== */
.notification {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 500;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
  z-index: 1000;
  max-width: 400px;
}

.notification.success {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}

.notification.error {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ============================================ */
/* АДАПТИВНОСТЬ */
/* ============================================ */

@media (max-width: 1024px) {
  .upload-materials {
    padding: 16px;
  }
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .form-group:last-of-type {
    grid-column: 1;
  }
  
  .submit-btn {
    grid-column: 1;
  }
  
  .header {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
  
  .materials-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-controls {
    flex-direction: column;
  }
  
  .filter-dropdown {
    min-width: 100%;
    max-width: 100%;
  }
  
  .material-item-actions {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  
  .notification {
    left: 16px;
    right: 16px;
    bottom: 16px;
    max-width: none;
  }
}

@media (max-width: 480px) {
  .upload-materials {
    padding: 12px;
  }
  
  .upload-form,
  .materials-list {
    padding: 16px;
  }
  
  .file-label {
    min-width: unset;
    width: 100%;
  }
  
  .file-upload-area {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>