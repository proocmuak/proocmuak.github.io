// checkAnswer.js

// === список заданий с учётом порядка ===
const ORDERED_TASKS = {
  chemistry: [6, 7, 8, 14, 15, 22, 23, 24],
  biology: [2, 6, 8, 10, 12, 14, 16, 19, 20],
}

// === нормализация номера ===
export function normalizeTaskNumber(taskNumber) {
  if (taskNumber == null) return null
  const s = String(taskNumber).trim()
  const m = s.match(/\d+/)
  if (!m) return null
  const n = parseInt(m[0], 10)
  return Number.isNaN(n) ? null : n
}

// === короткий subject из названия таблицы ===
export function shortSubjectFromProgressTable(progressTableName) {
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

// === главная функция проверки ===
export function checkAnswer(
  userAnswerRaw,
  correctAnswerRaw,
  points,
  shortSubject,
  taskNumberRaw,
  taskId = null
) {
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
      const { correct, partial } = checkNumericAnswer(
        userRaw,
        variant,
        points,
        orderMatters
      )
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
