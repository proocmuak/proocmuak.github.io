<template>
  <div v-if="loading" class="loading">Загрузка данных...</div>
  <div v-else-if="error" class="error">{{ error }}</div>
  <div v-else-if="subject2" class="block">
    <div class="subject_name">{{ subject2 }}</div>
    <div class="stats">
      <div class="stat-item">
        <span class="stat-value">{{ total_score }}</span>
        <span class="stat-label">Баллы</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value">{{ global_rating }}</span>
        <span class="stat-label">Место</span>
      </div>
    </div>
    <a v-if="subject2 === 'Биология ЕГЭ'" href="/biology_ege.html" class="button">
      Перейти
    </a>
    <a v-if="subject2 === 'Биология ОГЭ'" href="/biology_oge.html" class="button">
      Перейти
    </a>
  </div>
</template>

<script>
import { supabase } from '../supabase'

export default {
  emits: ['has-data', 'no-data'],
  
  data() {
    return {
      subject2: null,
      total_score: 0,
      global_rating: 0,
      loading: true,
      error: null,
      user_id: null
    }
  },
  
  async mounted() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) throw new Error('Пользователь не авторизован')

      this.user_id = user.id
      await this.fetchStudentData()
      
      if (this.subject2) {
        await this.fetchBiologyRating()
        await this.calculateGlobalRating()
        this.$emit('has-data')
      } else {
        this.$emit('no-data')
      }
      
    } catch (err) {
      this.error = err.message || 'Ошибка при загрузке данных'
      this.$emit('no-data')
      console.error(err)
    } finally {
      this.loading = false
    }
  },
  
  methods: {
    async fetchStudentData() {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('subject2')
          .eq('user_id', this.user_id)
          .single()

        if (error && error.code !== 'PGRST116') throw error
        this.subject2 = data?.subject2 || null
        
      } catch (err) {
        console.error('Ошибка при загрузке данных студента:', err)
        this.subject2 = null
      }
    },

    async fetchBiologyRating() {
      try {
        const { data, error } = await supabase
          .from('biology_ege_rating')
          .select('total_score')
          .eq('user_id', this.user_id)
          .single()

        if (error && error.code === 'PGRST116') {
          await supabase.from('biology_ege_rating').insert([{ 
            user_id: this.user_id, 
            total_score: 0 
          }])
          this.total_score = 0
        } else if (data) {
          this.total_score = data.total_score || 0
        }
      } catch (err) {
        console.error('Ошибка при загрузке рейтинга:', err)
        this.total_score = 0
      }
    },

    async calculateGlobalRating() {
      try {
        const { data: allRatings, error } = await supabase
          .from('biology_ege_rating')
          .select('user_id, total_score')
          .order('total_score', { ascending: false })

        if (error) throw error

        if (allRatings) {
          const userIndex = allRatings.findIndex(rating => rating.user_id === this.user_id)
          this.global_rating = userIndex !== -1 ? userIndex + 1 : 0
        }
      } catch (err) {
        console.error('Ошибка при расчете рейтинга:', err)
        this.global_rating = 0
      }
    }
  }
}
</script>

<style scoped>
.block {
  background-color: #b241d1;
  border-radius: 12px;
  padding: 14px 18px 12px 18px;
  color: white;
  display: flex;
  flex-direction: column;
  transition: opacity 0.3s ease;
  height: 100%;
  box-sizing: border-box;
  max-height: 240px;
  min-height: 180px;
}

.block:hover {
  opacity: 0.75;
}

.subject_name { 
  font-size: clamp(15px, 1.2vw, 19px);
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 6px;
  margin-bottom: 8px;
  word-break: break-word;
  line-height: 1.2;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  gap: 0;
  padding: 4px 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 14px;
}

.stat-value {
  font-size: clamp(22px, 2vw, 32px);
  font-weight: 700;
  line-height: 1.1;
}

.stat-label {
  font-size: clamp(9px, 0.65vw, 11px);
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.stat-divider {
  width: 1px;
  height: 34px;
  background: rgba(255, 255, 255, 0.2);
}

.button {
  background-color: #fff;
  color: #b241d1;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 20px;
  text-decoration: none;
  padding: 5px 14px;
  font-weight: 600;
  font-size: clamp(12px, 0.85vw, 14px);
  transition: all 0.3s ease;
  margin-top: 6px;
  min-height: 30px;
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
}

.button:hover {
  transform: scale(1.03);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.loading, .error, .no-data {
  padding: 14px;
  text-align: center;
  font-size: clamp(0.85rem, 1.2vw, 1rem);
  background-color: #f8f9fa;
  border-radius: 10px;
  color: #666;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 240px;
  min-height: 180px;
}

.error {
  color: #ff4444;
  background-color: #fff5f5;
}

.loading {
  color: #b241d1;
}

@media (max-width: 768px) {
  .block {
    max-height: 210px;
    min-height: 160px;
    padding: 12px 14px 10px 14px;
    border-radius: 10px;
  }
  
  .subject_name {
    font-size: clamp(14px, 2.5vw, 17px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-bottom: 4px;
    margin-bottom: 6px;
  }
  
  .stat-value {
    font-size: clamp(19px, 3.5vw, 26px);
  }
  
  .stat-label {
    font-size: clamp(8px, 1.4vw, 10px);
  }
  
  .stat-divider {
    height: 28px;
  }
  
  .stat-item {
    padding: 3px 10px;
  }
  
  .button {
    font-size: clamp(11px, 1.8vw, 13px);
    padding: 4px 10px;
    min-height: 26px;
    border-radius: 16px;
    margin-top: 4px;
  }
}

@media (max-width: 480px) {
  .block {
    max-height: 180px;
    min-height: 140px;
    padding: 10px 10px 8px 10px;
    border-radius: 8px;
  }
  
  .subject_name {
    font-size: clamp(12px, 3vw, 15px);
    padding-bottom: 3px;
    margin-bottom: 4px;
  }
  
  .stat-item {
    padding: 2px 8px;
  }
  
  .stat-value {
    font-size: clamp(17px, 4.5vw, 22px);
  }
  
  .stat-label {
    font-size: clamp(7px, 1.6vw, 9px);
  }
  
  .stat-divider {
    height: 24px;
  }
  
  .button {
    font-size: clamp(10px, 2.8vw, 12px);
    padding: 3px 8px;
    min-height: 22px;
    border-radius: 14px;
    margin-top: 3px;
  }
}
</style>