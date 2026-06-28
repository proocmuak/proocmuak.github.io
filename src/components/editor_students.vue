<template>
  <div class="admin-students-modal-overlay" @click.self="$emit('close')">
    <div class="admin-students-modal">
      <div class="modal-header">
        <h1>Управление студентами</h1>
        <button class="close-button" @click="$emit('close')">×</button>
      </div>
      
      <!-- Поиск и элементы управления -->
      <div class="controls">
        <input
          v-model="searchQuery"
          placeholder="Поиск по имени, фамилии или наставнику"
          @input="resetPagination"
          class="search-input"
        >
        <div class="pagination-controls">
          <button @click="prevPage" :disabled="currentPage === 1">← Назад</button>
          <span>Страница {{ currentPage }} из {{ totalPages }}</span>
          <button @click="nextPage" :disabled="currentPage === totalPages">Вперед →</button>
        </div>
      </div>

      <!-- Обертка для таблицы -->
      <div class="table-container">
        <!-- Таблица студентов -->
        <table class="students-table">
          <thead>
            <tr>
              <th class="name-column">Имя</th>
              <th class="name-column">Фамилия</th>
              <th class="subject-column">Предмет 1</th>
              <th class="tariff-column">Тариф</th>
              <th class="date-column">Оплата до</th>
              <th class="date-column">Доступ с</th>
              <th class="subject-column">Предмет 2</th>
              <th class="tariff-column">Тариф</th>
              <th class="date-column">Оплата до</th>
              <th class="date-column">Доступ с</th>
              <th class="additional-courses-column">Дополнительные курсы</th>
              <th class="tutor-column">Наставник</th>
              <th class="access-column">Доступ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in students" :key="student.user_id">
              <td class="name-column">{{ student.first_name || '' }}</td>
              <td class="name-column">{{ student.last_name || '' }}</td>
              
              <!-- Предмет 1 -->
              <td class="subject-column">
                <CustomDropdown
                  :modelValue="student.subject1"
                  :options="ChemistryOption"
                  placeholder="Предмет"
                  @update:modelValue="(value) => handleSubjectChange(student, 'subject1', value)"
                />
              </td>
              <td class="tariff-column">
                <CustomDropdown
                  :modelValue="student.subject1_tariff"
                  :options="tariffOptions"
                  placeholder="Тариф"
                  :disabled="!student.subject1"
                  @update:modelValue="(value) => handleTariffChange(student, 'subject1_tariff', value)"
                />
              </td>
              <td class="date-column">
                <input
                  type="date"
                  :value="student.subject1_payment_date"
                  :disabled="!student.subject1"
                  @change="(e) => handleDateChange(student, 'subject1_payment_date', e.target.value)"
                  class="date-input"
                />
              </td>
              <td class="date-column">
                <input
                  type="date"
                  :value="student.subject1_access_from"
                  :disabled="!student.subject1"
                  @change="(e) => handleAccessFromChange(student, 'subject1_access_from', e.target.value)"
                  class="date-input"
                />
              </td>
              
              <!-- Предмет 2 -->
              <td class="subject-column">
                <CustomDropdown
                  :modelValue="student.subject2"
                  :options="BiologyOption"
                  placeholder="Предмет"
                  @update:modelValue="(value) => handleSubjectChange(student, 'subject2', value)"
                />
              </td>
              <td class="tariff-column">
                <CustomDropdown
                  :modelValue="student.subject2_tariff"
                  :options="tariffOptions"
                  placeholder="Тариф"
                  :disabled="!student.subject2"
                  @update:modelValue="(value) => handleTariffChange(student, 'subject2_tariff', value)"
                />
              </td>
              <td class="date-column">
                <input
                  type="date"
                  :value="student.subject2_payment_date"
                  :disabled="!student.subject2"
                  @change="(e) => handleDateChange(student, 'subject2_payment_date', e.target.value)"
                  class="date-input"
                />
              </td>
              <td class="date-column">
                <input
                  type="date"
                  :value="student.subject2_access_from"
                  :disabled="!student.subject2"
                  @change="(e) => handleAccessFromChange(student, 'subject2_access_from', e.target.value)"
                  class="date-input"
                />
              </td>
              
              <!-- Дополнительные курсы -->
              <td class="additional-courses-column">
                <div class="additional-courses-list">
                  <div 
                    v-for="course in additionalCourses" 
                    :key="course.id" 
                    class="course-checkbox"
                  >
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        :checked="isCourseSelected(student, course)"
                        @change="(e) => handleAdditionalCourseChange(student, course, e.target.checked)"
                        class="course-checkbox-input"
                      />
                      <span class="checkbox-text">{{ course.name }}</span>
                    </label>
                  </div>
                  <div v-if="additionalCourses.length === 0" class="no-courses">
                    Нет доступных курсов
                  </div>
                </div>
              </td>
              
              <!-- Наставник -->
              <td class="tutor-column">
                <CustomDropdown
                  :modelValue="student.tutor"
                  :options="tutorOptionsWithNone"
                  placeholder="Наставник"
                  searchable
                  @update:modelValue="(value) => handleTutorChange(student, value)"
                />
              </td>

              <!-- Доступ - преобразуем boolean в строку для совместимости -->
              <td class="access-column">
                <CustomDropdown
                  :modelValue="String(student.access)"
                  :options="accessOptions"
                  placeholder="Доступ"
                  @update:modelValue="(value) => handleAccessChange(student, value)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Сообщение при отсутствии данных -->
      <div v-if="students.length === 0" class="no-data">
        Студенты не найдены
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { supabase } from '../supabase';
import CustomDropdown from './CustomDropdown.vue';

defineEmits(['close']);

const students = ref([]);
const searchQuery = ref('');
const currentPage = ref(1);
const perPage = 10;
const totalCount = ref(0);
const tutors = ref([]);
const additionalCourses = ref([]);

// Опции для тарифов
const tariffOptions = [
  { value: null, label: 'Нет' },
  { value: 'самостоятельный', label: 'Самостоятельный' },
  { value: 'базовый', label: 'Базовый' },
  { value: 'основной', label: 'Основной' }
];

// Опции для доступа - используем строки вместо boolean
const accessOptions = [
  { value: 'true', label: 'Разрешен' },
  { value: 'false', label: 'Запрещен' }
];

// Опции для предметов
const ChemistryOption = [
  { value: null, label: 'Нет' },
  { value: 'Химия ЕГЭ', label: 'Химия ЕГЭ' },
  { value: 'Химия ОГЭ', label: 'Химия ОГЭ' },
];

const BiologyOption = [
  { value: null, label: 'Нет' },
  { value: 'Биология ЕГЭ', label: 'Биология ЕГЭ' },
  { value: 'Биология ОГЭ', label: 'Биология ОГЭ' }
];

// Проверка, выбран ли курс для студента
const isCourseSelected = (student, course) => {
  if (!student.additional_courses) return false;
  const courses = Array.isArray(student.additional_courses) 
    ? student.additional_courses 
    : JSON.parse(student.additional_courses || '[]');
  return courses.includes(course.name);
};

// Загрузка дополнительных курсов
const fetchAdditionalCourses = async () => {
  const { data, error } = await supabase
    .from('additional_course')
    .select('id, name, english_name')
    .order('name');

  if (error) {
    console.error('Ошибка загрузки дополнительных курсов:', error);
    return;
  }

  additionalCourses.value = data || [];
};

// Загрузка наставников
const fetchTutors = async () => {
  const { data, error } = await supabase
    .from('personalities')
    .select('first_name, last_name')
    .eq('role', 'tutor')
    .order('first_name');

  if (error) {
    console.error('Ошибка загрузки наставников:', error);
    return;
  }

  tutors.value = data.map(tutor => ({
    value: tutor.first_name,
    label: `${tutor.first_name} ${tutor.last_name || ''}`.trim() || tutor.first_name
  }));
};

// Опции для наставников с вариантом "Нет"
const tutorOptionsWithNone = computed(() => [
  { value: null, label: 'Нет' },
  ...tutors.value
]);

// Вычисляемое свойство для общего количества страниц
const totalPages = computed(() => {
  return Math.ceil(totalCount.value / perPage);
});

// Загрузка студентов с пагинацией
const fetchStudents = async () => {
 let query = supabase
  .from('students')
  .select('*', { count: 'exact' })
  .eq('is_active', true)  // ← Добавить

  // Применяем поиск, если есть запрос
  if (searchQuery.value) {
    query = query.or(
      `first_name.ilike.%${searchQuery.value}%,last_name.ilike.%${searchQuery.value}%,tutor.ilike.%${searchQuery.value}%`
    );
  }

  // Добавляем пагинацию
  const from = (currentPage.value - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  
  if (error) {
    console.error('Ошибка загрузки студентов:', error);
    return;
  }

  // Форматируем даты для input type="date"
  students.value = (data || []).map(student => ({
    ...student,
    subject1_payment_date: student.subject1_payment_date ? formatDateForInput(student.subject1_payment_date) : '',
    subject2_payment_date: student.subject2_payment_date ? formatDateForInput(student.subject2_payment_date) : '',
    subject1_access_from: student.subject1_access_from ? formatDateForInput(student.subject1_access_from) : '',
    subject2_access_from: student.subject2_access_from ? formatDateForInput(student.subject2_access_from) : '',
    access: student.access !== undefined ? Boolean(student.access) : true,
    additional_courses: student.additional_courses ? 
      (Array.isArray(student.additional_courses) ? student.additional_courses : JSON.parse(student.additional_courses)) : []
  }));
  
  totalCount.value = count || 0;
};

// Форматирование даты для input type="date"
const formatDateForInput = (dateString) => {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

// Обработчик изменения дополнительного курса
const handleAdditionalCourseChange = async (student, course, isChecked) => {
  try {
    // Получаем текущий массив курсов
    let currentCourses = Array.isArray(student.additional_courses) 
      ? [...student.additional_courses]
      : (student.additional_courses ? JSON.parse(student.additional_courses) : []);
    
    if (isChecked) {
      // Добавляем курс, если его еще нет
      if (!currentCourses.includes(course.name)) {
        currentCourses.push(course.name);
      }
    } else {
      // Удаляем курс
      currentCourses = currentCourses.filter(name => name !== course.name);
    }
    
    // Обновляем локальное состояние
    student.additional_courses = currentCourses;
    
    // Обновляем в базе данных
    const { error } = await supabase
      .from('students')
      .update({ additional_courses: JSON.stringify(currentCourses) })
      .eq('user_id', student.user_id);
    
    if (error) {
      console.error('Ошибка обновления дополнительных курсов:', error);
      alert('Не удалось сохранить изменения!');
      await fetchStudents();
    }
  } catch (error) {
    console.error('Неожиданная ошибка:', error);
    alert('Не удалось сохранить изменения!');
  }
};

// Обработчики изменений
const handleSubjectChange = (student, subjectField, value) => {
  student[subjectField] = value;
  
  if (value === null) {
    if (subjectField === 'subject1') {
      student.subject1_tariff = null;
      student.subject1_payment_date = '';
      student.subject1_access_from = '';
    } else if (subjectField === 'subject2') {
      student.subject2_tariff = null;
      student.subject2_payment_date = '';
      student.subject2_access_from = '';
    }
  }
  
  updateStudent(student);
};

const handleTariffChange = (student, tariffField, value) => {
  student[tariffField] = value;
  updateStudent(student);
};

const handleDateChange = (student, dateField, value) => {
  student[dateField] = value;
  updateStudent(student);
};

const handleTutorChange = (student, value) => {
  student.tutor = value;
  updateStudent(student);
};

const handleAccessChange = (student, value) => {
  // Преобразуем строку обратно в boolean для хранения
  student.access = value === 'true';
  updateStudent(student);
};

const handleAccessFromChange = (student, accessField, value) => {
  student[accessField] = value;
  updateStudent(student);
};

// Обновление данных студента
const updateStudent = async (student) => {
  const updateData = {
    subject1: student.subject1,
    subject2: student.subject2,
    subject1_tariff: student.subject1 ? student.subject1_tariff : null,
    subject2_tariff: student.subject2 ? student.subject2_tariff : null,
    subject1_payment_date: student.subject1 && student.subject1_payment_date ? student.subject1_payment_date : null,
    subject2_payment_date: student.subject2 && student.subject2_payment_date ? student.subject2_payment_date : null,
    subject1_access_from: student.subject1 && student.subject1_access_from ? student.subject1_access_from : null,
    subject2_access_from: student.subject2 && student.subject2_access_from ? student.subject2_access_from : null,
    tutor: student.tutor,
    access: student.access,
    additional_courses: JSON.stringify(student.additional_courses || [])
  };

  try {
    const { error } = await supabase
      .from('students')
      .update(updateData)
      .eq('user_id', student.user_id);

    if (error) {
      console.error('Ошибка обновления:', error);
      alert('Не удалось сохранить изменения! Ошибка: ' + error.message);
    }
  } catch (error) {
    console.error('Неожиданная ошибка:', error);
    alert('Не удалось сохранить изменения!');
  }
};

// Навигация по страницам
const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    fetchStudents();
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    fetchStudents();
  }
};

const resetPagination = () => {
  currentPage.value = 1;
  fetchStudents();
};

onMounted(async () => {
  await fetchAdditionalCourses();
  await fetchTutors();
  await fetchStudents();
});
</script>

<style scoped>
.admin-students-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1.25rem;
}

.admin-students-modal {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 0.625rem 2.5rem rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  max-width: 95vw;
  max-height: 95vh;
  width: 110rem;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #b241d1 0%, #8a2be2 100%);
  color: white;
  flex-shrink: 0;
}

.modal-header h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.search-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  width: 17.5rem;
  min-width: 200px;
}

.search-input:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.1);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.pagination-controls button {
  padding: 0.375rem 0.75rem;
  background: #b241d1;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.8125rem;
}

.pagination-controls button:hover:not(:disabled) {
  background: #9a36b6;
}

.pagination-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #ccc;
}

.table-container {
  flex: 1;
  overflow: auto;
  padding: 0 1.25rem 1.25rem 1.25rem;
}

.students-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.8125rem;
}

.students-table th, 
.students-table td {
  border: 1px solid #e0e0e0;
  padding: 0.5rem 0.4rem;
  text-align: left;
  vertical-align: middle;
  box-sizing: border-box;
}

.students-table th {
  background: #f8f9fa;
  color: #333;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 10;
  font-size: 0.75rem;
  white-space: nowrap;
}

.students-table tr:nth-child(even) {
  background-color: #fafafa;
}

.students-table tr:hover {
  background-color: #f0f0f0;
}

/* Ширины колонок */
.name-column {
  width: 5rem;
  min-width: 5rem;
  max-width: 5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subject-column {
  width: 6.5rem;
  min-width: 6.5rem;
  max-width: 6.5rem;
}

.tariff-column {
  width: 6rem;
  min-width: 6rem;
  max-width: 6rem;
}

.date-column {
  width: 6.5rem;
  min-width: 6.5rem;
  max-width: 6.5rem;
}

.additional-courses-column {
  width: 10rem;
  min-width: 10rem;
  max-width: 10rem;
}

.tutor-column {
  width: 7.5rem;
  min-width: 7.5rem;
  max-width: 7.5rem;
}

.access-column {
  width: 6rem;
  min-width: 6rem;
  max-width: 6rem;
}

.date-input {
  padding: 0.25rem 0.375rem;
  border: 1px solid #ddd;
  border-radius: 0.25rem;
  width: 100%;
  font-size: 0.75rem;
  box-sizing: border-box;
  height: 1.75rem;
  background: white;
}

.date-input:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.1);
}

.date-input:disabled {
  background-color: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.additional-courses-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.course-checkbox {
  margin: 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  font-size: 0.75rem;
  color: #333;
}

.checkbox-label:hover {
  color: #b241d1;
}

.course-checkbox-input {
  cursor: pointer;
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
}

.checkbox-text {
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-courses {
  color: #999;
  font-size: 0.75rem;
  font-style: italic;
  text-align: center;
  padding: 0.5rem;
}

.no-data {
  text-align: center;
  padding: 2.5rem 1.25rem;
  color: #666;
  font-size: 1rem;
  background: #f8f9fa;
  border-radius: 0.5rem;
  margin: 1.25rem;
}

/* Кастомный скроллбар */
.table-container::-webkit-scrollbar {
  width: 0.375rem;
  height: 0.375rem;
}

.table-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 0.1875rem;
}

.table-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 0.1875rem;
}

.table-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Адаптивность */
@media (max-width: 1200px) {
  .admin-students-modal {
    width: 98vw;
  }
  
  .name-column { width: 4.5rem; min-width: 4.5rem; max-width: 4.5rem; }
  .subject-column { width: 6rem; min-width: 6rem; max-width: 6rem; }
  .tariff-column { width: 5.5rem; min-width: 5.5rem; max-width: 5.5rem; }
  .date-column { width: 6rem; min-width: 6rem; max-width: 6rem; }
  .additional-courses-column { width: 8rem; min-width: 8rem; max-width: 8rem; }
  .tutor-column { width: 7rem; min-width: 7rem; max-width: 7rem; }
  .access-column { width: 5.5rem; min-width: 5.5rem; max-width: 5.5rem; }
}

@media (max-width: 768px) {
  .admin-students-modal-overlay {
    padding: 0.5rem;
  }
  
  .admin-students-modal {
    width: 100vw;
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
  }
  
  .modal-header {
    padding: 0.75rem 1rem;
  }
  
  .modal-header h1 {
    font-size: 1rem;
  }
  
  .controls {
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
  }
  
  .search-input {
    width: 100%;
    min-width: unset;
  }
  
  .pagination-controls {
    width: 100%;
    justify-content: center;
  }
  
  .table-container {
    padding: 0 0.5rem 0.5rem 0.5rem;
  }
  
  .students-table th, 
  .students-table td {
    padding: 0.3rem 0.25rem;
    font-size: 0.7rem;
  }
  
  .students-table th {
    font-size: 0.65rem;
  }
  
  .date-input {
    font-size: 0.65rem;
    padding: 0.15rem 0.25rem;
    height: 1.5rem;
  }
  
  .checkbox-label {
    font-size: 0.65rem;
  }
  
  .course-checkbox-input {
    width: 0.75rem;
    height: 0.75rem;
  }
}
</style>