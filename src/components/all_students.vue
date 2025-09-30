<template>
  <div class="teacher-students-container">
    <!-- Компонент домашних работ -->
    <StudentHomework 
      v-if="selectedStudent"
      :student="selectedStudent"
      :subject="getSubjectKey(selectedSubject)"
      :exam-type="getExamType(selectedSubject)"
      @back="selectedStudent = null"
    />
    
    <div v-else>
      <div class="header">
        <h2>Ученики кураторов</h2>
        <div class="filters">
          <CustomDropdown
            v-model="selectedTutor"
            :options="tutorOptions"
            placeholder="Выберите куратора"
            searchable
            class="tutor-filter"
            @change="onTutorChange"
          />
          <CustomDropdown
            v-model="selectedSubject"
            :options="subjectOptions"
            placeholder="Выберите предмет"
            class="subject-filter"
            @change="onSubjectChange"
            :disabled="!selectedTutor"
          />
        </div>
      </div>
      
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        Загрузка данных...
      </div>
      
      <div v-if="error" class="error">
        Ошибка: {{ error }}
        <button @click="loadTutors" class="retry-btn">Повторить</button>
      </div>
      
      <div v-if="!selectedTutor && !loading" class="no-data">
        Пожалуйста, выберите куратора для просмотра его учеников
      </div>
      
      <div v-if="selectedTutor && !selectedSubject && !loading" class="no-data">
        Теперь выберите предмет для просмотра учеников
      </div>
      
      <div v-if="students.length === 0 && selectedTutor && selectedSubject && !loading" class="no-data">
        У куратора {{ selectedTutorName }} нет учеников по предмету {{ selectedSubject }}
      </div>
      
      <div v-if="students.length > 0" class="table-container">
        <div class="info-header">
          <h3>Ученики куратора: {{ selectedTutorName }}</h3>
          <div class="subject-info">Предмет: {{ selectedSubject }}</div>
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
  </div>
</template>

<script>
import { supabase } from '../supabase'
import CustomDropdown from './CustomDropdown.vue'
import StudentHomework from './StudentHomework.vue'

export default {
  name: 'TeacherStudents',
  components: {
    CustomDropdown,
    StudentHomework
  },
  data() {
    return {
      tutors: [],
      students: [],
      loading: false,
      error: null,
      selectedTutor: '',
      selectedSubject: '',
      selectedStudent: null,
      subjectOptions: [
        { value: 'Химия ЕГЭ', label: 'Химия ЕГЭ' },
        { value: 'Химия ОГЭ', label: 'Химия ОГЭ' },
        { value: 'Биология ЕГЭ', label: 'Биология ЕГЭ' },
        { value: 'Биология ОГЭ', label: 'Биология ОГЭ' }
      ]
    }
  },
  computed: {
    tutorOptions() {
      return this.tutors.map(tutor => ({
        value: tutor.user_id,
        label: `${tutor.first_name} ${tutor.last_name}`.trim()
      }))
    },
    selectedTutorName() {
      if (!this.selectedTutor) return ''
      const tutor = this.tutors.find(t => t.user_id === this.selectedTutor)
      return tutor ? `${tutor.first_name} ${tutor.last_name}`.trim() : ''
    }
  },
  async mounted() {
    await this.loadTutors()
  },
  methods: {
    async loadTutors() {
      this.loading = true
      this.error = null
      
      try {
        // Получаем всех кураторов (role = 'tutor')
        const { data: tutors, error: tutorsError } = await supabase
          .from('personalities')
          .select('user_id, first_name, last_name, email')
          .eq('role', 'tutor')
          .order('first_name')

        if (tutorsError) throw tutorsError

        this.tutors = tutors || []
        
      } catch (error) {
        console.error('Ошибка загрузки кураторов:', error)
        this.error = 'Не удалось загрузить список кураторов'
      } finally {
        this.loading = false
      }
    },

    async onTutorChange() {
      this.selectedSubject = ''
      this.students = []
      
      if (!this.selectedTutor) return
      
      // Загружаем учеников выбранного куратора
      await this.loadStudents()
    },

    async onSubjectChange() {
      if (!this.selectedSubject) {
        this.students = []
        return
      }
      
      await this.loadStudents()
    },

    async loadStudents() {
      if (!this.selectedTutor || !this.selectedSubject) return

      this.loading = true
      
      try {
        const tutor = this.tutors.find(t => t.user_id === this.selectedTutor)
        if (!tutor) return

        // Ищем студентов этого куратора - ТОЛЬКО по first_name и first_name + пробел
        const tutorFirstName = tutor.first_name.trim()
        
        // Создаем условия для поиска
        const searchPatterns = [
          `${tutorFirstName}`,      // Только имя
          `${tutorFirstName} `      // Имя + пробел
        ]

        // Ищем студентов по всем шаблонам
        let allStudents = []
        
        for (const pattern of searchPatterns) {
          const { data: studentsData, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .ilike('tutor', `%${pattern}%`)
          
          if (studentsError) throw studentsError
          
          if (studentsData && studentsData.length > 0) {
            allStudents = [...allStudents, ...studentsData]
          }
        }

        // Удаляем дубликаты
        const uniqueStudents = allStudents.filter((student, index, self) =>
          index === self.findIndex(s => s.user_id === student.user_id)
        )

        if (uniqueStudents.length === 0) {
          this.students = []
          return
        }

        // Фильтруем студентов по предмету и получаем детали
        const studentsWithDetails = await Promise.all(
          uniqueStudents
            .filter(student => 
              student.subject1 === this.selectedSubject || 
              student.subject2 === this.selectedSubject
            )
            .map(async (student) => {
              try {
                const { data: personality, error: personalityError } = await supabase
                  .from('personalities')
                  .select('first_name, last_name, email, phone')
                  .eq('user_id', student.user_id)
                  .single()
                
                if (personalityError) {
                  console.error(`Ошибка загрузки данных пользователя ${student.user_id}:`, personalityError)
                  return null
                }
                
                // Получаем баллы из таблицы рейтинга (обновлено для ОГЭ)
                const subjectKey = this.getSubjectKey(this.selectedSubject)
                const examType = this.getExamType(this.selectedSubject)
                const ratingTable = `${subjectKey}_${examType}_rating`
                
                const { data: ratingData } = await supabase
                  .from(ratingTable)
                  .select('total_score')
                  .eq('user_id', student.user_id)
                  .single()
                
                return {
                  user_id: student.user_id,
                  first_name: personality?.first_name || '',
                  last_name: personality?.last_name || '',
                  email: personality?.email || '',
                  phone: personality?.phone || '',
                  score: ratingData?.total_score || 0,
                }
              } catch (error) {
                console.error(`Ошибка обработки студента ${student.user_id}:`, error)
                return null
              }
            })
        )

        this.students = studentsWithDetails.filter(
          student => student !== null && (student.first_name || student.last_name)
        )

      } catch (error) {
        console.error('Ошибка загрузки студентов:', error)
        this.error = 'Не удалось загрузить данные учеников'
      } finally {
        this.loading = false
      }
    },

    getSubjectKey(subjectName) {
      if (subjectName.includes('Химия')) return 'chemistry'
      if (subjectName.includes('Биология')) return 'biology'
      return ''
    },

    getExamType(subjectName) {
      if (subjectName.includes('ЕГЭ')) return 'ege'
      if (subjectName.includes('ОГЭ')) return 'oge'
      return ''
    },

    selectStudent(student) {
      this.selectedStudent = student
    }
  }
}
</script>

<style scoped>
/* Стили остаются без изменений */
.teacher-students-container {
  padding: clamp(1rem, 2vw, 1.25rem);
  max-width: 85rem;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(1rem, 2vw, 1.25rem);
  flex-wrap: wrap;
  gap: 0.9375rem;
  background: linear-gradient(135deg, #f8f5fc 0%, #f0eaf9 100%);
  padding: 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid #e8daf2;
}

.header h2 {
  margin: 0;
  color: #5a2d7a;
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  font-weight: 600;
}

.filters {
  display: flex;
  gap: 0.9375rem;
  flex-wrap: wrap;
}

.tutor-filter,
.subject-filter {
  min-width: min(250px, 100%);
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(1rem, 2vw, 1.25rem);
  padding: 1.25rem;
  background: linear-gradient(135deg, #f9f3fc 0%, #f0e6f7 100%);
  border-radius: 0.75rem;
  border: 1px solid #e8d4f2;
  flex-wrap: wrap;
  gap: 0.9375rem;
}

.info-header h3 {
  margin: 0;
  color: #7e3f9d;
  font-weight: 600;
  font-size: clamp(1.125rem, 2.5vw, 1.375rem);
}

.subject-info {
  font-weight: 500;
  color: #9a30b8;
  background-color: white;
  padding: 0.5rem 1rem;
  border-radius: 1.25rem;
  font-size: clamp(0.875rem, 2vw, 1rem);
}

.stats {
  font-weight: 600;
  color: #b241d1;
  background-color: white;
  padding: 0.5rem 1rem;
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
  min-width: 700px;
}

.students-table th {
  background: linear-gradient(135deg, #7e3f9d 0%, #6a2d8a 100%);
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
  transition: background-color 0.3s ease;
  background-color: white;
  cursor: pointer;
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
  text-align: center;
}

.loading, .error, .no-data {
  text-align: center;
  padding: clamp(2rem, 8vw, 3.75rem);
  margin: clamp(1rem, 2vw, 1.25rem) 0;
  border-radius: 0.75rem;
}

.loading {
  color: #b241d1;
  background: linear-gradient(135deg, #f9f3fc 0%, #f0e6f7 100%);
}

.error {
  background-color: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.no-data {
  color: #b241d1;
  background: linear-gradient(135deg, #f9f3fc 0%, #f0e6f7 100%);
  border: 2px dashed #d8b4e7;
}

.spinner {
  width: clamp(2rem, 8vw, 2.5rem);
  height: clamp(2rem, 8vw, 2.5rem);
  border: 0.25rem solid #f0e6f7;
  border-top: 0.25rem solid #b241d1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
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
  margin-top: 0.5rem;
}

.retry-btn:hover {
  background-color: #9a30b8;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Адаптивность */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    text-align: center;
  }
  
  .filters {
    justify-content: center;
  }
  
  .info-header {
    flex-direction: column;
    text-align: center;
  }
  
  .students-table {
    min-width: 600px;
  }
}

@media (max-width: 480px) {
  .filters {
    flex-direction: column;
  }
  
  .tutor-filter,
  .subject-filter {
    width: 100%;
  }
}
</style>