<template>
<div class="title">Настройки профиля</div>    
    
    <div class="block_of_content">
    <div v-if="loading" class="loading">Загрузка данных...</div>
    
    <form v-else @submit.prevent="saveSettings">
      <!-- Поле email (только для чтения) -->
      <div class="form-group">
        <label>Email:</label>
        <input
          type="email"
          v-model="form.email"
          disabled
          class="form-control"
        />
      </div>
      
      <!-- Поле имени -->
      <div class="form-group">
        <label>Имя:</label>
        <input
          type="text"
          v-model="form.first_name"
          class="form-control"
          placeholder="Введите ваше имя"
        />
      </div>
      
      <!-- Поле фамилии -->
      <div class="form-group">
        <label>Фамилия:</label>
        <input
          type="text"
          v-model="form.last_name"
          class="form-control"
          placeholder="Введите вашу фамилию"
        />
      </div>
      
      <!-- Поле телефона -->
      <div class="form-group">
        <label>Телефон:</label>
        <input
          type="tel"
          v-model="form.phone"
          class="form-control"
          placeholder="Введите ваш телефон"
        />
      </div>
      
      <!-- Кнопка сохранения -->
      <button type="submit" class="btn-save" :disabled="saving">
        {{ saving ? 'Сохранение...' : 'Сохранить' }}
      </button>
      
      <!-- Сообщение о статусе -->
      <div v-if="message" :class="['message', messageType]">
        {{ message }}
      </div>
      
    </form>
    </div>
</template>

<script>
import { supabase } from '../supabase.js'

export default {
  name: 'AccountSettings',
  data() {
    return {
      loading: true,
      saving: false,
      form: {
        email: '',
        first_name: '',
        last_name: '',
        phone: ''
      },
      message: '',
      messageType: ''
    }
  },
  async mounted() {
    await this.loadUserData()
    this.loading = false
  },
  methods: {
    async loadUserData() {
      try {
        // Получаем текущего пользователя из Supabase Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          throw new Error('Пользователь не авторизован')
        }
        
        // Сохраняем email в форму
        this.form.email = user.email
        
        // Получаем данные пользователя из таблицы personalities
        const { data: personality, error } = await supabase
          .from('personalities')
          .select('first_name, last_name, phone')
          .eq('user_id', user.id)  // Используем user_id вместо id
          .single()
        
        // Если есть данные - заполняем форму
        if (!error && personality) {
          this.form.first_name = personality.first_name || ''
          this.form.last_name = personality.last_name || ''
          this.form.phone = personality.phone || ''
        }
        
      } catch (error) {
        console.error('Ошибка загрузки данных:', error)
        this.showMessage('Ошибка загрузки данных профиля', 'error')
      }
    },
    
    async saveSettings() {
      if (!this.form.email) {
        this.showMessage('Email обязателен для сохранения', 'error')
        return
      }
      
      this.saving = true
      
      try {
        // Получаем ID текущего пользователя
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('Ошибка авторизации')
        
        // Обновляем или создаем запись в таблице personalities
        const { error } = await supabase
          .from('personalities')
          .upsert({
            user_id: user.id,  // Используем user_id вместо id
            email: this.form.email,
            first_name: this.form.first_name,
            last_name: this.form.last_name,
            phone: this.form.phone,
            updated_at: new Date().toISOString()
          })
        
        if (error) {
  console.log('Full error:', error) 
  throw error
}
        
        this.showMessage('Данные успешно сохранены!', 'success')
      } catch (error) {
        console.error('Ошибка сохранения:', error)
        this.showMessage('Ошибка сохранения данных', 'error')
      } finally {
        this.saving = false
      }
    },
    
    showMessage(text, type) {
      this.message = text
      this.messageType = type
      setTimeout(() => {
        this.message = ''
        this.messageType = ''
      }, 3000)
    }
  }
}
</script>

<style scoped>
/* Стили остаются без изменений */
.account-settings {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

    .title{
        font-size: 2vw;
        font-weight: bold;
        display: flex;
        align-items: center;
    }

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.form-group {
  margin-bottom: 15px;
  width: 100%;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #444;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #b241d1;
  border-radius: 4px;
  font-size: 16px;
}

.form-control:disabled {
  background-color: #f5f5f5;
  color: #777;
}

.btn-save {
  background-color: #b241d1;
  color: white;
  padding: 12px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  width: 100%;
  margin-top: 10px;
  transition: background-color 0.3s;
}



.btn-save:disabled {
  background-color: #f9f8ff;
  cursor: not-allowed;
}
    .block_of_content{
        background-color: #f9f8ff;
        margin-bottom: 5%;
        padding: 2.5%;
        border-radius: 2%;
    }
.message {
  margin-top: 15px;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
  color: #b241d1;
}

.message.success {
  color: #b241d1;
}

.message.error {
  background-color: #ffebee;
  color: #d32f2f;
}
</style>