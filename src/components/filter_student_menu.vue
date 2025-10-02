<template>
  <div class="filter-menu">
    <div class="filter-grid">
      <!-- Выбор предмета -->
      <div class="filter-item">
        <h3 class="filter-label">Предмет</h3>
        <CustomDropdown
          v-if="!loadingSubjects && userSubjects.length > 0"
          :options="userSubjects"
          placeholder="Выберите предмет"
          v-model="selectedSubject"
          @change="handleSubjectChange"
        />
        <div v-else-if="loadingSubjects" class="loading-subjects">Загрузка предметов...</div>
        <div v-else class="no-subjects-message">
          {{ subjectsError || 'Нет доступных предметов' }}
        </div>
      </div>

      <!-- Выбор раздела -->
      <div class="filter-item" v-if="selectedSubject">
        <h3 class="filter-label">Раздел</h3>
        <CustomDropdown
          :options="availableSections"
          placeholder="Выберите разделы"
          v-model="selectedSections"
          @change="handleSectionChange"
          :searchable="true"
          :multiple="true"
        />
      </div>

      <!-- Выбор темы -->
      <div class="filter-item" v-if="selectedSubject">
        <h3 class="filter-label">Тема</h3>
        <CustomDropdown
          :options="filteredTopics"
          placeholder="Выберите темы"
          v-model="selectedTopics"
          :searchable="true"
          :multiple="true"
        />
      </div>

      <!-- Выбор части -->
      <div class="filter-item" v-if="selectedSubject">
        <h3 class="filter-label">Часть</h3>
        <CustomDropdown
          :options="parts"
          placeholder="Выберите часть"
          v-model="selectedPart"
        />
      </div>

      <div class="filter-item" v-if="selectedSubject">
        <h3 class="filter-label">Номер задания</h3>
        <CustomDropdown
          :options="filteredTaskNumbers.map(String)"
          placeholder="Выберите номер"
          v-model="selectedTaskNumber"
          :multiple="true"
        />
      </div>

      <!-- Сортировка по сложности -->
      <div class="filter-item" v-if="selectedSubject">
        <h3 class="filter-label">Сортировка по сложности</h3>
        <CustomDropdown
          :options="difficultyOptions"
          placeholder="Выберите сложность"
          v-model="selectedDifficulty"
        />
      </div>

      <!-- Кнопка сброса -->
      <div class="filter-reset">
        <button 
          @click="resetAllFilters"
          class="reset-button"
          :disabled="!hasActiveFilters"
          :class="{ 'active': hasActiveFilters }"
        >
          <span class="reset-icon">×</span> Сбросить
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { chem_ege_sections } from '../assets/arrays/list_of_sections.js';
import CustomDropdown from './CustomDropdown.vue';
import { supabase } from '../supabase';

const chemTopicsModules = import.meta.glob('../assets/arrays/topics/chem_ege/*.js', { eager: true });
const bioTopicsModules = import.meta.glob('../assets/arrays/topics/biology_ege/*.js', { eager: true });
const chemOgeTopicsModules = import.meta.glob('../assets/arrays/topics/chem_oge/*.js', { eager: true });
const bioOgeTopicsModules = import.meta.glob('../assets/arrays/topics/biology_oge/*.js', { eager: true });

const processModules = (modules) => {
  const result = {};
  for (const path in modules) {
    const fileName = path.split('/').pop().replace('.js', '').replace(/_/g, ' ');
    result[fileName] = modules[path].default;
  }
  return result;
};

export default {
  name: 'StudentFilterMenu',
  components: {
    CustomDropdown
  },
  data() {
    return {
      userSubjects: [],
      loadingSubjects: true,
      subjectsError: null,
      selectedSubject: null,
      selectedSections: [],
      selectedTopics: [],
      selectedPart: null,
      selectedTaskNumber: null,
      availableSections: [],
      allTopics: [],
      difficultyOptions: [
        { value: null, label: 'Все сложности' },
        { value: 'asc', label: 'Сначала простые' },
        { value: 'desc', label: 'Сначала сложные' }
      ],
      selectedDifficulty: null,
      topicsData: {
        'Химия ЕГЭ': {},
        'Биология ЕГЭ': {},
        'Химия ОГЭ': {},
        'Биология ОГЭ': {}
      },
      parts: ['Первая часть', 'Вторая часть'],
      sectionMappings: {
        'Химия ЕГЭ': {
          'Общая химия': 'general chemistry',
          'Органическая химия': 'organic chemistry',
          'Неорганическая химия': 'inorganic chemistry',
          'Задачи': 'task chemistry'
        },
        'Биология ЕГЭ': {
          'Цитология': 'citology',
          'Биохимия': 'biochemistry',
          'Метаболизм клетки': 'cell metabolism',
          'Задачи на биосинтез белка': 'task for protein biosynthesis',
          'Клеточный цикл': 'cell cycle',
          'Размножение и развитие': 'reproduction and development',
          'Разнообразие организмов': 'diversity of organisms',
          'Биология как наука': 'biology as a science',
          'Генетика': 'genetics',
          'Задачи на закон Харди-Вайнберга': 'problems with the Hardy-Weinberg law',
          'Селекция и биотехнология': 'breeding and biotechnology',
          'Анатомия и физиология': 'human anatomy',
          'Ботаника': 'botany',
          'Зоология': 'zoology',
          'Эволюция': 'evolution',
          'Экология': 'ecology',
          'Анализ информации': 'information analysis',
          'Методология эксперимента': 'experimental methodology'
        },
        'Химия ОГЭ': {
          'Основные понятия. Строение атома и периодический закон': 'Basic Concepts. Atomic Structure and the Periodic Law',
          'Химическая связь и свойства элементов': 'Chemical Bond and Properties of Elements',
          'Неорганическая химия': 'Inorganic Chemistry',
          'Химические реакции': 'Chemical Reactions',
          'Электролитическая диссоциация': 'Electrolytic Dissociation',
          'Расчёты в химии': 'Calculations in Chemistry',
          'Практические и экспериментальные задания': 'Practical and Experimental Tasks'
        },
        'Биология ОГЭ': {
          'Биология – наука о живой природе. Методы научного познания': 'Biology - The Science of Living Nature. Methods of Scientific Knowledge',
          'Среда обитания. Природные и искусственные сообщества. Человек и окружающая среда': 'Habitat. Natural and Artificial Communities',
          'Эволюционное развитие растений, животных и человека': 'Evolutionary Development of Plants, Animals, and Humans',
          'Организмы бактерий, грибов и лишайников': 'Organisms of Bacteria, Fungi, and Lichens',
          'Растительный организм. Систематические группы растений': 'The Plant Organism. Systematic Groups of Plants',
          'Животный организм. Систематические группы животных': 'The Animal Organism. Systematic Groups of Animals',
          'Человек и его здоровье': 'Humans and Their Health'
        }
      }
    };
  },
  computed: {
    hasActiveFilters() {
      return this.selectedSubject || 
             this.selectedSections.length || 
             this.selectedTopics.length || 
             this.selectedPart || 
             this.selectedTaskNumber;
    },
    filteredTopics() {
      if (this.selectedSections.length === 0) {
        return this.allTopics;
      }

      const topics = this.selectedSections.flatMap(section => {
        const sectionKey = this.sectionMappings[this.selectedSubject]?.[section];
        return sectionKey ? this.topicsData[this.selectedSubject][sectionKey] || [] : [];
      });

      return [...new Set(topics)];
    },
    filteredTaskNumbers() {
      if (!this.selectedSubject) return [];
      
      const config = {
        'Химия ЕГЭ': { 
          maxTasks: 34, 
          firstPart: Array.from({length: 28}, (_, i) => i + 1),
          secondPart: Array.from({length: 6}, (_, i) => i + 29)
        },
        'Биология ЕГЭ': { 
          maxTasks: 28,
          firstPart: Array.from({length: 21}, (_, i) => i + 1),
          secondPart: Array.from({length: 7}, (_, i) => i + 22)
        },
        'Химия ОГЭ': { 
          maxTasks: 23,
          firstPart: Array.from({length: 19}, (_, i) => i + 1),
          secondPart: Array.from({length: 4}, (_, i) => i + 20)
        },
        'Биология ОГЭ': { 
          maxTasks: 26,
          firstPart: Array.from({length: 21}, (_, i) => i + 1),
          secondPart: Array.from({length: 5}, (_, i) => i + 22)
        }
      };
      
      const subjectConfig = config[this.selectedSubject];
      if (!subjectConfig) return [];
      
      if (!this.selectedPart) {
        return Array.from({length: subjectConfig.maxTasks}, (_, i) => i + 1);
      }
      
      const isFirstPart = this.selectedPart === 'Первая часть';
      return isFirstPart ? subjectConfig.firstPart : subjectConfig.secondPart;
    }
  },
  watch: {
    selectedTopics() {
      this.emitFiltersChanged();
    },
    selectedPart() {
      this.emitFiltersChanged();
    },
    selectedTaskNumber() {
      this.emitFiltersChanged();
    },
    selectedPart() {
      this.selectedTaskNumber = null;
      this.emitFiltersChanged();
    },
    selectedDifficulty(newVal) {
      this.emitFiltersChanged();
    },
  },
  async created() {
    await this.fetchUserSubjects();
    this.initializeTopicsData();
  },
  methods: {
    async fetchUserSubjects() {
      try {
        this.loadingSubjects = true;
        this.subjectsError = null;
        
        // 1. Получаем текущего пользователя
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          throw new Error('Пользователь не авторизован');
        }

        // 2. Получаем роль пользователя из таблицы personalities
        const { data: personalityData, error: personalityError } = await supabase
          .from('personalities')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (personalityError) {
          console.error('Ошибка при получении роли:', personalityError);
          // Продолжаем как для ученика, если не удалось получить роль
          await this.fetchStudentSubjects(user.id);
          return;
        }

        // 3. В зависимости от роли показываем соответствующие предметы
        if (personalityData && (personalityData.role === 'tutor' || personalityData.role === 'teacher')) {
          // Для tutor и teacher показываем все предметы
          this.userSubjects = [
            { value: 'Химия ЕГЭ', label: 'Химия ЕГЭ' },
            { value: 'Биология ЕГЭ', label: 'Биология ЕГЭ' },
            { value: 'Химия ОГЭ', label: 'Химия ОГЭ' },
            { value: 'Биология ОГЭ', label: 'Биология ОГЭ' }
          ];
                   } else {
          // Для student и других ролей показываем только назначенные предметы
          await this.fetchStudentSubjects(user.id);
        }

      } catch (err) {
        console.error('Ошибка загрузки предметов пользователя:', err);
        this.subjectsError = 'Не удалось загрузить предметы. Попробуйте позже.';
        this.userSubjects = [];
      } finally {
        this.loadingSubjects = false;
      }
    },

    async fetchStudentSubjects(userId) {
      try {
        // Запрашиваем предметы пользователя из таблицы students
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('subject1, subject2')
          .eq('user_id', userId)
          .maybeSingle();

        if (studentError) {
          console.error('Ошибка при получении предметов ученика:', studentError);
          if (studentError.code === 'PGRST116') {
            this.subjectsError = 'Данные ученика не найдены. Обратитесь к администратору.';
          } else {
            this.subjectsError = 'Ошибка при загрузке предметов.';
          }
          this.userSubjects = [];
          return;
        }

        // Формируем массив предметов для dropdown
        this.userSubjects = [];
        
        if (studentData) {
          if (studentData.subject1) {
            this.userSubjects.push({ 
              value: studentData.subject1, 
              label: studentData.subject1 
            });
          }
          if (studentData.subject2) {
            this.userSubjects.push({ 
              value: studentData.subject2, 
              label: studentData.subject2 
            });
          }
        }

        // Если предметов нет, показываем сообщение
        if (this.userSubjects.length === 0) {
          this.subjectsError = 'У вас нет назначенных предметов. Обратитесь к администратору.';
        }

      } catch (err) {
        console.error('Ошибка в fetchStudentSubjects:', err);
        throw err;
      }
    },

    initializeTopicsData() {
      this.topicsData['Химия ЕГЭ'] = processModules(chemTopicsModules);
      this.topicsData['Биология ЕГЭ'] = processModules(bioTopicsModules);
      this.topicsData['Химия ОГЭ'] = processModules(chemOgeTopicsModules);
      this.topicsData['Биология ОГЭ'] = processModules(bioOgeTopicsModules);
    },
    
    handleSubjectChange(subject) {
      if (subject === 'Химия ЕГЭ') {
        this.availableSections = chem_ege_sections;
        this.allTopics = Object.values(this.topicsData['Химия ЕГЭ']).flat();
      } 
      else if (subject === 'Биология ЕГЭ') {
        this.availableSections = Object.keys(this.sectionMappings['Биология ЕГЭ']);
        this.allTopics = Object.values(this.topicsData['Биология ЕГЭ']).flat();
      }
      else if (subject === 'Химия ОГЭ') {
        this.availableSections = Object.keys(this.sectionMappings['Химия ОГЭ']);
        this.allTopics = Object.values(this.topicsData['Химия ОГЭ']).flat();
      }
      else if (subject === 'Биология ОГЭ') {
        this.availableSections = Object.keys(this.sectionMappings['Биология ОГЭ']);
        this.allTopics = Object.values(this.topicsData['Биология ОГЭ']).flat();
      }
      else {
        this.availableSections = [];
        this.allTopics = [];
      }

      this.resetFilters('subject');
      this.emitFiltersChanged();
    },
    
    handleSectionChange() {
      this.selectedTopics = [];
      this.emitFiltersChanged();
    },
    
    emitFiltersChanged() {
      this.$nextTick(() => {
        const filters = this.getCurrentFilters();
        if (filters.taskNumber) {
          filters.taskNumber = filters.taskNumber.map(num => 
            typeof num === 'string' ? parseInt(num, 10) : num
          );
        }
        this.$emit('filters-changed', filters);
      });
    },
    
    resetFilters(level) {
      if (level === 'subject') {
        this.selectedSections = [];
        this.selectedTopics = [];
        this.selectedPart = null;
        this.selectedTaskNumber = null;
      }
    },
    
    resetAllFilters() {
      this.selectedSubject = null;
      this.selectedSections = [];
      this.selectedTopics = [];
      this.selectedPart = null;
      this.selectedTaskNumber = null;
      this.selectedDifficulty = null;
      this.emitFiltersChanged();
    },
    
    getCurrentFilters() {
      return {
        subject: this.selectedSubject,
        sections: this.selectedSections,
        topics: this.selectedTopics,
        part: this.selectedPart,
        taskNumber: this.selectedTaskNumber,
        difficulty: this.selectedDifficulty
      };
    }
  }
};
</script>

<style scoped>
.filter-menu {
  width: 100%;
  margin-left: calc(-50vw + 50%);
  padding: 1.5rem 0;
  background: #f8f9fa;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-label {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: #495057;
}

.filter-reset {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  margin-top: 0.5rem;
}

.reset-button {
  padding: 0.6rem 1.2rem;
  background-color: #f1f3f5;
  border: 1px solid #dee2e6;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #495057;
}

.reset-button:hover:not(:disabled) {
  background-color: #e9ecef;
  border-color: #b241d1;
  color: #b241d1;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(178, 65, 209, 0.15);
}

.reset-button.active {
  border-color: #b241d1;
  color: #b241d1;
  font-weight: 500;
}

.reset-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reset-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.loading-subjects {
  padding: 0.5rem;
  color: #666;
  font-style: italic;
  font-size: 0.9rem;
}

.no-subjects-message {
  padding: 0.5rem;
  color: #dc3545;
  font-style: italic;
  font-size: 0.9rem;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 0.25rem;
}

/* Адаптивность для мобильных устройств */
@media (max-width: 768px) {
  .filter-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
    padding: 0 1rem;
  }
  
  .filter-reset {
    justify-content: center;
    margin-top: 0.5rem;
  }
  
  .reset-button {
    width: 100%;
    justify-content: center;
  }
}
</style>