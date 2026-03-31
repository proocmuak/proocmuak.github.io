<template>
  <div class="additional-courses-editor">
    <!-- Если выбран курс для редактирования, показываем TableEditor -->
    <TableEditor
      v-if="selectedCourse"
      :table-title="selectedCourse.name"
      :table-name="selectedCourse.english_name"
      primary-key="number"
      :fields="courseFields"
      @back-to-edit="closeCourseEditor"
    />
    
    <!-- Иначе показываем список курсов -->
    <template v-else>
      <div class="editor-header">
        <button class="back-button" @click="$emit('back-to-edit')">
          ← Назад к предметам
        </button>
        <h2>Управление дополнительными курсами</h2>
        <button class="create-button" @click="openCreateModal">
          + Создать курс
        </button>
      </div>

      <!-- Список существующих курсов -->
      <div class="courses-list">
        <div v-if="loading" class="loading">Загрузка...</div>
        <div v-else-if="courses.length === 0" class="empty-state">
          Нет созданных курсов. Нажмите "Создать курс", чтобы добавить новый.
        </div>
        <div v-else class="courses-grid">
          <div 
            v-for="course in courses" 
            :key="course.id" 
            class="course-card"
            @click="openCourseEditor(course)"
          >
            <div class="course-info">
              <h3>{{ course.name }}</h3>
              <p><strong>Предмет:</strong> {{ course.subject }}</p>
              <p><strong>Английское название:</strong> {{ course.english_name }}</p>
            </div>
            <div class="course-actions" @click.stop>
              <button class="edit-btn" @click="editCourse(course)">
                ✏️ Редактировать
              </button>
              <button class="delete-btn" @click="deleteCourse(course.id)">
                🗑️ Удалить
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Модальное окно создания курса -->
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Создание нового курса</h3>
            <button class="close-btn" @click="closeModal">×</button>
          </div>
          
          <form @submit.prevent="createCourse" class="course-form">
            <div class="form-group">
              <label for="course-name">Название курса *</label>
              <input
                id="course-name"
                v-model="newCourse.name"
                type="text"
                required
                placeholder="Введите название курса"
              />
            </div>

            <div class="form-group">
              <label for="english-name">Название курса на английском *</label>
              <input
                id="english-name"
                v-model="newCourse.english_name"
                type="text"
                required
                placeholder="Введите название на английском (латиница)"
                pattern="[A-Za-z_]+"
                title="Только латинские буквы и знак подчеркивания"
              />
              <small class="hint">Будет использовано как имя таблицы: {{ newCourse.english_name || 'table_name' }}</small>
            </div>

            <div class="form-group">
              <label for="subject">Предмет *</label>
              <select id="subject" v-model="newCourse.subject" required>
                <option value="">Выберите предмет</option>
                <option value="Химия ЕГЭ">Химия ЕГЭ</option>
                <option value="Биология ЕГЭ">Биология ЕГЭ</option>
                <option value="Химия ОГЭ">Химия ОГЭ</option>
                <option value="Биология ОГЭ">Биология ОГЭ</option>
              </select>
            </div>

            <div class="modal-footer">
              <button type="button" class="cancel-btn" @click="closeModal">
                Отмена
              </button>
              <button type="submit" class="submit-btn" :disabled="loading">
                {{ loading ? 'Создание...' : 'Создать курс' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Модальное окно редактирования курса -->
      <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Редактирование курса</h3>
            <button class="close-btn" @click="closeEditModal">×</button>
          </div>
          
          <form @submit.prevent="updateCourse" class="course-form">
            <div class="form-group">
              <label for="edit-course-name">Название курса *</label>
              <input
                id="edit-course-name"
                v-model="editingCourse.name"
                type="text"
                required
                placeholder="Введите название курса"
              />
            </div>

            <div class="form-group">
              <label for="edit-english-name">Название курса на английском</label>
              <input
                id="edit-english-name"
                v-model="editingCourse.english_name"
                type="text"
                disabled
              />
              <small class="hint">Английское название нельзя изменить (используется как имя таблицы)</small>
            </div>

            <div class="form-group">
              <label for="edit-subject">Предмет *</label>
              <select id="edit-subject" v-model="editingCourse.subject" required>
                <option value="Химия ЕГЭ">Химия ЕГЭ</option>
                <option value="Биология ЕГЭ">Биология ЕГЭ</option>
                <option value="Химия ОГЭ">Химия ОГЭ</option>
                <option value="Биология ОГЭ">Биология ОГЭ</option>
              </select>
            </div>

            <div class="modal-footer">
              <button type="button" class="cancel-btn" @click="closeEditModal">
                Отмена
              </button>
              <button type="submit" class="submit-btn" :disabled="loading">
                Сохранить
              </button>
            </div>
          </form>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase.js'
import TableEditor from './TableEditor.vue'

const emit = defineEmits(['back-to-edit'])

// Состояния
const courses = ref([])
const loading = ref(false)
const showModal = ref(false)
const showEditModal = ref(false)
const selectedCourse = ref(null)

const newCourse = ref({
  name: '',
  english_name: '',
  subject: ''
})

const editingCourse = ref({
  id: null,
  name: '',
  english_name: '',
  subject: ''
})

// Поля для TableEditor (аналогичны основным предметам)
const courseFields = [
  { name: 'number', label: 'Номер', type: 'number', disabled: true },
  { name: 'title', label: 'Название', type: 'text' },
  { name: 'date', label: 'Дата', type: 'date' },
  { name: 'video', label: 'Видео', type: 'text' },
  { name: 'content', label: 'Содержание', type: 'textarea' },
  { name: 'homework', label: 'Домашнее задание', type: 'textarea' },
  { name: 'workbook', label: 'Рабочая тетрадь', type: 'textarea' },
  { name: 'practice', label: 'Практика', type: 'textarea' }
]

// Открыть редактор курса
const openCourseEditor = (course) => {
  selectedCourse.value = course
}

// Закрыть редактор курса
const closeCourseEditor = () => {
  selectedCourse.value = null
}

// Загрузка списка курсов
const loadCourses = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('additional_course')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    courses.value = data || []
  } catch (error) {
    console.error('Ошибка загрузки курсов:', error)
    alert('Ошибка загрузки курсов: ' + error.message)
  } finally {
    loading.value = false
  }
}

// Создание таблицы для курса
const createCourseTable = async (tableName) => {
  const { error } = await supabase.rpc('create_course_table', {
    table_name: tableName
  })
  
  if (error) {
    console.error('Ошибка создания таблицы:', error)
    throw new Error('Не удалось создать таблицу для курса')
  }
}

// Создание нового курса
const createCourse = async () => {
  // Валидация английского названия
  const englishNameRegex = /^[A-Za-z_]+$/
  if (!englishNameRegex.test(newCourse.value.english_name)) {
    alert('Английское название должно содержать только латинские буквы и знак подчеркивания')
    return
  }

  loading.value = true
  try {
    // Проверяем, существует ли уже такой english_name
    const { data: existing } = await supabase
      .from('additional_course')
      .select('id')
      .eq('english_name', newCourse.value.english_name)
      .single()

    if (existing) {
      alert('Курс с таким английским названием уже существует!')
      return
    }

    // Вставляем запись в additional_course
    const { data, error } = await supabase
      .from('additional_course')
      .insert([
        {
          name: newCourse.value.name,
          english_name: newCourse.value.english_name,
          subject: newCourse.value.subject
        }
      ])
      .select()
      .single()

    if (error) throw error

    // Создаем новую таблицу для курса
    await createCourseTable(newCourse.value.english_name)

    // Обновляем список курсов
    await loadCourses()
    
    // Закрываем модальное окно и сбрасываем форму
    closeModal()
    
    alert('Курс успешно создан!')
  } catch (error) {
    console.error('Ошибка создания курса:', error)
    alert('Ошибка создания курса: ' + error.message)
  } finally {
    loading.value = false
  }
}

// Редактирование курса
const editCourse = (course) => {
  editingCourse.value = { ...course }
  showEditModal.value = true
}

const updateCourse = async () => {
  loading.value = true
  try {
    const { error } = await supabase
      .from('additional_course')
      .update({
        name: editingCourse.value.name,
        subject: editingCourse.value.subject
      })
      .eq('id', editingCourse.value.id)

    if (error) throw error

    await loadCourses()
    closeEditModal()
    alert('Курс успешно обновлен!')
  } catch (error) {
    console.error('Ошибка обновления курса:', error)
    alert('Ошибка обновления курса: ' + error.message)
  } finally {
    loading.value = false
  }
}

// Удаление курса
const deleteCourse = async (id) => {
  if (!confirm('Вы уверены, что хотите удалить этот курс? Это также удалит все данные курса.')) {
    return
  }

  loading.value = true
  try {
    // Получаем english_name курса перед удалением
    const courseToDelete = courses.value.find(c => c.id === id)
    if (!courseToDelete) throw new Error('Курс не найден')

    // Удаляем таблицу курса
    const { error: dropError } = await supabase.rpc('drop_course_table', {
      table_name: courseToDelete.english_name
    })
    
    if (dropError) {
      console.error('Ошибка удаления таблицы:', dropError)
      // Продолжаем удаление, даже если таблицу не удалось удалить
    }

    // Удаляем запись из additional_course
    const { error } = await supabase
      .from('additional_course')
      .delete()
      .eq('id', id)

    if (error) throw error

    await loadCourses()
    alert('Курс успешно удален')
  } catch (error) {
    console.error('Ошибка удаления курса:', error)
    alert('Ошибка удаления курса: ' + error.message)
  } finally {
    loading.value = false
  }
}

// Управление модальными окнами
const openCreateModal = () => {
  newCourse.value = { name: '', english_name: '', subject: '' }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  newCourse.value = { name: '', english_name: '', subject: '' }
}

const closeEditModal = () => {
  showEditModal.value = false
  editingCourse.value = { id: null, name: '', english_name: '', subject: '' }
}

// Загрузка при монтировании
onMounted(() => {
  loadCourses()
})
</script>

<style scoped>
.additional-courses-editor {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 15px;
}

.back-button {
  padding: 8px 16px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.back-button:hover {
  background-color: #5a6268;
}

.create-button {
  padding: 10px 20px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
}

.create-button:hover {
  background-color: #218838;
}

.courses-list {
  margin-top: 20px;
}

.loading {
  text-align: center;
  padding: 40px;
  font-size: 18px;
  color: #666;
}

.empty-state {
  text-align: center;
  padding: 60px;
  background-color: #f8f9fa;
  border-radius: 8px;
  color: #6c757d;
  font-size: 16px;
}

.courses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.course-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.course-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  border-color: #4CAF50;
}

.course-info h3 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 18px;
}

.course-info p {
  margin: 8px 0;
  color: #666;
  font-size: 14px;
}

.course-actions {
  margin-top: 15px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.edit-btn, .delete-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.edit-btn {
  background-color: #ffc107;
  color: #333;
}

.edit-btn:hover {
  background-color: #e0a800;
  transform: scale(1.05);
}

.delete-btn {
  background-color: #dc3545;
  color: white;
}

.delete-btn:hover {
  background-color: #c82333;
  transform: scale(1.05);
}

/* Модальное окно */
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
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #999;
}

.close-btn:hover {
  color: #333;
}

.course-form {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #007bff;
}

.form-group input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.hint {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  color: #999;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.cancel-btn {
  padding: 8px 16px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.submit-btn {
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Адаптивность */
@media (max-width: 768px) {
  .editor-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .courses-grid {
    grid-template-columns: 1fr;
  }
  
  .modal-content {
    width: 95%;
    margin: 10px;
  }
  
  .course-card {
    cursor: pointer;
  }
}
</style>