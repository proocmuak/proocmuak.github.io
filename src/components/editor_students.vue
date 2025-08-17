<template>
  <div class="admin-students-panel">
    <h1>Управление студентами</h1>
    
    <!-- Поиск и элементы управления -->
    <div class="controls">
      <input
        v-model="searchQuery"
        placeholder="Поиск по email или имени"
        @input="resetPagination"
      >
      <div class="pagination-controls">
        <button @click="prevPage" :disabled="currentPage === 1">← Назад</button>
        <span>Страница {{ currentPage }} из {{ totalPages }}</span>
        <button @click="nextPage" :disabled="currentPage === totalPages">Вперед →</button>
      </div>
    </div>

    <!-- Таблица студентов -->
    <table class="students-table">
      <thead>
        <tr>
          <th>Email</th>
          <th>Имя</th>
          <th>Фамилия</th>
          <th>Предмет 1</th>
          <th>Предмет 2</th>
          <th>Преподаватель</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="student in students" :key="student.user_id">
          <td>{{ student.email }}</td>
          <td>{{ student.first_name }}</td>
          <td>{{ student.last_name }}</td>
          <td>
            <input
              v-model="student.subject1"
              @blur="updateStudent(student)"
            >
          </td>
          <td>
            <input
              v-model="student.subject2"
              @blur="updateStudent(student)"
            >
          </td>
          <td>
            <input
              v-model="student.tutor"
              @blur="updateStudent(student)"
              placeholder="Введите преподавателя"
            >
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Сообщение при отсутствии данных -->
    <div v-if="students.length === 0" class="no-data">
      Студенты не найдены
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { supabase } from '../supabase';

const students = ref([]);
const searchQuery = ref('');
const currentPage = ref(1);
const perPage = 10;
const totalCount = ref(0);

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
      `email.ilike.%${searchQuery.value}%,first_name.ilike.%${searchQuery.value}%,last_name.ilike.%${searchQuery.value}%,tutor.ilike.%${searchQuery.value}%`
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

  students.value = data || [];
  totalCount.value = count || 0;
};

// Обновление данных студента
const updateStudent = async (student) => {
  const { error } = await supabase
    .from('students')
    .update({ 
      subject1: student.subject1 || null,
      subject2: student.subject2 || null,
      tutor: student.tutor || null
    })
    .eq('user_id', student.user_id);

  if (error) {
    console.error('Ошибка обновления:', error);
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

// Сброс пагинации при поиске
const resetPagination = () => {
  currentPage.value = 1;
  fetchStudents();
};

// Загружаем студентов при загрузке страницы
onMounted(fetchStudents);
</script>

<style scoped>
.admin-students-panel {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 20px;
}

.controls input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.pagination-controls button {
  padding: 6px 12px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.pagination-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.students-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

.students-table th, .students-table td {
  border: 1px solid #ddd;
  padding: 10px;
  text-align: left;
}

.students-table th {
  background-color: #f2f2f2;
  position: sticky;
  top: 0;
}

.students-table tr:nth-child(even) {
  background-color: #f9f9f9;
}

.students-table tr:hover {
  background-color: #f1f1f1;
}

.students-table input {
  padding: 6px;
  width: 90%;
  border: 1px solid #ccc;
  border-radius: 3px;
}

.no-data {
  text-align: center;
  padding: 20px;
  color: #666;
}
</style>