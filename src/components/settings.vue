<template>
  <div class="settings-wrapper">
    <div class="settings-card">
      <h2 class="settings-title">Настройки профиля</h2>
      
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Загрузка данных...</p>
      </div>
      
      <form v-else @submit.prevent="saveSettings" class="settings-form">
        <!-- Аватар секция -->
        <div class="avatar-section">
          <div class="avatar-preview" @click="showAvatarModal = true">
            <img 
              v-if="avatarPreviewUrl" 
              :src="avatarPreviewUrl" 
              class="avatar-image"
            >
            <div v-else class="avatar-placeholder"></div>
            <div class="avatar-overlay">
              <span>Изменить</span>
            </div>
          </div>
          <button type="button" class="change-avatar-btn" @click="showAvatarModal = true">
            Выбрать аватарку
          </button>
        </div>

        <!-- Форма -->
        <div class="form-fields">
          <div class="form-group">
            <label>Email</label>
            <input
              type="email"
              v-model="form.email"
              disabled
              class="form-control"
            />
          </div>
          
          <div class="form-group">
            <label>Имя</label>
            <input
              type="text"
              v-model="form.first_name"
              class="form-control"
              placeholder="Имя"
            />
          </div>
          
          <div class="form-group">
            <label>Фамилия</label>
            <input
              type="text"
              v-model="form.last_name"
              class="form-control"
              placeholder="Фамилия"
            />
          </div>
          
          <div class="form-group">
            <label>Телефон</label>
            <input
              type="tel"
              v-model="form.phone"
              class="form-control"
              placeholder="Телефон"
            />
          </div>
        </div>
        
        <button type="submit" class="btn-save" :disabled="saving">
          {{ saving ? 'Сохранение...' : 'Сохранить' }}
        </button>
        
        <div v-if="message" :class="['toast-message', messageType]">
          {{ message }}
        </div>
      </form>
    </div>
    
    <!-- Модальное окно выбора аватарки -->
    <div v-if="showAvatarModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-container">
        <div class="modal-header">
          <h3>Выберите аватарку</h3>
          <button class="modal-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="avatar-grid">
            <div 
              v-for="avatar in avatars" 
              :key="avatar.id"
              class="avatar-option"
              :class="{ 'avatar-option-selected': selectedAvatar?.id === avatar.id }"
              @click="selectAvatar(avatar)"
            >
              <img :src="getAvatarProxyUrl(avatar.url)" :alt="avatar.name" class="avatar-option-img">
              <div class="avatar-option-check" v-if="selectedAvatar?.id === avatar.id">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeModal">Отмена</button>
          <button class="btn-confirm" @click="confirmAvatarSelection">Выбрать</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { supabase } from '../supabase.js'

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

const PROXY_CONFIG = {
  enabled: true,
  baseUrl: isLocalhost 
    ? 'https://schoolpurto.ru/storage' 
    : '/storage'
}

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
      selectedAvatar: null,
      currentAvatarUrl: null
    }
  },
  computed: {
    avatarPreviewUrl() {
      if (this.currentAvatarUrl) return this.currentAvatarUrl
      if (this.selectedAvatar) return this.getAvatarProxyUrl(this.selectedAvatar.url)
      return null
    }
  },
  async mounted() {
    await this.loadUserData()
    await this.loadAvatars()
    this.loading = false
  },
  methods: {
    getAvatarProxyUrl(ref) {
      if (!ref) return null
      
      if (!ref.startsWith('http')) {
        if (PROXY_CONFIG.enabled) {
          return `${PROXY_CONFIG.baseUrl}/avatar/${ref}`
        }
        return ref
      }
      
      if (ref.includes('supabase.co')) {
        const match = ref.match(/\/storage\/v1\/object\/public\/avatar\/(.+)$/)
        if (match) {
          return `${PROXY_CONFIG.baseUrl}/avatar/${match[1]}`
        }
      }
      
      return ref
    },

    async loadUserData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          throw new Error('Пользователь не авторизован')
        }
        
        this.form.email = user.email
        
        const { data: personality, error } = await supabase
          .from('personalities')
          .select('first_name, last_name, phone, avatar_id')
          .eq('user_id', user.id)
          .single()
        
        if (!error && personality) {
          this.form.first_name = personality.first_name || ''
          this.form.last_name = personality.last_name || ''
          this.form.phone = personality.phone || ''
          this.form.avatar_id = personality.avatar_id || null
          
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
          this.currentAvatarUrl = this.getAvatarProxyUrl(data.ref)
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
          url: item.ref
        }))

      } catch (error) {
        console.error('Ошибка загрузки аватарок:', error)
        this.showMessage('Не удалось загрузить аватарки', 'error')
      }
    },

    selectAvatar(avatar) {
      this.selectedAvatar = avatar
    },

    confirmAvatarSelection() {
      if (this.selectedAvatar) {
        this.form.avatar_id = this.selectedAvatar.id
        this.currentAvatarUrl = this.getAvatarProxyUrl(this.selectedAvatar.url)
        this.showAvatarModal = false
        this.showMessage('Аватарка выбрана! Сохраните изменения.', 'success')
      }
    },

    closeModal() {
      this.showAvatarModal = false
    },

    async saveSettings() {
      if (!this.form.email) {
        this.showMessage('Email обязателен для сохранения', 'error')
        return
      }
      
      this.saving = true
      
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('Ошибка авторизации')
        
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
        
        if (error) throw error
        
        this.showMessage('Данные успешно сохранены!', 'success')
        
        window.dispatchEvent(new CustomEvent('profile-updated', {
          detail: {
            first_name: this.form.first_name,
            last_name: this.form.last_name,
            avatar_url: this.currentAvatarUrl
          }
        }))
        
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
* {
  font-family: Evolventa, sans-serif;
}

.settings-wrapper {
  width: 100%;
  max-width: 550px;
  margin: 0 auto;
  padding: 20px;
}

.settings-card {
  width: 100%;
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.settings-title {
  font-size: 20px;
  font-weight: bold;
  color: #333;
  margin-bottom: 20px;
  text-align: center;
}

.loading-state {
  text-align: center;
  padding: 30px;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #f0e6f7;
  border-top: 3px solid #b241d1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Аватар секция */
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.avatar-preview {
  position: relative;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  cursor: pointer;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #b241d1, #8a2be2);
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 50%;
}

.avatar-overlay span {
  color: white;
  font-size: 10px;
  font-weight: 500;
}

.avatar-preview:hover .avatar-overlay {
  opacity: 1;
}

.change-avatar-btn {
  background: none;
  border: 1px solid #b241d1;
  color: #b241d1;
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.change-avatar-btn:hover {
  background: rgba(178, 65, 209, 0.1);
}

/* Форма */
.form-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

label {
  font-weight: 500;
  color: #333;
  font-size: 12px;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 13px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-control:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.1);
}

.form-control:disabled {
  background-color: #f5f5f5;
  color: #999;
}

.btn-save {
  width: 100%;
  padding: 10px;
  background: #b241d1;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 4px;
}

.btn-save:hover:not(:disabled) {
  background: #9a36b8;
  transform: translateY(-1px);
}

.btn-save:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.toast-message {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  animation: slideUp 0.3s ease;
  z-index: 1000;
}

.toast-message.success {
  background: #4caf50;
  color: white;
}

.toast-message.error {
  background: #f44336;
  color: white;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* Модальное окно */
.modal-overlay {
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
}

.modal-container {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: #999;
}

.modal-close:hover {
  color: #333;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.avatar-option {
  position: relative;
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
  aspect-ratio: 1;
}

.avatar-option-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-option:hover {
  transform: scale(1.02);
}

.avatar-option-selected {
  outline: 2px solid #b241d1;
  outline-offset: 1px;
}

.avatar-option-check {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  background: #b241d1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid #eee;
}

.btn-cancel, .btn-confirm {
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel {
  background: #f5f5f5;
  border: none;
  color: #666;
}

.btn-cancel:hover {
  background: #e0e0e0;
}

.btn-confirm {
  background: #b241d1;
  border: none;
  color: white;
}

.btn-confirm:hover {
  background: #9a36b8;
}

/* Адаптивность */
@media (max-width: 600px) {
  .settings-wrapper {
    padding: 12px;
  }
  
  .settings-card {
    padding: 16px;
  }
  
  .settings-title {
    font-size: 18px;
    margin-bottom: 16px;
  }
  
  .avatar-grid {
    gap: 8px;
  }
}
</style>