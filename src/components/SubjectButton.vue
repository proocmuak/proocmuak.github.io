<template>
  <div class="block_from_edit" @click="handleClick">
    <div class="subject_name_from_edit">{{ subjectName }}</div>
    <div class="button">Редактировать</div>
  </div>
</template>

<script setup>
defineProps({
  subjectName: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['editor-change'])

const handleClick = () => {
  emit('editor-change')
}
</script>

<style scoped>
.block_from_edit {
  background-color: #b241d1;
  border-radius: 16px;
  padding: 32px 28px;
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 18px;
  transition: all 0.3s ease;
  cursor: pointer;
  min-width: 200px;
  flex: 0 1 auto;
  height: auto;
  min-height: 200px;
}

.block_from_edit:hover {
  opacity: 0.85;
  transform: translateY(-3px);
  box-shadow: 0 6px 24px rgba(178, 65, 209, 0.35);
}

.subject_name_from_edit { 
  font-size: 20px;
  font-weight: bold;
  text-align: center;
  line-height: 1.4;
}

.button {
  background-color: #fff;
  color: #b241d1;
  padding: 12px 28px;
  border-radius: 30px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

/* Адаптивность */
@media (max-width: 768px) {
  .block_from_edit {
    min-width: 160px;
    min-height: 160px;
    padding: 24px 20px;
    border-radius: 14px;
  }
  
  .subject_name_from_edit {
    font-size: 17px;
  }
  
  .button {
    padding: 10px 20px;
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .block_from_edit {
    min-width: 140px;
    min-height: 140px;
    padding: 18px 14px;
    border-radius: 12px;
  }
  
  .subject_name_from_edit {
    font-size: 15px;
  }
  
  .button {
    padding: 8px 16px;
    font-size: 13px;
  }
}
</style>