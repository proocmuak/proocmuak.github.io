<template>
  <div class="block_from_edit" @click="handleClick">
    <div class="subject_name_from_edit">{{ subjectName }}</div>
    <div class="button">
      Редактировать
    </div>
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
  border-radius: 5%;
  padding: 5%;
  color: white;
  display: grid;
  grid-template-rows: 50% 20%;
  gap: 20%;
  transition: opacity 0.3s ease;
  height: 25vw;
  cursor: pointer;
}

.block_from_edit:hover {
  opacity: 0.75;
}

.subject_name_from_edit { 
  font-size: 1.5vw;
  font-weight: bold;
}

.button {
  background-color: #fff;
  color: black;
  display: grid;
  justify-content: center;
  align-items: center;
  border-radius: 5vw;
}

.button:hover {
  cursor: pointer;
}
</style>