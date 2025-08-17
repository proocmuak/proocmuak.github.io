<template>
  <div class="filter-menu">
    <div class="filter-grid">
      <!-- Выбор предмета -->
      <div class="filter-item">
        <h3 class="filter-label">Предмет</h3>
        <CustomDropdown
          :options="subjects"
          placeholder="Выберите предмет"
          v-model="selectedSubject"
          @change="handleSubjectChange"
        />
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
      :options="filteredTaskNumbers"
      placeholder="Выберите номер"
      v-model="selectedTaskNumber"
      :multiple="true"
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
import { subjects } from '../assets/arrays/subjects_list_for_task_bank.js';
import { chem_ege_sections } from '../assets/arrays/list_of_sections.js';
import CustomDropdown from './CustomDropdown.vue';

const chemTopicsModules = import.meta.glob('../assets/arrays/topics/chem_ege/*.js', { eager: true });
const bioTopicsModules = import.meta.glob('../assets/arrays/topics/biology_ege/*.js', { eager: true });

const processModules = (modules) => {
  const result = {};
  for (const path in modules) {
    const fileName = path.split('/').pop().replace('.js', '').replace(/_/g, ' ');
    result[fileName] = modules[path].default;
  }
  return result;
};

export default {
  name: 'FilterMenu',
  components: {
    CustomDropdown
  },
  data() {
    return {
      subjects: [],
      selectedSubject: null,
      selectedSections: [],
      selectedTopics: [],
      selectedPart: null,
      selectedTaskNumber: null,
      availableSections: [],
      allTopics: [],
      topicsData: {
        'Химия ЕГЭ': {},
        'Биология ЕГЭ': {}
      },
      parts: ['Первая часть', 'Вторая часть'],
      taskNumbers: Array.from({length: 34}, (_, i) => i + 1),
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
      // Если не выбраны разделы - показываем все темы
      if (this.selectedSections.length === 0) {
        return this.allTopics;
      }

      // Получаем темы для выбранных разделов
      const topics = this.selectedSections.flatMap(section => {
        const sectionKey = this.sectionMappings[this.selectedSubject]?.[section];
        return sectionKey ? this.topicsData[this.selectedSubject][sectionKey] || [] : [];
      });

      // Удаляем дубликаты и возвращаем
      return [...new Set(topics)];
    },
    filteredTaskNumbers() {
      if (!this.selectedSubject) return [];
      
      const isChemistry = this.selectedSubject === 'Химия ЕГЭ';
      const isFirstPart = this.selectedPart === 'Первая часть';
      
      if (isChemistry) {
        if (isFirstPart) {
          return Array.from({length: 28}, (_, i) => i + 1);
        } else if (this.selectedPart === 'Вторая часть') {
          return Array.from({length: 6}, (_, i) => i + 29);
        }
        return Array.from({length: 34}, (_, i) => i + 1);
      } else { // Биология ЕГЭ
        if (isFirstPart) {
          return Array.from({length: 21}, (_, i) => i + 1);
        } else if (this.selectedPart === 'Вторая часть') {
          return Array.from({length: 7}, (_, i) => i + 22);
        }
        return Array.from({length: 28}, (_, i) => i + 1);
      }
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
      // Сбрасываем выбранный номер при изменении части
      this.selectedTaskNumber = null;
      this.emitFiltersChanged();
    },
  },
  created() {
    this.initializeData();
  },
  methods: {
    initializeData() {
      this.subjects = subjects;
      this.topicsData['Химия ЕГЭ'] = processModules(chemTopicsModules);
      this.topicsData['Биология ЕГЭ'] = processModules(bioTopicsModules);
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
        this.$emit('filters-changed', this.getCurrentFilters());
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
      this.resetFilters('subject');
      this.emitFiltersChanged();
    },
    getCurrentFilters() {
      return {
        subject: this.selectedSubject,
        sections: this.selectedSections,
        topics: this.selectedTopics,
        part: this.selectedPart,
        taskNumber: this.selectedTaskNumber
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



