<template>
  <div class="students-container">
    <!-- Кнопка назад, когда открыты домашние работы -->
    <div v-if="selectedStudent" class="back-header">
      <button @click="selectedStudent = null" class="back-btn">
        ← Назад к списку учеников
      </button>
    </div>

    <div v-else>
      <div class="header">
        <h2>Мои ученики</h2>
        <div class="filters">
          <CustomDropdown
            v-model="selectedSubject"
            :options="subjectOptions"
            placeholder="Выберите предмет"
            class="subject-filter"
            @change="onSubjectChange"
          />
        </div>
      </div>
      
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        Загрузка данных...
      </div>
      
      <div v-if="error" class="error">
        Ошибка: {{ error }}
        <button @click="loadAllStudents" class="retry-btn">Повторить</button>
      </div>
      
      <div v-if="!selectedSubject && !loading" class="no-data">
        Пожалуйста, выберите предмет для просмотра учеников
      </div>
      
      <div v-if="students.length === 0 && selectedSubject && !loading" class="no-data">
        У вас нет учеников по предмету {{ selectedSubject }}
      </div>
      
      <div v-if="students.length > 0" class="table-container">
        <div class="subject-header">
          <h3>Ученики по предмету: {{ selectedSubject }}</h3>
          <div class="stats">Всего учеников: {{ students.length }}</div>
        </div>
        
        <table class="students-table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Фамилия</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>Баллы</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="student in students" 
              :key="student.user_id"
              @click="selectStudent(student)"
              class="student-row"
            >
              <td>{{ student.first_name || 'Не указано' }}</td>
              <td>{{ student.last_name || 'Не указано' }}</td>
              <td>{{ student.email || 'Не указан' }}</td>
              <td>{{ student.phone || 'Не указан' }}</td>
              <td class="score-cell">{{ student.score || 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Компонент домашних работ -->
    <StudentHomework 
      v-if="selectedStudent"
      :student="selectedStudent"
      :subject="getSubjectKey(selectedSubject)"
      :exam-type="getExamType(selectedSubject)"
      @back="selectedStudent = null"
    />
  </div>
</template>

<script>
import { supabase } from '../supabase'
import CustomDropdown from './CustomDropdown.vue'
import StudentHomework from './StudentHomework.vue'

export default {
  name: 'TutorStudents',
  components: {
    CustomDropdown,
    StudentHomework
  },
  data() {
    return {
      students: [],
      loading: false,
      error: null,
      tutorFirstName: '',
      selectedSubject: '',
      selectedStudent: null,
      subjectOptions: [
        { value: 'Химия ЕГЭ', label: 'Химия ЕГЭ' },
        { value: 'Химия ОГЭ', label: 'Химия ОГЭ' },
        { value: 'Биология ЕГЭ', label: 'Биология ЕГЭ' },
        { value: 'Биология ОГЭ', label: 'Биология ОГЭ' }
      ],
      allStudents: [] // Кэшируем всех студентов для фильтрации
    }
  },
  async mounted() {
    await this.initializeTutorData();
  },
  methods: {
    async initializeTutorData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        
        if (!user?.id) {
          this.error = 'Пользователь не аутентифицирован'
          return
        }

        const { data: personality, error: personalityError } = await supabase
          .from('personalities')
          .select('first_name')
          .eq('user_id', user.id)
          .single();

        if (personalityError) throw personalityError;

        this.tutorFirstName = personality.first_name?.trim();

        if (!this.tutorFirstName) {
          this.error = 'Не удалось получить имя куратора'
          return
        }

        // Загружаем всех студентов сразу
        await this.loadAllStudents();

      } catch (error) {
        console.error('Ошибка загрузки данных куратора:', error)
        this.error = 'Ошибка загрузки данных'
      }
    },

    // Загружаем всех студентов куратора один раз
    async loadAllStudents() {
      if (!this.tutorFirstName) return;

      this.loading = true;
      this.error = null;
      
      try {
        // Получаем всех студентов куратора
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('tutor', this.tutorFirstName);

        if (studentsError) throw studentsError;

        if (!students || students.length === 0) {
          this.allStudents = [];
          return;
        }

        // Получаем детальную информацию о каждом студенте
        const studentsWithDetails = await Promise.all(
          students.map(async (student) => {
            try {
              // Получаем данные из таблицы personalities
              const { data: personality, error: personalityError } = await supabase
                .from('personalities')
                .select('first_name, last_name, email, phone')
                .eq('user_id', student.user_id)
                .single();
              
              if (personalityError) {
                console.error(`Ошибка загрузки данных пользователя ${student.user_id}:`, personalityError);
                return null;
              }
              
              return {
                user_id: student.user_id,
                first_name: personality?.first_name || '',
                last_name: personality?.last_name || '',
                email: personality?.email || '',
                phone: personality?.phone || '',
                subject1: student.subject1 || '',
                subject2: student.subject2 || ''
              };
            } catch (error) {
              console.error(`Ошибка обработки студента ${student.user_id}:`, error);
              return null;
            }
          })
        );

        // Фильтруем null значения и студентов без имени
        this.allStudents = studentsWithDetails.filter(
          student => student !== null && (student.first_name || student.last_name)
        );

      } catch (error) {
        console.error('Ошибка загрузки студентов:', error);
        this.error = 'Не удалось загрузить список учеников';
      } finally {
        this.loading = false;
      }
    },

    // Фильтруем студентов по выбранному предмету и загружаем баллы
    async onSubjectChange() {
      if (!this.selectedSubject) {
        this.students = [];
        return;
      }

      this.loading = true;
      
      try {
        // Фильтруем студентов из кэша
        const filteredStudents = this.allStudents.filter(student => 
          student.subject1 === this.selectedSubject || student.subject2 === this.selectedSubject
        );

        // Получаем баллы для каждого студента из соответствующей таблицы рейтинга
        const studentsWithScores = await Promise.all(
          filteredStudents.map(async (student) => {
            try {
              const subjectKey = this.getSubjectKey(this.selectedSubject);
              const ratingTable = `${subjectKey}_rating`;
              
              // Получаем баллы из таблицы рейтинга
              const { data: ratingData, error: ratingError } = await supabase
                .from(ratingTable)
                .select('total_score')
                .eq('user_id', student.user_id)
                .single();
              
              if (ratingError && ratingError.code !== 'PGRST116') { // PGRST116 - нет данных
                console.error(`Ошибка загрузки рейтинга для пользователя ${student.user_id}:`, ratingError);
              }
              
              return {
                ...student,
                score: ratingData?.total_score || 0
              };
            } catch (error) {
              console.error(`Ошибка загрузки баллов для студента ${student.user_id}:`, error);
              return {
                ...student,
                score: 0
              };
            }
          })
        );

        this.students = studentsWithScores;

      } catch (error) {
        console.error('Ошибка фильтрации студентов:', error);
        this.error = 'Не удалось загрузить данные учеников';
      } finally {
        this.loading = false;
      }
    },

    // Получаем ключ предмета (biology/chemistry) для API
    getSubjectKey(subjectName) {
      if (subjectName.includes('Химия')) return 'chemistry';
      if (subjectName.includes('Биология')) return 'biology';
      return '';
    },

    // Получаем тип экзамена (ЕГЭ/ОГЭ) для API
    getExamType(subjectName) {
      if (subjectName.includes('ЕГЭ')) return 'ЕГЭ';
      if (subjectName.includes('ОГЭ')) return 'ОГЭ';
      return '';
    },

    selectStudent(student) {
      this.selectedStudent = student;
    }
  }
}
</script>

<style scoped>
.students-container {
  padding: clamp(1rem, 2vw, 1.25rem);
  max-width: 75rem;
  margin: 0 auto;
}

.back-header {
  margin-bottom: clamp(1rem, 2vw, 1.25rem);
}

.back-btn {
  background-color: #b241d1;
  color: white;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.3s ease;
}

.back-btn:hover {
  background-color: #9a30b8;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(1rem, 2vw, 1.25rem);
  flex-wrap: wrap;
  gap: 0.9375rem;
}

.header h2 {
  margin: 0;
  color: #333;
  font-size: clamp(1.25rem, 3vw, 1.5rem);
}

.filters {
  display: flex;
  gap: 0.9375rem;
  flex-wrap: wrap;
}

.subject-filter {
  min-width: min(200px, 100%);
}

.subject-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(1rem, 2vw, 1.25rem);
  padding: 0.9375rem;
  background: linear-gradient(135deg, #f9f3fc 0%, #f0e6f7 100%);
  border-radius: 0.75rem;
  border: 1px solid #e8d4f2;
}

.subject-header h3 {
  margin: 0;
  color: #7e3f9d;
  font-weight: 600;
  font-size: clamp(1.125rem, 2.5vw, 1.25rem);
}

.stats {
  font-weight: 500;
  color: #b241d1;
  background-color: white;
  padding: 0.3125rem 0.75rem;
  border-radius: 1.25rem;
  font-size: clamp(0.875rem, 2vw, 1rem);
}

.table-container {
  overflow-x: auto;
  border-radius: 0.75rem;
  box-shadow: 0 0.25rem 0.9375rem rgba(178, 65, 209, 0.1);
  margin-top: clamp(1rem, 2vw, 1.25rem);
}

.students-table {
  width: 100%;
  border-collapse: collapse;
  background-color: white;
  border-radius: 0.75rem;
  overflow: hidden;
  min-width: 600px;
}

.students-table th {
  background: linear-gradient(135deg, #b241d1 0%, #9a30b8 100%);
  padding: clamp(0.75rem, 2vw, 1rem) clamp(1rem, 3vw, 1.25rem);
  text-align: left;
  font-weight: 600;
  color: white;
  border: none;
  font-size: clamp(0.875rem, 2vw, 1rem);
}

.students-table td {
  padding: clamp(0.75rem, 2vw, 0.875rem) clamp(1rem, 3vw, 1.25rem);
  border-bottom: 1px solid #f0e6f7;
  color: #333;
  font-size: clamp(0.875rem, 2vw, 1rem);
}

.student-row {
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: white;
}

.student-row:hover {
  background-color: #f9f3fc;
  transform: translateY(-1px);
}

.student-row:last-child td {
  border-bottom: none;
}

.score-cell {
  font-weight: 600;
  color: #b241d1;
}

.loading {
  text-align: center;
  padding: clamp(1.5rem, 5vw, 2.5rem);
  color: #b241d1;
  font-size: clamp(1rem, 3vw, 1.125rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9375rem;
}

.spinner {
  width: clamp(2rem, 8vw, 2.5rem);
  height: clamp(2rem, 8vw, 2.5rem);
  border: 0.25rem solid #f0e6f7;
  border-top: 0.25rem solid #b241d1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  background-color: #fef2f2;
  color: #dc2626;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #fecaca;
  margin: clamp(1rem, 2vw, 1.25rem) 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.625rem;
}

.retry-btn {
  background-color: #b241d1;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.3s ease;
  white-space: nowrap;
  font-size: clamp(0.875rem, 2vw, 1rem);
}

.retry-btn:hover {
  background-color: #9a30b8;
}

.no-data {
  text-align: center;
  padding: clamp(2rem, 8vw, 3.75rem) clamp(1rem, 4vw, 1.25rem);
  color: #b241d1;
  font-size: clamp(1rem, 3vw, 1.125rem);
  background: linear-gradient(135deg, #f9f3fc 0%, #f0e6f7 100%);
  border-radius: 0.75rem;
  border: 2px dashed #d8b4e7;
  margin-top: clamp(1rem, 2vw, 1.25rem);
}

/* Медиа-запросы для различных разрешений */
@media (max-width: 1200px) {
  .students-container {
    padding: 1rem;
  }
}

@media (max-width: 992px) {
  .header {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
  
  .filters {
    justify-content: center;
  }
  
  .subject-header {
    flex-direction: column;
    gap: 0.625rem;
    text-align: center;
  }
}

@media (max-width: 768px) {
  .students-table {
    min-width: 500px;
    font-size: 0.875rem;
  }
  
  .students-table th,
  .students-table td {
    padding: 0.75rem 0.875rem;
  }
  
  .error {
    flex-direction: column;
    text-align: center;
    padding: 0.875rem;
  }
  
  .filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .subject-filter {
    width: 100%;
  }
}

@media (max-width: 576px) {
  .students-table {
    min-width: 400px;
    font-size: 0.8125rem;
  }
  
  .students-table th,
  .students-table td {
    padding: 0.625rem 0.75rem;
  }
  
  .back-btn {
    width: 100%;
    padding: 0.75rem;
  }
  
  .header h2 {
    text-align: center;
  }
  
  .subject-header h3 {
    font-size: 1rem;
  }
  
  .stats {
    font-size: 0.875rem;
  }
}

@media (max-width: 480px) {
  .students-table {
    min-width: 350px;
  }
  
  .students-table th,
  .students-table td {
    padding: 0.5rem 0.625rem;
  }
  
  .loading {
    padding: 1.5rem 1rem;
  }
  
  .no-data {
    padding: 2rem 1rem;
  }
}

/* Для очень маленьких экранов */
@media (max-width: 360px) {
  .students-table {
    min-width: 320px;
    font-size: 0.75rem;
  }
  
  .header {
    gap: 0.5rem;
  }
  
  .filters {
    gap: 0.5rem;
  }
}
</style> 