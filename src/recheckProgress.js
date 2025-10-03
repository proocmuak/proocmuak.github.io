import { supabase } from './supabase.js'

// === список заданий с учётом порядка ===
const ORDERED_TASKS = {
  chemistry: [6, 7, 8, 14, 15, 22, 23, 24],
  biology: [2, 6, 8, 10, 12, 14, 16, 19, 20]
}

// === нормализация номера ===
function normalizeTaskNumber(taskNumber) {
  if (taskNumber == null) return null
  const s = String(taskNumber).trim()
  const m = s.match(/\d+/)
  if (!m) return null
  const n = parseInt(m[0], 10)
  return Number.isNaN(n) ? null : n
}

// === короткий subject из названия таблицы ===
function shortSubjectFromProgressTable(progressTableName) {
  const s = String(progressTableName).toLowerCase()
  if (s.includes('chemistry')) return 'chemistry'
  if (s.includes('biology')) return 'biology'
  return null
}

// === вспомогательные функции ===
function splitAnswerVariantsRaw(raw) {
  if (!raw) return []
  return String(raw)
    .split(/[/]|ИЛИ/i)
    .map(s => s.trim())
    .filter(Boolean)
}

function isDigitSequence(s) {
  return /^[0-9]+$/.test(s)
}

function splitNumericElements(s) {
  return s.split('').filter(ch => /\d/.test(ch))
}

function normalizeText(s) {
  return s.toLowerCase().replace(/\s+/g, '')
}

// === проверка числовых ответов ===
function checkNumericAnswer(userRaw, variant, points, orderMatters) {
  const userElems = splitNumericElements(userRaw)
  const correctElems = splitNumericElements(variant)

  if (orderMatters) {
    // порядок обязателен
    let matches = 0
    for (let i = 0; i < correctElems.length; i++) {
      if (userElems[i] === correctElems[i]) matches++
    }
    const mistakes = correctElems.length - matches
    if (mistakes === 0) {
      return { correct: true, partial: false }
    }
    if (points === 2 && mistakes === 1) {
      return { correct: false, partial: true }
    }
  } else {
    if (points === 1 && correctElems.length === userElems.length) {
      let matches = 0
      for (let i = 0; i < correctElems.length; i++) {
        if (userElems[i] === correctElems[i]) matches++
      }
      if (matches === correctElems.length) {
        return { correct: true, partial: false }
      }
    }

    if (points === 2) {
      // порядок НЕ важен
      const sortedCorrect = [...correctElems].sort()
      const sortedUser = [...userElems].sort()

      if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)) {
        return { correct: true, partial: false }
      }

      // частичное совпадение
      const matches = userElems.filter(e => correctElems.includes(e)).length
      if (
        ((matches === userElems.length || matches === correctElems.length) &&
          Math.abs(correctElems.length - userElems.length) === 1) ||
        Math.abs(matches - correctElems.length) === 1
      ) {
        return { correct: false, partial: true }
      }
    }
  }

  return { correct: false, partial: false }
}

// === проверка ответа ===
function checkAnswer(userAnswerRaw, correctAnswerRaw, points, shortSubject, taskNumberRaw, taskId = null) {
  const userRaw = userAnswerRaw == null ? '' : String(userAnswerRaw).trim()
  if (!userRaw) {
    return { score: 0, isCorrect: false, isPartiallyCorrect: false }
  }

  const variants = splitAnswerVariantsRaw(correctAnswerRaw)
  let anyCorrect = false
  let anyPartial = false

  const taskNum = normalizeTaskNumber(taskNumberRaw)
  let orderMatters = false
  if (points === 2 && shortSubject && taskNum != null) {
    orderMatters = ORDERED_TASKS[shortSubject]?.includes(taskNum) || false
  }

  for (const variant of variants) {
    if (isDigitSequence(variant) && isDigitSequence(userRaw)) {
      const { correct, partial } = checkNumericAnswer(userRaw, variant, points, orderMatters)
      if (correct) {
        anyCorrect = true
        break
      }
      if (partial) {
        anyPartial = true
      }
    } else {
      if (normalizeText(userRaw) === normalizeText(variant)) {
        anyCorrect = true
        break
      }
    }
  }

  const isCorrect = anyCorrect
  const isPartiallyCorrect = !isCorrect && anyPartial
  const score = isCorrect ? points : isPartiallyCorrect ? 1 : 0

  return { score, isCorrect, isPartiallyCorrect }
}

// === простой прогресс-бар ===
function createProgressBar(total, description = 'Processing') {
  let current = 0
  const startTime = Date.now()
  
  return {
    tick: () => {
      current++
      const percent = Math.min(100, Math.round((current / total) * 100))
      const elapsed = Date.now() - startTime
      const rate = current / (elapsed / 1000)
      
      if (current % 100 === 0 || current === total) {
        process.stdout.write(`\r${description}: ${percent}% | ${current}/${total} | ${rate.toFixed(1)}/sec`)
      }
      
      if (current === total) {
        process.stdout.write('\n')
      }
    }
  }
}

// === основная функция перепроверки ===
async function recheckSubjectProgress(subject) {
  const progressTable = `${subject}_progress`
  const taskBank = `${subject}_task_bank`
  const shortSubject = shortSubjectFromProgressTable(progressTable)

  console.log(`\n=== Перепроверка ${subject} (только первая часть) ===`)

  try {
    // 1. Получаем все задания первой части
    console.log('📚 Загрузка заданий первой части...')
    const { data: firstPartTasks, error: tasksError } = await supabase
      .from(taskBank)
      .select('id, answer, points, number, part')
      .eq('part', 'Первая часть')

    if (tasksError) {
      console.error('❌ Ошибка загрузки заданий:', tasksError)
      return
    }

    if (!firstPartTasks || firstPartTasks.length === 0) {
      console.log('⚠️ Нет заданий первой части')
      return
    }

    console.log(`✅ Загружено ${firstPartTasks.length} заданий первой части`)

    // Создаем Map для быстрого поиска
    const tasksMap = new Map(firstPartTasks.map(task => [task.id, task]))

    // 2. Получаем все записи прогресса (пагинация)
    let allProgress = []
    let from = 0
    const pageSize = 1000

    console.log('📥 Загрузка записей прогресса...')
    
    while (true) {
      const { data, error } = await supabase
        .from(progressTable)
        .select('id, user_id, task_id, is_completed, score, user_answer, counted_in_rating')
        .range(from, from + pageSize - 1)

      if (error) {
        console.error('❌ Ошибка загрузки прогресса:', error)
        break
      }

      if (!data || data.length === 0) break

      allProgress = allProgress.concat(data)
      from += pageSize
      
      process.stdout.write(`\rЗагружено записей: ${allProgress.length}`)
    }

    console.log(`\n✅ Всего загружено ${allProgress.length} записей прогресса`)

    // 3. Фильтруем только записи для первой части
    const relevantProgress = allProgress.filter(prog => tasksMap.has(prog.task_id))
    console.log(`🔍 Из них относятся к первой части: ${relevantProgress.length}`)

    if (relevantProgress.length === 0) {
      console.log('⚠️ Нет записей для перепроверки')
      return
    }

    // 4. Перепроверяем записи
    const progressBar = createProgressBar(relevantProgress.length, 'Перепроверка')
    let updatedCount = 0
    let unchangedCount = 0

    for (const prog of relevantProgress) {
      const task = tasksMap.get(prog.task_id)
      
      const result = checkAnswer(
        prog.user_answer,
        task.answer,
        task.points,
        shortSubject,
        task.number,
        prog.task_id
      )

      const newCountedInrating = result.isCorrect

      const needsUpdate = 
        result.score !== prog.score || 
        result.isCorrect !== prog.is_completed ||
        newCountedInrating !== prog.counted_in_rating

      if (needsUpdate) {
        // Обновляем каждую запись отдельно (для надежности)
        const { error } = await supabase
          .from(progressTable)
          .update({
            score: result.score,
            is_completed: result.isCorrect,
            counted_in_rating: newCountedInrating,
            last_updated: new Date().toISOString()
          })
          .eq('id', prog.id)

        if (!error) {
          updatedCount++
        }
      } else {
        unchangedCount++
      }

      progressBar.tick()
    }

    console.log(`\n✅ Перепроверка ${subject} завершена!`)
    console.log(`📊 Результаты:`)
    console.log(`   - Обновлено: ${updatedCount}`)
    console.log(`   - Без изменений: ${unchangedCount}`)
    console.log(`   - Пропущено: ${allProgress.length - relevantProgress.length}`)

  } catch (error) {
    console.error(`💥 Критическая ошибка в ${subject}:`, error)
  }
}

// === последовательный запуск ===
async function main() {
  console.log('🚀 Запуск перепроверки...')
  
  const subjects = ['biology_ege', 'chemistry_ege']
  
  for (const subject of subjects) {
    await recheckSubjectProgress(subject)
  }
  
  console.log('\n🎉 Все операции завершены!')
}

// Запускаем
main().catch(console.error)