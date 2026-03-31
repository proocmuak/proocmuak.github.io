<template>
  <UniversalLesson
    :table-name="courseEnglishName"
    :subject="courseName"
    :lesson-number="lessonNumber"
    @back-to-calendar="$emit('back-to-calendar')"
  />
</template>

<script setup>
import UniversalLesson from './lesson.vue'

defineProps({
  lessonNumber: {
    type: Number,
    required: true
  },
  courseEnglishName: {
    type: String,
    required: true
  },
  courseName: {
    type: String,
    required: true
  }
})

defineEmits(['back-to-calendar'])
</script>