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
              <th class="subject-column">Предмет 2</th>
              <th class="tariff-column">Тариф</th>
              <th class="date-column">Оплата до</th>
              <th class="tutor-column">Наставник</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in students" :key="student.user_id">
              <td class="name-column">{{ student.first_name }}</td>
              <td class="name-column">{{ student.last_name }}</td>
              
              <!-- Предмет 1 -->
              <td class="subject-column">
                <CustomDropdown
                  v-model="student.subject1"
                  :options="ChemistryOption"
                  placeholder="Предмет"
                  @change="updateStudent(student)"
                />
              </td>
              <td class="tariff-column">
                <CustomDropdown
                  v-model="student.subject1_tariff"
                  :options="tariffOptions"
                  placeholder="Тариф"
                  @change="updateStudent(student)"
                />
              </td>
              <td class="date-column">
                <input
                  type="date"
                  v-model="student.subject1_payment_date"
                  @change="updateStudent(student)"
                  class="date-input"
                />
              </td>
              
              <!-- Предмет 2 -->
              <td class="subject-column">
                <CustomDropdown
                  v-model="student.subject2"
                  :options="BiologyOption"
                  placeholder="Предмет"
                  @change="updateStudent(student)"
                />
              </td>
              <td class="tariff-column">
                <CustomDropdown
                  v-model="student.subject2_tariff"
                  :options="tariffOptions"
                  placeholder="Тариф"
                  @change="updateStudent(student)"
                />
              </td>
              <td class="date-column">
                <input
                  type="date"
                  v-model="student.subject2_payment_date"
                  @change="updateStudent(student)"
                  class="date-input"
                />
              </td>
              
              <!-- Наставник -->
              <td class="tutor-column">
                <CustomDropdown
                  v-model="student.tutor"
                  :options="tutorOptionsWithNone"
                  placeholder="Наставник"
                  searchable
                  @change="updateStudent(student)"
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

// Опции для тарифов
const tariffOptions = [
  { value: null, label: 'Нет' },
  { value: 'самостоятельный', label: 'Самостоятельный' },
  { value: 'базовый', label: 'Базовый' },
  { value: 'основной', label: 'Основной' }
];

// Опции для предметов
const ChemistryOption = [
  { value: null, label: 'Нет' },
  { value: 'Химия ЕГЭ', label: 'Химия ЕГЭ' },
  { value: 'Химия ОГЭ', label: 'Химия ОГЭ' },
];
const BiologyOption = [
  { value: null, label: 'Нет'  }, 
  { value: 'Биология ЕГЭ', label: 'Биология ЕГЭ' },
  { value: 'Биология ОГЭ', label: 'Биология ОГЭ' }
]
// Загрузка наставников
const fetchTutors = async () => {
  const { data, error } = await supabase
    .from('personalities')
    .select('first_name, last_name')
    .eq('role', 'tutor');

  if (error) {
    console.error('Ошибка загрузки наставников:', error);
    return;
  }

  tutors.value = data.map(tutor => ({
    value: tutor.first_name,
    label: `${tutor.first_name}`
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
    .select('*', { count: 'exact' });

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
    subject2_payment_date: student.subject2_payment_date ? formatDateForInput(student.subject2_payment_date) : ''
  }));
  
  totalCount.value = count || 0;
};

// Форматирование даты для input type="date"
const formatDateForInput = (dateString) => {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

// Обновление данных студента
const updateStudent = async (student) => {
  // Подготавливаем данные для сохранения
  const updateData = {
    subject1: student.subject1,
    subject2: student.subject2,
    subject1_tariff: student.subject1_tariff,
    subject2_tariff: student.subject2_tariff,
    subject1_payment_date: student.subject1_payment_date || null,
    subject2_payment_date: student.subject2_payment_date || null,
    tutor: student.tutor
  };

  const { error } = await supabase
    .from('students')
    .update(updateData)
    .eq('user_id', student.user_id);

  if (error) {
    console.error('Ошибка обновления:', error);
    alert('Не удалось сохранить изменения!');
  } else {
    console.log('Данные студента обновлены:', student);
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

// Сброс пагинации при поиске
const resetPagination = () => {
  currentPage.value = 1;
  fetchStudents();
};

// Загружаем данные при загрузке страницы
onMounted(async () => {
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
  width: 81.25rem; /* 1300px */
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #b241d1 0%, #8a2be2 100%);
  color: white;
}

.modal-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 1.75rem;
  cursor: pointer;
  padding: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
  z-index: 1001; /* Добавляем z-index для кнопки */
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.9375rem 1.5rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.search-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  width: 17.5rem;
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
}

.students-table th, 
.students-table td {
  border: 1px solid #e0e0e0;
  padding: 0.5rem;
  text-align: left;
  font-size: 0.8125rem;
  vertical-align: top;
  height: 3.125rem;
  box-sizing: border-box;
}

.students-table th {
  background: #f8f9fa;
  color: #333;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 10;
}

.students-table tr:nth-child(even) {
  background-color: #fafafa;
}

.students-table tr:hover {
  background-color: #f0f0f0;
}

/* Ширины колонок */
.name-column {
  width: 6.25rem;
  min-width: 6.25rem;
}

.subject-column {
  width: 7.5rem;
  min-width: 7.5rem;
}

.tariff-column {
  width: 6.875rem;
  min-width: 6.875rem;
}

.date-column {
  width: 7.5rem;
  min-width: 7.5rem;
}

.tutor-column {
  width: 8.75rem;
  min-width: 8.75rem;
}

.date-input {
  padding: 0.375rem;
  border: 1px solid #ddd;
  border-radius: 0.25rem;
  width: 100%;
  font-size: 0.8125rem;
  box-sizing: border-box;
  height: 2rem;
}

.date-input:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 0.125rem rgba(178, 65, 209, 0.2);
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

/* Стили для скроллбара */
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
@media (max-width: 87.5rem) { /* 1400px */
  .admin-students-modal {
    width: 95vw;
  }
  
  .name-column { width: 5.625rem; min-width: 5.625rem; }
  .subject-column { width: 6.875rem; min-width: 6.875rem; }
  .tariff-column { width: 6.25rem; min-width: 6.25rem; }
  .date-column { width: 6.875rem; min-width: 6.875rem; }
  .tutor-column { width: 8.125rem; min-width: 8.125rem; }
}

@media (max-width: 48rem) { /* 768px */
  .modal-header {
    padding: 1rem;
  }
  
  .modal-header h1 {
    font-size: 1.25rem;
  }
  
  .controls {
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }
  
  .search-input {
    width: 100%;
  }
  
  .table-container {
    padding: 0 0.5rem 0.5rem 0.5rem;
  }
  
  .students-table th, 
  .students-table td {
    padding: 0.375rem;
    font-size: 0.75rem;
  }
}
</style>