<script>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { supabase } from './supabase.js'
import DOMPurify from 'dompurify'

// === список заданий с учётом порядка ===
const ORDERED_TASKS = {
  chemistry: [6, 7, 8, 14, 15, 22, 23, 24],
  biology: [2, 6, 8, 10, 12, 14, 16, 19, 20]
};

// === нормализация номера ===
function normalizeTaskNumber(taskNumber) {
  if (taskNumber == null) return null;
  const s = String(taskNumber).trim();
  const m = s.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isNaN(n) ? null : n;
}

// === короткий subject из названия таблицы ===
function shortSubjectFromProgressTable(progressTableName) {
  const s = String(progressTableName).toLowerCase();
  if (s.includes('chemistry')) return 'chemistry';
  if (s.includes('biology')) return 'biology';
  return null;
}

// === вспомогательные функции ===
function splitAnswerVariantsRaw(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[/]|ИЛИ/i)
    .map(s => s.trim())
    .filter(Boolean);
}

function isDigitSequence(s) {
  return /^[0-9]+$/.test(s);
}

function splitNumericElements(s) {
  return s.split('').filter(ch => /\d/.test(ch));
}

function normalizeText(s) {
  return s.toLowerCase().replace(/\s+/g, '');
}

// === проверка числовых ответов ===
function checkNumericAnswer(userRaw, variant, points, orderMatters) {
  const userElems = splitNumericElements(userRaw);
  const correctElems = splitNumericElements(variant);

  if (orderMatters) {
    // порядок обязателен
    let matches = 0;
    for (let i = 0; i < correctElems.length; i++) {
      if (userElems[i] === correctElems[i]) matches++;
    }
    const mistakes = correctElems.length - matches;
    if (mistakes === 0) {
      return { correct: true, partial: false };
    }
    if (points === 2 && mistakes === 1) {
      return { correct: false, partial: true };
    }
  } else {
    if (points === 1 && correctElems.length === userElems.length) {
      let matches = 0;
      for (let i = 0; i < correctElems.length; i++) {
        if (userElems[i] === correctElems[i]) matches++;
      }
      if (matches === correctElems.length) {
        return { correct: true, partial: false };
      }
    }

    if (points === 2) {
      // порядок НЕ важен
      const sortedCorrect = [...correctElems].sort();
      const sortedUser = [...userElems].sort();

      if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)) {
        return { correct: true, partial: false };
      }

      // частичное совпадение
      const matches = userElems.filter(e => correctElems.includes(e)).length;
      if (
        ((matches === userElems.length || matches === correctElems.length) &&
          Math.abs(correctElems.length - userElems.length) === 1) ||
        Math.abs(matches - correctElems.length) === 1
      ) {
        return { correct: false, partial: true };
      }
    }
  }

  return { correct: false, partial: false };
}

// === проверка ответа (адаптированная для компонента) ===
function checkAnswerComponent(userAnswerRaw, correctAnswerRaw, points, shortSubject, taskNumberRaw) {
  const userRaw = userAnswerRaw == null ? '' : String(userAnswerRaw).trim();
  if (!userRaw) {
    return { score: 0, isCorrect: false, isPartiallyCorrect: false };
  }

  const variants = splitAnswerVariantsRaw(correctAnswerRaw);
  let anyCorrect = false;
  let anyPartial = false;

  const taskNum = normalizeTaskNumber(taskNumberRaw);
  let orderMatters = false;
  if (points === 2 && shortSubject && taskNum != null) {
    orderMatters = ORDERED_TASKS[shortSubject]?.includes(taskNum) || false;
  }

  for (const variant of variants) {
    if (isDigitSequence(variant) && isDigitSequence(userRaw)) {
      const { correct, partial } = checkNumericAnswer(userRaw, variant, points, orderMatters);
      if (correct) {
        anyCorrect = true;
        break;
      }
      if (partial) {
        anyPartial = true;
      }
    } else {
      if (normalizeText(userRaw) === normalizeText(variant)) {
        anyCorrect = true;
        break;
      }
    }
  }

  const isCorrect = anyCorrect;
  const isPartiallyCorrect = !isCorrect && anyPartial;
  const score = isCorrect ? points : isPartiallyCorrect ? 1 : 0;

  return { score, isCorrect, isPartiallyCorrect };
}

export default {
  name: 'Homework',
  setup() {
    const homeworkData = ref({
      homework_name: '',
      lesson_number: '',
      lesson_name: '',
      deadline: null
    })
    const tasks = ref([])
    const loading = ref(true)
    const error = ref(null)
    const user_id = ref(null)
    const isCompleted = ref(false)
    const totalScore = ref(0)
    const showImageModal = ref(false)
    const selectedImage = ref('')
    const showAnswers = ref(false)
    const subject = ref('')
    const homeworkId = ref('')
    const editInput = ref(null)

    // Получаем параметры из URL
    const getUrlParams = () => {
      const params = new URLSearchParams(window.location.search)
      return {
        subject: params.get('subject'),
        homework_id: params.get('homework_id'),
        homework_name: params.get('homework_name'),
        lesson_number: params.get('lesson_number'),
        lesson_name: params.get('lesson_name'),
        view_mode: params.get('view_mode'),
        student_id: params.get('student_id')
      }
    }

    const urlParams = getUrlParams()
    subject.value = urlParams.subject
    homeworkId.value = urlParams.homework_id

    homeworkData.value = {
      homework_name: urlParams.homework_name || '',
      lesson_number: urlParams.lesson_number || '',
      lesson_name: urlParams.lesson_name || '',
      deadline: null
    }

    // Получение ID текущего пользователя
    const getCurrentUserId = async () => {
      if (urlParams.view_mode === 'tutor' && urlParams.student_id) {
        return urlParams.student_id;
      }
      
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) {
          console.error('Ошибка получения пользователя:', authError)
          return null
        }
        return user?.id || null
      } catch (err) {
        console.error('Ошибка получения ID пользователя:', err)
        return null
      }
    }

    const isViewMode = computed(() => {
      return urlParams.view_mode === 'tutor';
    });

    const isTutorMode = computed(() => {
      return urlParams.view_mode === 'tutor';
    });

    // Метод для перенаправления в меню
    async function redirectToMenu() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) throw userError;
        if (!user) {
          window.location.href = '/login.html';
          return;
        }

        const { data: personalityData, error: personalityError } = await supabase
          .from('personalities')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (personalityError) throw personalityError;
        if (!personalityData) {
          alert('Профиль пользователя не найден');
          return;
        }

        switch(personalityData.role) {
          case 'student':
            window.location.href = '/student_menu.html';
            break;
          case 'teacher':
            window.location.href = '/teacher_menu.html';
            break;
          case 'tutor':
            window.location.href = '/tutor_menu.html';
            break;
          default:
            alert('Неизвестная роль пользователя');
        }
      } catch (err) {
        console.error('Ошибка при перенаправлении:', err);
        alert('Произошла ошибка при переходе на главную');
      }
    }

    // Санитизация HTML
    const sanitizeHtml = (html) => {
      if (!html) return ''
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'sub', 'sup', 'ul', 'ol', 'li', 'div', 'span'],
        ALLOWED_ATTR: ['style', 'class']
      })
    }

    // Получение URL изображения
    const getImageUrl = (imagePath) => {
      if (!imagePath) return ''
      if (imagePath.startsWith('http')) return imagePath;
      
      try {
        const { data: { publicUrl } } = supabase
          .storage
          .from('task-images')
          .getPublicUrl(imagePath);
        return publicUrl;
      } catch (err) {
        console.error('Ошибка получения URL изображения:', err)
        return ''
      }
    }

    // Удаление таблиц из текста задания
    // Функция для обработки текста с абзацами
    const formatTextWithParagraphs = (text) => {
      if (!text) return ''
      
      // Заменяем двойные переносы на параграфы
      let formattedText = text
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
      
      // Оборачиваем в параграф, если нужно
      if (!formattedText.startsWith('<p>') && !formattedText.includes('</p>')) {
        formattedText = `<p>${formattedText}</p>`
      }
      
      return formattedText
    }

    // Обновите функцию получения текста задания
    const getTaskTextWithoutTables = (task) => {
      if (!task.text) return '';
      const textWithoutTables = task.has_table ? task.text.replace(/<table[\s\S]*?<\/table>/gi, '') : task.text;
      return formatTextWithParagraphs(textWithoutTables);
    }

    // Начать редактирование ответа
    const startEdit = (task) => {
      task.isEditing = true;
      task.editAnswerInput = task.userAnswer || '';
      
      // Фокусируемся на поле ввода после обновления DOM
      nextTick(() => {
        const input = document.querySelector(`.task-item[data-task-id="${task.task_id}"] .answer-input`);
        if (input) {
          input.focus();
          input.select();
        }
      });
    }

    // Отменить редактирование
    const cancelEdit = (task) => {
      task.isEditing = false;
      task.editAnswerInput = '';
    }

    // Сохранение отредактированного ответа
    const saveEditedAnswer = async (task) => {
      if (!task.editAnswerInput.trim()) {
        alert('Пожалуйста, введите ответ');
        return;
      }

      try {
        task.saving = true;
        const userAnswer = task.editAnswerInput.trim();
        
        // Обновляем данные задачи
        task.userAnswer = userAnswer;
        task.userAnswerInput = userAnswer;
        task.isEditing = false;
        
        // Сохраняем в базу данных
        await saveTaskProgress(task, false);
        
        task.saving = false;
        
      } catch (err) {
        console.error('Ошибка сохранения отредактированного ответа:', err);
        task.saving = false;
        error.value = 'Ошибка при сохранении ответа: ' + err.message;
      }
    }

    // Сохранение ответа
    const saveAnswer = async (task) => {
      if (!task.userAnswerInput.trim()) {
        alert('Пожалуйста, введите ответ');
        return;
      }

      try {
        task.saving = true;
        const userAnswer = task.userAnswerInput.trim();
        
        task.userAnswer = userAnswer;
        
        await saveTaskProgress(task, false);
        
        task.saving = false;

      } catch (err) {
        console.error('Ошибка сохранения ответа:', err);
        task.saving = false;
        error.value = 'Ошибка при сохранении ответа: ' + err.message;
      }
    }

    // Сохранение прогресса выполнения задания
    const saveTaskProgress = async (task, checkCorrectness = false) => {
      if (!user_id.value) return;

      let score = 0;
      let is_completed = false;

      if (checkCorrectness) {
        // Используем новый алгоритм проверки
        const result = checkAnswerComponent(
          task.userAnswer,
          task.answer,
          task.points,
          subject.value,
          task.number
        );

        score = result.score;
        is_completed = result.isCorrect || result.isPartiallyCorrect;

        task.isCorrect = result.isCorrect;
        task.isPartiallyCorrect = result.isPartiallyCorrect;
        task.awardedPoints = score;
      }

      try {
        const progressTable = `${subject.value}_progress`;
        const { error } = await supabase
          .from(progressTable)
          .upsert({
            user_id: user_id.value,
            task_id: task.task_id,
            is_completed: is_completed,
            score: score,
            user_answer: task.userAnswer,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'user_id,task_id'
          });

        if (error) throw error;

      } catch (err) {
        console.error('Ошибка сохранения прогресса:', err);
        throw err;
      }
    };

    // Функция для выставления баллов куратором
    const setTutorScore = async (task, manualScore) => {
      if (!isTutorMode.value || !user_id.value) return;
      
      try {
        task.saving = true;
        
        // Обновляем баллы задачи
        task.awardedPoints = manualScore;
        task.isCorrect = manualScore === task.points;
        task.isPartiallyCorrect = manualScore > 0 && manualScore < task.points;
        
        // Сохраняем в прогресс
        const progressTable = `${subject.value}_progress`;
        const { error } = await supabase
          .from(progressTable)
          .upsert({
            user_id: user_id.value,
            task_id: task.task_id,
            is_completed: manualScore > 0,
            score: manualScore,
            user_answer: task.userAnswer,
            last_updated: new Date().toISOString(),
          }, {
            onConflict: 'user_id,task_id'
          });

        if (error) throw error;
        
        // Обновляем общий балл домашнего задания
        await updateHomeworkTotalScore();
        
      } catch (err) {
        console.error('Ошибка сохранения баллов куратора:', err);
        error.value = 'Ошибка при сохранении баллов: ' + err.message;
      } finally {
        task.saving = false;
      }
    };

    // Обновление общего балла домашнего задания
    const updateHomeworkTotalScore = async () => {
      if (!user_id.value) return;
      
      const newTotalScore = tasks.value.reduce((sum, task) => sum + (task.awardedPoints || 0), 0);
      
      try {
        const { error } = await supabase
          .from(`${subject.value}_homework_completed`)
          .upsert({
            homework_id: parseInt(homeworkId.value),
            user_id: user_id.value,
            is_completed: true,
            score: newTotalScore,
            completed_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,homework_id'
          });

        if (error) throw error;
        
        totalScore.value = newTotalScore;
        
      } catch (err) {
        console.error('Ошибка обновления общего балла:', err);
      }
    };

    // Завершение домашнего задания
    const completeHomework = async () => {
      try {
        error.value = null;
        
        // Пересчитываем общий балл перед завершением
        updateTotalScore();

        // Проверяем и сохраняем все ответы с определением правильности
        for (const task of tasks.value) {
          if (task.userAnswer) {
            await saveTaskProgress(task, true);
          }
        }

        // Обновляем общий балл после проверки всех заданий
        updateTotalScore();

        // Сохраняем завершение домашнего задания
        const completionData = {
          homework_id: parseInt(homeworkId.value), // Убедимся, что это число
          user_id: user_id.value,
          is_completed: true,
          score: totalScore.value,
          completed_at: new Date().toISOString()
        };

        console.log('Отправляемые данные:', completionData);

        const { error: completionError } = await supabase
          .from(`${subject.value}_homework_completed`)
          .upsert(completionData, {
            onConflict: 'user_id,homework_id'
          });

        if (completionError) {
          console.error('Ошибка Supabase:', completionError);
          throw new Error(completionError.message);
        }

        isCompleted.value = true;
        showAnswers.value = true;
        
        alert('Домашнее задание завершено! Набрано баллов: ' + totalScore.value + '/' + maxScore.value);

      } catch (err) {
        error.value = err.message;
        console.error('Полная ошибка завершения домашнего задания:', err);
        alert('Ошибка: ' + err.message);
      }
    }

    // Загрузка заданий домашнего задания
    const fetchHomeworkTasks = async () => {
      try {
        loading.value = true
        error.value = null
        user_id.value = await getCurrentUserId()

        if (!user_id.value) {
          throw new Error('Пользователь не авторизован')
        }

        if (!subject.value || !homeworkId.value) {
          throw new Error('Не указаны параметры домашнего задания')
        }

        // Загрузка информации о домашнем задании
        const { data: homeworkInfo, error: homeworkInfoError } = await supabase
          .from(`${subject.value}_homework_list`)
          .select('deadline, homework_name, lesson_number, lesson_name')
          .eq('homework_id', homeworkId.value)
          .single()

        if (homeworkInfoError) {
          console.error('Ошибка загрузки информации о домашнем задании:', homeworkInfoError)
        } else if (homeworkInfo) {
          homeworkData.value = {
            ...homeworkData.value,
            deadline: homeworkInfo.deadline,
            homework_name: homeworkInfo.homework_name || homeworkData.value.homework_name,
            lesson_number: homeworkInfo.lesson_number || homeworkData.value.lesson_number,
            lesson_name: homeworkInfo.lesson_name || homeworkData.value.lesson_name
          }
        }

        // Загружаем задания домашнего задания с правильным номером
        const { data: homeworkTasks, error: homeworkError } = await supabase
          .from(`${subject.value}_homework_tasks`)
          .select('*')
          .eq('homework_id', homeworkId.value)
          .order('number', { ascending: true }) // Сортируем по номеру

        if (homeworkError) {
          throw new Error('Не удалось загрузить задания: ' + homeworkError.message)
        }

        if (!homeworkTasks || homeworkTasks.length === 0) {
          throw new Error('Задания для этого домашнего задания не найдены')
        }

        // Загружаем детали заданий из банка задач
        const taskIds = homeworkTasks.map(task => task.task_id)
        const { data: taskDetails, error: taskError } = await supabase
          .from(`${subject.value}_task_bank`)
          .select('*')
          .in('id', taskIds)

        if (taskError) {
          throw new Error('Не удалось загрузить детали заданий: ' + taskError.message)
        }

        // Объединяем данные, сохраняя номер из homework_tasks
        tasks.value = homeworkTasks.map(homeworkTask => {
          const taskDetail = taskDetails.find(t => t.id === homeworkTask.task_id)
          return {
            ...homeworkTask, // Это важно - homeworkTask должен быть первым
            ...taskDetail,
            number: homeworkTask.number, // Сохраняем номер из homework_tasks
            userAnswerInput: '',
            userAnswer: null,
            isCorrect: false,
            isPartiallyCorrect: false,
            awardedPoints: 0,
            saving: false,
            isEditing: false,
            editAnswerInput: '',
            manualScore: 0 // Для куратора
          }
        })

        // Загружаем прогресс выполнения
        await loadTasksProgress()

        // Проверяем статус выполнения домашнего задания
        await checkHomeworkCompletion()

      } catch (err) {
        error.value = err.message
        console.error('Ошибка загрузки заданий:', err)
      } finally {
        loading.value = false
      }
    }

    // Загрузка прогресса выполнения заданий
    const loadTasksProgress = async () => {
      if (!user_id.value) return

      try {
        const taskIds = tasks.value.map(task => task.task_id)
        const progressTable = `${subject.value}_progress`;
        
        const { data: progressData, error: progressError } = await supabase
          .from(progressTable)
          .select('*')
          .eq('user_id', user_id.value)
          .in('task_id', taskIds)

        if (progressError) {
          console.error('Ошибка загрузки прогресса:', progressError)
          return
        }

        // Проверяем статус завершения домашнего задания
        const { data: completionData } = await supabase
          .from(`${subject.value}_homework_completed`)
          .select('is_completed')
          .eq('homework_id', homeworkId.value)
          .eq('user_id', user_id.value)
          .maybeSingle()

        showAnswers.value = completionData?.is_completed || isTutorMode.value;

        // Обновляем задачи
        tasks.value = tasks.value.map(task => {
          const progress = progressData?.find(p => p.task_id === task.task_id)
          if (progress) {
            return {
              ...task,
              userAnswer: progress.user_answer,
              isCorrect: showAnswers.value ? progress.score === task.points : false,
              isPartiallyCorrect: showAnswers.value ? (progress.score > 0 && progress.score < task.points) : false,
              awardedPoints: showAnswers.value ? progress.score : 0,
              manualScore: progress.score || 0 // Для куратора
            }
          }
          return task
        })

      } catch (err) {
        console.error('Ошибка загрузки прогресса:', err)
      }
    }

    // Проверка статус выполнения домашнего задания
    const checkHomeworkCompletion = async () => {
      if (!user_id.value) return

      try {
        const { data: completionData, error: completionError } = await supabase
          .from(`${subject.value}_homework_completed`)
          .select('*')
          .eq('homework_id', homeworkId.value)
          .eq('user_id', user_id.value)
          .maybeSingle()

        if (completionError && completionError.code !== 'PGRST116') {
          console.error('Ошибка проверки статуса выполнения:', completionError)
          return
        }

        if (completionData) {
          isCompleted.value = completionData.is_completed
          totalScore.value = completionData.score || 0
          showAnswers.value = completionData.is_completed || isTutorMode.value // Показываем ответы в режиме куратора
        }

      } catch (err) {
        console.error('Ошибка проверки статуса выполнения:', err)
      }
    }

    // Открытие модального окна с изображением
    const openImageModal = (imageUrl) => {
      selectedImage.value = imageUrl
      showImageModal.value = true
      document.body.style.overflow = 'hidden'
    }

    const closeImageModal = () => {
      showImageModal.value = false
      document.body.style.overflow = ''
    }

    // Форматирование даты
    const formatDate = (dateString) => {
      if (!dateString) return 'Не указан'
      try {
        return new Date(dateString).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      } catch (err) {
        return 'Неверный формат даты'
      }
    }

    // Обновляем общий балл
    const updateTotalScore = () => {
      totalScore.value = tasks.value.reduce((sum, task) => sum + (task.awardedPoints || 0), 0)
    }

    // Статус дедлайна
    const deadlineStatus = computed(() => {
      const deadline = homeworkData.value.deadline
      if (!deadline) return 'no-deadline'
      
      try {
        const deadlineDate = new Date(deadline)
        const today = new Date()
        
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const deadlineDateOnly = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate())
        
        if (deadlineDateOnly < todayDate) return 'overdue'
        if (deadlineDateOnly.getTime() === todayDate.getTime()) return 'today'
        return 'future'
      } catch (err) {
        return 'no-deadline'
      }
    })

    // Отсортированные задания по номеру
    const sortedTasks = computed(() => {
      return [...tasks.value].sort((a, b) => a.number - b.number)
    })

    // Есть ли ответы на задания
    const hasAnswers = computed(() => {
      return tasks.value.some(task => task.userAnswer)
    })

    // Максимальный возможный балл
    const maxScore = computed(() => {
      return tasks.value.reduce((sum, task) => sum + (task.points || 0), 0)
    })

    // Статус задания
    const getTaskStatusClass = (task) => {
      if (!task.userAnswer) return 'status-not-completed'
      if (!showAnswers.value) return 'status-saved'
      if (task.isCorrect) return 'status-correct'
      if (task.isPartiallyCorrect) return 'status-partial'
      return 'status-incorrect'
    }

    const getTaskStatusText = (task) => {
      if (!task.userAnswer) return 'Не решено'
      if (!showAnswers.value) return 'Ответ сохранен'
      if (task.isCorrect) return `✓ Верно (${task.awardedPoints}/${task.points} балла)`
      if (task.isPartiallyCorrect) return `± Частично (${task.awardedPoints}/${task.points} балла)`
      return `✗ Неверно (0/${task.points} балла)`
    }

    // Класс для фидбека
    const getFeedbackClass = (task) => {
      if (task.isCorrect) return 'correct-feedback'
      if (task.isPartiallyCorrect) return 'partial-feedback'
      return 'incorrect-feedback'
    }

    const getFeedbackText = (task) => {
      return ''; // Текст отображается напрямую в шаблоне
    }

    // Следим за изменениями баллов
    onMounted(() => {
      if (subject.value && homeworkId.value) {
        fetchHomeworkTasks()
      } else {
        error.value = 'Не указаны параметры домашнего задания'
        loading.value = false
      }

        // Блокировка контекстного меню
      document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.task-text')) {
          e.preventDefault()
          return false
        }
      })
      
      // Блокировка выделения текста (опционально)
      document.addEventListener('selectstart', (e) => {
        if (e.target.closest('.task-text')) {
          e.preventDefault()
          return false
        }
      })
    })

    // Обновляем общий балл при измененияз
    watch(() => tasks.value.map(t => t.awardedPoints), () => {
      updateTotalScore()
    }, { deep: true })

    return {
      homeworkName: homeworkData.value.homework_name,
      homeworkData,
      sortedTasks,
      loading,
      error,
      isCompleted,
      totalScore,
      maxScore,
      showImageModal,
      selectedImage,
      showAnswers,
      sanitizeHtml,
      getImageUrl,
      getTaskTextWithoutTables,
      saveAnswer,
      completeHomework,
      formatDate,
      deadlineStatus,
      getTaskStatusClass,
      getTaskStatusText,
      getFeedbackClass,
      getFeedbackText,
      openImageModal,
      closeImageModal,
      hasAnswers,
      redirectToMenu, 
      isViewMode,
      isTutorMode,
      startEdit,
      cancelEdit,
      saveEditedAnswer,
      setTutorScore,
      updateHomeworkTotalScore
    }
  }
}
</script>

<template>
  <div class="allpage">
    <div class="topmenu">
      <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
      <div class="rightparttopmenu">
        <div class="redirect_menu" @click="redirectToMenu">На главную</div>
        <div class="go_back"><a href="index.html">Выйти</a></div>
      </div>
    </div> 
    
    <div class="centerpartpage">
      <div class="homework-content">
        <!-- Заголовок домашнего задания -->
        <div class="homework-header">
          <h1>{{ homeworkName }}</h1>
          <div v-if="isTutorMode" class="tutor-mode-banner">
            📝 Режим проверки куратора
          </div>
          <div class="homework-meta">
            <span class="lesson-info">Урок {{ homeworkData.lesson_number || 'Н/Д' }}: {{ homeworkData.lesson_name || 'Н/Д' }}</span>
            <span class="deadline" :class="deadlineStatus">
              Дедлайн: {{ formatDate(homeworkData.deadline) }}
            </span>
          </div>
        </div>

        <!-- Список заданий -->
        <div class="tasks-container">
          <div v-if="loading" class="loading">Загрузка заданий...</div>
          <div v-else-if="error" class="error">{{ error }}</div>
          
          <div v-else class="tasks-list">
            <div 
              v-for="task in sortedTasks" 
              :key="task.task_id"
              class="task-item"
              :class="{ 'extended-task': task.points > 1 }"
            >
              <div class="task-card">
                <div class="task-header">
                  <div class="task-meta">
                    <span class="task-topic">Тема: {{ task.topic }}</span>
                    <span class="task-id">#{{ task.number }} ({{ task.points }} балла)</span>
                  </div>
                  <div class="task-status" :class="getTaskStatusClass(task)">
                    {{ getTaskStatusText(task) }}
                  </div>
                </div>

                <div class="task-content">
                  <div 
                  class="task-text" 
                  v-html="sanitizeHtml(getTaskTextWithoutTables(task))"
                  @copy.prevent
                  @cut.prevent
                  @dragstart.prevent
                  ></div>
                  
                  <div v-if="task.has_table && task.table_data" class="task-table-container">
                    <table :class="{ 'with-borders': task.table_data.borders }">
                      <tr v-for="(row, rowIndex) in task.table_data.content" :key="'row-'+rowIndex">
                        <td v-for="(cell, colIndex) in row" :key="'cell-'+rowIndex+'-'+colIndex">
                          <div v-html="sanitizeHtml(cell || '&nbsp;')"></div>
                        </td>
                      </tr>
                    </table>
                  </div>
                  
                  <div class="task-images" v-if="task.images && task.images.length">
                    <div class="image-grid">
                      <div 
                        class="image-container" 
                        v-for="(image, index) in task.images" 
                        :key="index"
                      >
                        <img 
                          :src="getImageUrl(image)" 
                          :alt="'Изображение задания ' + task.number" 
                          class="task-image"
                          @click="openImageModal(getImageUrl(image))"
                          loading="lazy"
                        >
                      </div>
                    </div>
                  </div>

                  <div class="answer-section">
                    <!-- Режим редактирования -->
                    <div v-if="task.isEditing" class="edit-mode">
                      <div class="answer-input-container">
                        <input 
                          v-model="task.editAnswerInput" 
                          type="text" 
                          :placeholder="`Введите ответ (${task.points} балла)`" 
                          class="answer-input"
                          @keyup.enter="saveEditedAnswer(task)"
                          ref="editInput"
                        >
                        <button @click="saveEditedAnswer(task)" class="submit-button">Сохранить</button>
                        <button @click="cancelEdit(task)" class="cancel-button">Отмена</button>
                      </div>
                      <div v-if="task.saving" class="saving-status">Сохранение...</div>
                    </div>
                    
                    <!-- Режим ввода нового ответа -->
                    <div v-else-if="!task.userAnswer && !isViewMode && !isCompleted">
                      <div class="answer-input-container">
                        <input 
                          v-model="task.userAnswerInput" 
                          type="text" 
                          :placeholder="`Введите ответ (${task.points} балла)`" 
                          class="answer-input"
                          @keyup.enter="saveAnswer(task)"
                        >
                        <button @click="saveAnswer(task)" class="submit-button">Сохранить</button>
                      </div>
                      <div v-if="task.saving" class="saving-status">Сохранение...</div>
                    </div>
                    
                    <!-- Отображаем ответы только после завершения работы -->
                    <div v-else-if="(isCompleted || task.userAnswer) && showAnswers" class="answer-result">
                      <div class="answer-feedback" :class="getFeedbackClass(task)">
                        <div class="feedback-content">
                          <span v-if="task.isCorrect" class="correct-icon">✓</span>
                          <span v-else-if="task.isPartiallyCorrect" class="partial-icon">±</span>
                          <span v-else class="incorrect-icon">✗</span>
                          
                          <span class="user-answer-text">
                            <strong>Ответ студента:</strong> {{ task.userAnswer }}
                          </span>
                          
                          <span class="correct-answer-text">
                            <strong>Правильный ответ:</strong> {{ task.answer }}
                          </span>
                          
                          <!-- Панель оценки куратора для заданий второй части -->
                          <div v-if="isTutorMode && task.points > 1" class="tutor-scoring-panel">
                            <span class="score-label">Оценка куратора:</span>
                            <select 
                              v-model="task.manualScore" 
                              @change="setTutorScore(task, parseInt($event.target.value))"
                              class="score-select"
                              :disabled="task.saving"
                            >
                              <option v-for="n in task.points + 1" :value="n - 1" :key="n">
                                {{ n - 1 }} баллов
                              </option>
                            </select>
                            <span v-if="task.saving" class="saving-status">Сохранение...</span>
                          </div>
                          
                          <span class="current-score" v-if="task.awardedPoints !== null">
                            Набрано баллов: {{ task.awardedPoints }}/{{ task.points }}
                          </span>
                          
                          <!-- Кнопка редактирования (только если не завершено) -->
                          <button 
                            v-if="!isCompleted && !isTutorMode" 
                            @click="startEdit(task)" 
                            class="edit-answer-btn"
                            title="Редактировать ответ"
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Ответ сохранен, но домашнее задание не завершено -->
                    <div v-else-if="task.userAnswer && !showAnswers" class="answer-saved">
                      <span class="saved-icon">✓</span> Ответ сохранен
                      <button 
                        @click="startEdit(task)" 
                        class="edit-answer-btn"
                        title="Редактировать ответ"
                      >
                        ✏️
                      </button>
                    </div>
                    
                  </div>
                </div>

                <div v-if="task.userAnswer && task.explanation && showAnswers" class="explanation-section">
                  <div class="explanation-title">Пояснение:</div>
                  <div class="explanation-content" v-html="sanitizeHtml(task.explanation)"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Блок итоговой оценки куратора -->
        <div v-if="isTutorMode" class="tutor-final-assessment">
          <h3>Итоговая оценка</h3>
          <div class="final-score">
            Общий балл: {{ totalScore }}/{{ maxScore }}
          </div>
          <div class="tutor-actions">
            <button @click="updateHomeworkTotalScore" class="save-final-score-btn">
              Сохранить итоговую оценку
            </button>
          </div>
        </div>

        <!-- Кнопка завершения -->
        <div v-if="!isViewMode && !isCompleted && hasAnswers" class="completion-section">
          <button @click="completeHomework" class="complete-btn">
            Завершить домашнее задание
          </button>
        </div>

        <div v-if="isCompleted" class="completion-result">
          <h3>Домашнее задание завершено!</h3>
          <p>Набрано баллов: {{ totalScore }}/{{ maxScore }}</p>
        </div>
      </div>
    </div>

    <!-- Модальное окно для изображений -->
    <div v-if="showImageModal" class="image-modal" @click.self="closeImageModal">
      <div class="modal-content">
        <img :src="selectedImage" class="modal-image">
        <button class="close-modal" @click="closeImageModal">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Все стили остаются без изменений */
.homework-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: clamp(1rem, 3vw, 2rem);
}

.homework-header {
  margin-bottom: clamp(1.5rem, 4vw, 2rem);
  text-align: center;
}

.homework-header h1 {
  color: #333;
  font-size: clamp(1.8rem, 5vw, 2.5rem);
  margin-bottom: clamp(0.5rem, 2vw, 1rem);
  line-height: 1.2;
}

.homework-meta {
  display: flex;
  justify-content: center;
  gap: clamp(1rem, 3vw, 1.5rem);
  flex-wrap: wrap;
  align-items: center;
}

.lesson-info {
  color: #666;
  font-size: clamp(0.9rem, 2.5vw, 1.1rem);
}

.deadline {
  padding: 0.4rem 0.8rem;
  border-radius: 1rem;
  font-weight: 500;
  font-size: clamp(0.8rem, 2vw, 0.95rem);
}

.deadline.overdue {
  background-color: #ffebee;
  color: #d32f2f;
}

.deadline.today {
  background-color: #fff3e0;
  color: #f57c00;
}

.deadline.future {
  background-color: #e8f5e8;
  color: #388e3c;
}

.deadline.no-deadline {
  background-color: #f5f5f5;
  color: #757575;
}

.tasks-container {
  margin-bottom: clamp(1.5rem, 4vw, 2rem);
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: clamp(1rem, 3vw, 1.5rem);
}

.task-item {
  border: 1px solid #e0e0e0;
  border-radius: 0.8rem;
  padding: clamp(1rem, 3vw, 1.5rem);
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  width: 100%;
}

.task-header {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-bottom: 1rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #eee;
}

@media (min-width: 768px) {
  .task-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
  }
}

.task-meta {
  flex: 1;
  min-width: 0;
}

.task-topic {
  font-weight: 500;
  color: #333;
  font-size: clamp(1rem, 2.5vw, 1.2rem);
  display: block;
  line-height: 1.4;
  word-wrap: break-word;
}

.task-id {
  color: #888;
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  font-weight: bold;
  display: block;
  margin-top: 0.4rem;
}

.task-status {
  padding: 0.4rem 0.8rem;
  border-radius: 0.4rem;
  font-size: clamp(0.75rem, 2vw, 0.85rem);
  font-weight: bold;
  align-self: flex-start;
}

.status-not-completed {
  background: #f5f5f5;
  color: #666;
}

.status-correct {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-partial {
  background: #fff3e0;
  color: #ff8f00;
}

.status-incorrect {
  background: #ffebee;
  color: #c62828;
}

.task-content {
  margin-bottom: 1.2rem;
}

.task-text {
  line-height: 1.6;
  color: #333;
  margin-bottom: 1.2rem;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  width: 100%;
}

.task-text :deep(p) {
  margin-bottom: 0.8rem;
}

.task-text :deep(br) {
  content: "";
  display: block;
  margin-bottom: 0.4rem;
}

.task-text :deep(ul),
.task-text :deep(ol) {
  margin: 0.8rem 0;
  padding-left: 1.5rem;
}

.task-text :deep(li) {
  margin-bottom: 0.4rem;
}
/* Добавьте эти стили в секцию scoped */
.answer-feedback {
  padding: 0.75rem;
  border-radius: 0.4rem;
  font-weight: 500;
  margin-top: 0.9rem;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.correct-feedback {
  background-color: #e8f5e9;
  color: #2e7d32;
  border-left: 4px solid #2e7d32;
}

.partial-feedback {
  background-color: #fff3e0;
  color: #ff8f00;
  border-left: 4px solid #ff8f00;
}

.incorrect-feedback {
  background-color: #ffebee;
  color: #c62828;
  border-left: 4px solid #c62828;
}

.feedback-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.correct-icon, .partial-icon, .incorrect-icon {
  font-size: 1.2rem;
}

.correct-icon {
  color: #2e7d32;
}

.partial-icon {
  color: #ff8f00;
}

.incorrect-icon {
  color: #c62828;
}

/* Анимации */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Стили для выделения текста ответов */
.feedback-content strong {
  font-weight: 600;
}

.correct-feedback .feedback-content strong {
  color: #1b5e20;
}

.partial-feedback .feedback-content strong {
  color: #e65100;
}

.incorrect-feedback .feedback-content strong {
  color: #b71c1c;
}
.task-table-container {
  margin: 1.2rem 0;
  overflow-x: auto;
  width: 100%;
}

.task-table-container table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.2rem;
  min-width: 300px;
}

.task-table-container table.with-borders {
  border: 1px solid #ddd;
}

.task-table-container table.with-borders td {
  border: 1px solid #ddd;
  padding: 0.6rem;
}

.task-table-container td {
  padding: 0.6rem;
  vertical-align: top;
  font-size: clamp(0.9rem, 2vw, 1rem);
}

/* Улучшенные стили для изображений (перенесены из TaskCard) */
.task-images {
  margin-bottom: 1.25rem;
  width: 100%;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.8rem;
  margin-top: 0.8rem;
}

.image-container {
  position: relative;
  padding-top: 100%; /* Создает квадратный контейнер */
  overflow: hidden;
  border-radius: 0.4rem;
  border: 1px solid #eee;
  background: #f8f9fa;
  cursor: pointer;
}

.task-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover; /* Заполняет контейнер без искажений */
  transition: transform 0.3s ease;
}

.task-image:hover {
  transform: scale(1.03); /* Легкий эффект увеличения при наведении */
}

/* Стили для модального окна (уже есть, но на всякий случай) */
.image-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

.modal-content {
  position: relative;
  max-width: 95%;
  max-height: 95%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-image {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 0.4rem;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.6);
}

.close-modal {
  position: absolute;
  top: -1.5rem;
  right: -1.5rem;
  background: #b241d1;
  color: white;
  border: none;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  z-index: 10001;
}

.close-modal:hover {
  background: #9a36b8;
}

/* Адаптивность для модального окна */
@media (max-width: 768px) {
  .close-modal {
    top: -1rem;
    right: -1rem;
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.2rem;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}

.task-image:hover {
  transform: scale(1.05);
}

.answer-section {
  margin-top: 1.2rem;
  width: 100%;
}

.answer-input-container {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-bottom: 0.8rem;
  width: 100%;
}

@media (min-width: 480px) {
  .answer-input-container {
    flex-direction: row;
    align-items: center;
  }
}

.answer-input {
  flex: 1;
  padding: 0.8rem 1rem;
  border: 1px solid #ddd;
  border-radius: 0.4rem;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  min-width: 0;
  width: 100%;
}

.answer-input:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.2);
}

.submit-button {
  padding: 0.8rem 1.2rem;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 0.4rem;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  min-width: fit-content;
  white-space: nowrap;
}

.submit-button:hover {
  background-color: #9a36b8;
}

.answer-feedback {
  padding: 1rem;
  border-radius: 0.4rem;
  font-weight: 500;
  margin-top: 0.8rem;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  width: 100%;
}

.correct-feedback {
  background-color: #e8f5e9;
  color: #2e7d32;
  border-left: 4px solid #2e7d32;
}

.partial-feedback {
  background-color: #fff3e0;
  color: #ff8f00;
  border-left: 4px solid #ff8f00;
}

.incorrect-feedback {
  background-color: #ffebee;
  color: #c62828;
  border-left: 4px solid #c62828;
}

.feedback-content {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.correct-icon, .partial-icon, .incorrect-icon {
  font-size: 1.1rem;
  font-weight: bold;
}

.correct-answer {
  color: #2e7d32;
  background-color: #f0faf0;
  padding: 1rem;
  border-left: 4px solid #2e7d32;
  border-radius: 0.4rem;
  margin-top: 0.8rem;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
}

.explanation-section {
  margin-top: 1.5rem;
  padding: 1.2rem;
  background-color: #f8f9fa;
  border-radius: 0.4rem;
  border-left: 4px solid #b241d1;
  width: 100%;
}

.explanation-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.6rem;
  font-size: clamp(1rem, 2.5vw, 1.1rem);
}

.explanation-content {
  line-height: 1.6;
  color: #444;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
}

.completion-section {
  margin-top: 2rem;
  text-align: center;
  padding: 1.5rem;
  border-top: 2px solid #eee;
  width: 100%;
}

.complete-btn {
  padding: 1rem 2rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 0.6rem;
  font-size: clamp(1rem, 2.5vw, 1.1rem);
  cursor: pointer;
  transition: background-color 0.3s ease;
  min-width: min(100%, 300px);
}

.complete-btn:hover {
  background-color: #218838;
}

.completion-result {
  margin-top: 2rem;
  padding: 1.5rem;
  background-color: #e8f5e9;
  border-radius: 0.6rem;
  text-align: center;
  border-left: 4px solid #28a745;
  width: 100%;
}

.completion-result h3 {
  color: #2e7d32;
  margin-bottom: 0.8rem;
  font-size: clamp(1.2rem, 3vw, 1.5rem);
}

.completion-result p {
  color: #388e3c;
  font-size: clamp(1rem, 2.5vw, 1.1rem);
  font-weight: 500;
}

.loading, .error {
  text-align: center;
  padding: 2.5rem;
  font-size: clamp(1.1rem, 3vw, 1.3rem);
  width: 100%;
}

.error {
  color: #dc3545;
  background-color: #ffebee;
  border-radius: 0.6rem;
  border-left: 4px solid #dc3545;
}

.image-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

.modal-content {
  position: relative;
  max-width: 95%;
  max-height: 95%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-image {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 0.4rem;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.6);
}

.close-modal {
  position: absolute;
  top: -1.5rem;
  right: -1.5rem;
  background: #b241d1;
  color: white;
  border: none;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  z-index: 10001;
}

.close-modal:hover {
  background: #9a36b8;
}

@media (max-width: 768px) {
  .close-modal {
    top: -1rem;
    right: -1rem;
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.2rem;
  }
  
  .task-header {
    gap: 0.6rem;
  }
  
  .answer-input-container {
    gap: 0.6rem;
  }
}

/* Добавляем новые стили для функциональности куратора */

.tutor-mode-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.4rem;
  margin: 0.5rem 0;
  font-weight: bold;
  text-align: center;
}

.extended-task {
  border-left: 4px solid #667eea;
  background-color: #f8f9ff;
}

.tutor-scoring-panel {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-top: 0.8rem;
  padding: 0.8rem;
  background-color: rgba(102, 126, 234, 0.1);
  border-radius: 0.4rem;
  flex-wrap: wrap;
}

.score-label {
  font-weight: 600;
  color: #667eea;
}

.score-select {
  padding: 0.4rem 0.8rem;
  border: 1px solid #667eea;
  border-radius: 0.3rem;
  background: white;
  color: #333;
}

.score-select:focus {
  outline: none;
  border-color: #5a67d8;
  box-shadow: 0 0 0 2px rgba(90, 103, 216, 0.2);
}

.current-score {
  font-weight: 600;
  color: #4a5568;
  margin-left: auto;
}

.tutor-final-assessment {
  margin-top: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border-radius: 0.8rem;
  text-align: center;
}

.tutor-final-assessment h3 {
  margin-bottom: 1rem;
  font-size: 1.3rem;
}

.final-score {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.save-final-score-btn {
  padding: 0.8rem 1.5rem;
  background: white;
  color: #f5576c;
  border: none;
  border-radius: 0.4rem;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s;
}

.save-final-score-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Адаптивность для панели куратора */
@media (max-width: 768px) {
  .tutor-scoring-panel {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .current-score {
    margin-left: 0;
    margin-top: 0.5rem;
  }
  
  .score-select {
    width: 100%;
  }
}

/* Улучшаем визуальное выделение заданий второй части */
.extended-task .task-header {
  background-color: rgba(102, 126, 234, 0.05);
  padding: 1rem;
  margin: -1rem -1rem 1rem -1rem;
  border-radius: 0.8rem 0.8rem 0 0;
}

.extended-task .task-id {
  color: #667eea;
  font-weight: bold;
}
</style>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

@font-face {
  font-family: Evolventa;
  src: local("Evolventa"), url("/src/assets/evolventa/Evolventa-Regular.woff");
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: Evolventa;
  src: local("Evolventa Oblique"), url("/src/assets/evolventa/Evolventa-Oblique.woff");
  font-weight: normal;
  font-style: italic;
}

@font-face {
  font-family: Evolventa;
  src: local("Evolventa Bold"), url("/src/assets/evolventa/Evolventa-Bold.woff");
  font-weight: bold;
  font-style: normal;
}

@font-face {
  font-family: Evolventa;
  src: local("Evolventa Bold Oblique"), url("/src/assets/evolventa/Evolventa-BoldOblique.woff");
  font-weight: bold;
  font-style: italic;
}

* {
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  background: white;
  width: 100%;
  min-height: 100vh;
  line-height: 1.4;
}

a {
  color: white;
  text-decoration: none;
}

.allpage {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.topmenu {
  width: 100%;
  padding: clamp(0.8rem, 2vw, 1rem) clamp(1rem, 5%, 2rem);
  color: white;
  font-size: clamp(1rem, 2vw, 1.4rem);
  background-image: url(./assets/background_line.png);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.logo {
  font-weight: bold;
  white-space: nowrap;
}

.rightparttopmenu {
  display: flex;
  gap: clamp(1rem, 3vw, 2rem);
  align-items: center;
  flex-wrap: wrap;
  font-size: clamp(0.9rem, 1.8vw, 1.1rem);
}

.redirect_menu, .go_back {
  padding: 0.5rem 1rem;
  border-radius: 0.4rem;
  transition: background-color 0.2s;
  cursor: pointer;
}

.redirect_menu:hover, .go_back:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.centerpartpage {
  flex: 1;
  width: 100%;
  padding: clamp(1rem, 3vw, 2rem);
  display: flex;
  justify-content: center;
}

.mainpart {
  width: 100%;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: clamp(1rem, 3vw, 2rem);
}

@media (max-width: 768px) {
  .topmenu {
    flex-direction: column;
    text-align: center;
    gap: 0.8rem;
  }
  
  .rightparttopmenu {
    justify-content: center;
  }
  
  .homework-content {
    padding: 1rem;
  }
  
  .task-item {
    padding: 1rem;
    margin: 0 -0.5rem;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
}

@media (max-width: 480px) {
  .homework-header h1 {
    font-size: 1.5rem;
  }
  
  .homework-meta {
    flex-direction: column;
    gap: 0.8rem;
  }
  
  .task-status {
    align-self: stretch;
    text-align: center;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  }
}
.task-text {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: default;
}

.task-text ::selection {
  background: transparent;
}

.task-text ::-moz-selection {
  background: transparent;
}

/* Дополнительная защита через псевдо-элемент */
.task-text {
  position: relative;
}

.task-text::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
}


/* Добавляем новые стили для функциональности редактирования */

.edit-mode {
  margin-top: 1rem;
}

.saved-answer-content {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem;
  background-color: #f8f9fa;
  border-radius: 0.4rem;
  border-left: 3px solid #b241d1;
}

.answer-text {
  flex: 1;
  font-weight: 500;
  color: #333;
}

.edit-answer-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 0.3rem;
  font-size: 1.1rem;
  transition: background-color 0.2s;
}

.edit-answer-btn:hover {
  background-color: rgba(178, 65, 209, 0.1);
}

.cancel-button {
  padding: 0.8rem 1.2rem;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 0.4rem;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  min-width: fit-content;
  white-space: nowrap;
}

.cancel-button:hover {
  background-color: #5a6268;
}

/* Адаптивность для кнопок редактирования */
@media (max-width: 480px) {
  .answer-input-container {
    flex-direction: column;
  }
  
  .saved-answer-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .edit-answer-btn {
    align-self: flex-end;
  }
}
</style>