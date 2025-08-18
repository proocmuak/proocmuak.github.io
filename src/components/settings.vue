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
      
      <!-- Кнопка выбора аватарки -->
      <button type="button" class="btn-avatar" @click="showAvatarModal = true">
        Выбрать аватарку
      </button>
      
      <!-- Кнопка сохранения -->
      <button type="submit" class="btn-save" :disabled="saving">
        {{ saving ? 'Сохранение...' : 'Сохранить' }}
      </button>
      
      <!-- Сообщение о статусе -->
      <div v-if="message" :class="['message', messageType]">
        {{ message }}
      </div>
      
      <!-- Модальное окно выбора аватарки -->
   <div v-if="showAvatarModal" class="avatar-modal">
    <div class="avatar-modal-content">
      <span class="close" @click="showAvatarModal = false">&times;</span>
      <h3>Выберите аватарку</h3>
      <div class="avatar-grid">
        <div 
          v-for="avatar in avatars" 
          :key="avatar.id"
          class="avatar-item"
          @click="selectAvatar(avatar)"
        >
          <img :src="avatar.url" :alt="avatar.name" class="avatar-image">
        </div>
      </div>
    </div>
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
        phone: '',
        avatar_id: null,
      },
      message: '',
      messageType: '',
      showAvatarModal: false,
      avatars: [],
      selectedAvatar: null
    }
  },
  async mounted() {
    await this.loadUserData()
    await this.loadAvatars()
    this.loading = false
  },
  methods: {

    async loadUserData() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new Error('Пользователь не авторизован')
    }
    
    this.form.email = user.email
    
    // Исправленный запрос - используем правильное имя столбца для user_id
    const { data: personality, error } = await supabase
      .from('personalities')
      .select('first_name, last_name, phone, avatar_id')
      .eq('user_id', user.id)  // Или 'user_id' в зависимости от вашей схемы БД
      .single()
    
    if (!error && personality) {
      this.form.first_name = personality.first_name || ''
      this.form.last_name = personality.last_name || ''
      this.form.phone = personality.phone || ''
      this.form.avatar_id = personality.avatar_id || null
      
      // Если есть аватар, загружаем его данные
      if (personality.avatar_id) {
        await this.loadAvatarData(personality.avatar_id)
      }
    }
    
  } catch (error) {
    console.error('Ошибка загрузки данных:', error)
    this.showMessage('Ошибка загрузки данных профиля', 'error')
  }
},

async loadAvatarData(avatarId) {
  try {
    const { data, error } = await supabase
      .from('avatar')
      .select('id, name, ref')
      .eq('id', avatarId)
      .single()

    if (!error && data) {
      this.selectedAvatar = {
        id: data.id,
        name: data.name,
        url: data.ref
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки аватарки:', error)
  }
},

async loadAvatars() {
  try {
    const { data, error } = await supabase
      .from('avatar')
      .select('id, name, ref')
      .order('id', { ascending: true })

    if (error) throw error

    this.avatars = data.map(item => ({
      id: item.id,
      name: item.name,
      url: item.ref // используем поле ref как URL изображения
    }))

  } catch (error) {
    console.error('Ошибка загрузки аватарок:', error)
    this.showMessage('Не удалось загрузить аватарки', 'error')
  }
},
    
 getAvatarName(avatarItem) {
      // Ищем название аватарки в возможных столбцах
      return  avatarItem.name || avatarItem.title || 'Аватар'
    },

    getAvatarUrl(avatarItem) {
      // Ищем URL в возможных столбцах
      return avatarItem.https || avatarItem.url || avatarItem.image || ''
    },

    selectAvatar(avatar) {
      this.selectedAvatar = avatar
      this.form.avatar_id = avatar.id
      this.showAvatarModal = false
      this.showMessage('Аватарка выбрана! Не забудьте сохранить изменения.', 'success')
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
            user_id: user.id,
            email: this.form.email,
            first_name: this.form.first_name,
            last_name: this.form.last_name,
            phone: this.form.phone,
            avatar_id: this.form.avatar_id,
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
*{
  font-family: Evolventa;
}
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
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 20px 30px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  animation: fadeInOut 3s ease-in-out forwards;
  max-width: 80%;
}

.message.success {
  background-color: #f0e6ff;
  color: #b241d1;
  border: 1px solid #b241d1;
}

.message.error {
  background-color: #ffebee;
  color: #d32f2f;
  border: 1px solid #d32f2f;
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  15% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  85% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
}

/* Существующие стили остаются без изменений */
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

.btn-avatar {
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

.btn-save:disabled, .btn-avatar:disabled {
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

/* Стили для модального окна */
.avatar-modal {
  position: fixed;
  z-index: 1;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.4);
  display: flex;
  justify-content: center;
  align-items: center;
}

.avatar-modal-content {
  background-color: #f9f8ff;
  padding: 20px;
  border-radius: 8px;
  width: 80%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.close {
  color: #aaa;
  float: right;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
}

.close:hover {
  color: black;
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-top: 20px;
}

.avatar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 10px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.avatar-item:hover {
  background-color: rgba(178, 65, 209, 0.3);
}

.avatar-image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-name {
  margin-top: 8px;
  text-align: center;
  font-size: 14px;
}

</style>