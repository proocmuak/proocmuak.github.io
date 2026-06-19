<template>
  <div class="useful-materials">
    <h2>Полезные материалы</h2>
    
    <!-- Кнопки переключения типов -->
    <div class="tabs">
      <button 
        class="tab-btn"
        :class="{ active: activeTab === 'textbook' }"
        @click="activeTab = 'textbook'"
      >
        📚 Учебники
      </button>
      <button 
        class="tab-btn"
        :class="{ active: activeTab === 'taskbook' }"
        @click="activeTab = 'taskbook'"
      >
        📝 Задачники
      </button>
    </div>

    <!-- Фильтр по предмету (только для студентов) -->
    <div v-if="userSubjects.length > 0" class="subject-filter">
      <CustomDropdown
        v-model="selectedSubject"
        :options="userSubjects"
        placeholder="Все предметы"
        class="subject-dropdown"
        @change="handleSubjectChange"
      />
    </div>

    <!-- Состояние загрузки -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Загрузка материалов...</p>
    </div>

    <!-- Состояние ошибки -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>{{ error }}</p>
      <button @click="fetchMaterials" class="retry-btn">Повторить</button>
    </div>

    <!-- Список материалов -->
    <div v-else-if="filteredMaterials.length > 0" class="materials-grid">
      <div 
        v-for="material in filteredMaterials" 
        :key="material.id"
        class="material-card"
      >
        <div class="material-icon">
          {{ activeTab === 'textbook' ? '📚' : '📝' }}
        </div>
        <div class="material-info">
          <h3>{{ material.name }}</h3>
          <p>{{ material.description || 'Нет описания' }}</p>
          <span class="material-subject">{{ material.subject }}</span>
        </div>
        <a 
          :href="getMaterialUrl(material.link)" 
          target="_blank" 
          class="material-link"
          :download="getFileName(material.link)"
        >
          Скачать
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </a>
      </div>
    </div>

    <!-- Пустое состояние -->
    <div v-else class="empty-state">
      <span class="empty-icon">📭</span>
      <p>Нет материалов для отображения</p>
      <p class="empty-hint">Попробуйте переключить вкладку или выберите другой предмет</p>
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
  name: 'UsefulMaterials',
  components: {
    CustomDropdown
  },
  data() {
    return {
      materials: [],
      loading: false,
      error: null,
      activeTab: 'textbook',
      selectedSubject: null,
      userSubjects: [],
      user_id: null,
      studentData: null
    }
  },
  computed: {
    filteredMaterials() {
      return this.materials.filter(m => {
        // Фильтр по типу
        if (m.type !== this.activeTab) return false
        
        // Фильтр по предмету
        if (this.selectedSubject && m.subject !== this.selectedSubject) return false
        
        return true
      })
    }
  },
  mounted() {
    this.fetchUserSubjects()
  },
  methods: {
    async getCurrentUserId() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        return user?.id || null
      } catch (err) {
        console.error('Ошибка получения ID пользователя:', err)
        return null
      }
    },

    async fetchStudentData() {
      try {
        this.user_id = await this.getCurrentUserId()
        if (!this.user_id) {
          throw new Error('Пользователь не авторизован')
        }

        const { data, error: studentError } = await supabase
          .from('students')
          .select('subject1, subject2')
          .eq('user_id', this.user_id)
          .single()

        if (studentError) throw studentError

        this.studentData = data
        return data

      } catch (err) {
        console.error('Ошибка загрузки данных студента:', err)
        return null
      }
    },

    async fetchUserSubjects() {
      try {
        const studentData = await this.fetchStudentData()
        if (!studentData) {
          throw new Error('Не удалось загрузить данные студента')
        }

        const subjects = []
        
        // Добавляем опцию "Все предметы"
        subjects.push({
          value: null,
          label: 'Все предметы'
        })
        
        if (studentData.subject1) {
          subjects.push({
            value: studentData.subject1,
            label: studentData.subject1
          })
        }
        
        if (studentData.subject2) {
          subjects.push({
            value: studentData.subject2,
            label: studentData.subject2
          })
        }

        this.userSubjects = subjects
        
        // Устанавливаем первый предмет по умолчанию (кроме "Все предметы")
        if (subjects.length > 1) {
          this.selectedSubject = subjects[1].value
        }

        await this.fetchMaterials()

      } catch (err) {
        console.error('Ошибка загрузки предметов:', err)
        this.error = 'Не удалось загрузить список предметов'
        this.userSubjects = []
      }
    },

    handleSubjectChange() {
      // Просто обновляем отображение через computed
    },

    async fetchMaterials() {
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
        this.error = 'Не удалось загрузить материалы. Попробуйте позже.'
      } finally {
        this.loading = false
      }
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

    getFileName(link) {
      if (!link) return ''
      const parts = link.split('/')
      return parts[parts.length - 1] || 'material'
    }
  }
}
</script>

<style scoped>
.useful-materials {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.useful-materials h2 {
  color: #5a2d7a;
  font-size: clamp(1.4rem, 3vw, 1.8rem);
  margin-bottom: 24px;
  text-align: center;
}

/* ===== ВКЛАДКИ ===== */
.tabs {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 20px;
}

.tab-btn {
  padding: 12px 32px;
  background: #f5f0f8;
  border: 2px solid transparent;
  border-radius: 12px;
  font-size: clamp(0.95rem, 2vw, 1.1rem);
  font-weight: 600;
  font-family: Evolventa, sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #666;
}

.tab-btn:hover {
  background: #ede5f5;
  transform: translateY(-2px);
}

.tab-btn.active {
  background: #b241d1;
  color: white;
  border-color: #b241d1;
  box-shadow: 0 4px 16px rgba(178, 65, 209, 0.3);
}

.tab-btn.active:hover {
  background: #9a36b8;
  transform: translateY(-2px);
}

/* ===== ФИЛЬТР ПО ПРЕДМЕТУ ===== */
.subject-filter {
  max-width: 300px;
  margin: 0 auto 24px;
}

.subject-dropdown {
  width: 100%;
}

/* ===== СЕТКА МАТЕРИАЛОВ ===== */
.materials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.material-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(178, 65, 209, 0.08);
  border: 1px solid #f0e6f7;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.material-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(178, 65, 209, 0.12);
  border-color: #b241d1;
}

.material-icon {
  font-size: 2rem;
  margin-bottom: 12px;
}

.material-info {
  flex: 1;
  width: 100%;
}

.material-info h3 {
  color: #5a2d7a;
  font-size: 1.1rem;
  margin-bottom: 8px;
  word-break: break-word;
}

.material-info p {
  color: #666;
  font-size: 0.95rem;
  line-height: 1.4;
  margin-bottom: 8px;
  word-break: break-word;
}

.material-subject {
  display: inline-block;
  padding: 2px 12px;
  background: #e3f2fd;
  color: #1565c0;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 12px;
}

.material-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: white;
  background: linear-gradient(135deg, #b241d1 0%, #8a2be2 100%);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
  padding: 8px 20px;
  border-radius: 30px;
  transition: all 0.3s ease;
  margin-top: auto;
}

.material-link:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(178, 65, 209, 0.3);
}

.material-link svg {
  flex-shrink: 0;
}

/* ===== СОСТОЯНИЯ ===== */
.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #f0e6f7;
  border-top: 4px solid #b241d1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-state p {
  color: #b241d1;
  font-size: 1.05rem;
}

.error-state {
  text-align: center;
  padding: 40px 20px;
  background: #fef2f2;
  border-radius: 12px;
  border: 1px solid #fecaca;
  margin: 20px 0;
}

.error-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 12px;
}

.error-state p {
  color: #dc2626;
  font-size: 1.05rem;
  margin-bottom: 16px;
}

.retry-btn {
  padding: 8px 24px;
  background: #b241d1;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.retry-btn:hover {
  background: #9a36b8;
  transform: translateY(-2px);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: #f9f8ff;
  border-radius: 12px;
  border: 2px dashed #e8d4f2;
}

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 12px;
}

.empty-state p {
  color: #666;
  font-size: 1.05rem;
}

.empty-hint {
  color: #999;
  font-size: 0.9rem;
  margin-top: 4px;
}

/* ============================================ */
/* АДАПТИВНОСТЬ */
/* ============================================ */

@media (max-width: 1024px) {
  .materials-grid {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .useful-materials {
    padding: 16px;
  }
  
  .tabs {
    gap: 8px;
  }
  
  .tab-btn {
    padding: 10px 20px;
    font-size: 0.9rem;
  }
  
  .subject-filter {
    max-width: 100%;
  }
  
  .materials-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .material-card {
    padding: 18px;
  }
  
  .material-link {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .useful-materials {
    padding: 12px;
  }
  
  .useful-materials h2 {
    font-size: 1.2rem;
  }
  
  .tabs {
    flex-direction: column;
    gap: 8px;
  }
  
  .tab-btn {
    width: 100%;
    padding: 10px 16px;
    font-size: 0.85rem;
    text-align: center;
  }
  
  .material-card {
    padding: 14px;
  }
  
  .material-info h3 {
    font-size: 1rem;
  }
  
  .material-info p {
    font-size: 0.85rem;
  }
  
  .material-link {
    font-size: 0.85rem;
    padding: 6px 16px;
  }
}
</style>