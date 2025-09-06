import { createClient } from "@supabase/supabase-js";

// === ВСТАВЬ свои ключи ===
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ================== УТИЛИТЫ ==================

function isDigitSequence(s) {
  return typeof s === 'string' && /^[0-9\s,;]+$/.test(s.trim());
}

function splitNumericElements(s) {
  s = String(s || '').trim();
  if (!s) return [];
  if (/[^0-9]/.test(s)) {
    const tokens = s.split(/[^0-9]+/).filter(Boolean);
    if (tokens.length > 0) return tokens;
  }
  return s.split('');
}

function freqMap(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return m;
}

function checkPartialMatch(userAnswer, correctAnswer, maxPoints = 2, options = { allowExtra: false }) {
  if (userAnswer == null || correctAnswer == null) return false;
  if (!isDigitSequence(String(userAnswer)) || !isDigitSequence(String(correctAnswer))) {
    return false;
  }

  const correctElems = splitNumericElements(correctAnswer);
  const userElems = splitNumericElements(userAnswer);

  if (!options.allowExtra && userElems.length > correctElems.length) return false;

  const fc = freqMap(correctElems);
  const fu = freqMap(userElems);

  let matched = 0;
  for (const [k, cnt] of fc.entries()) {
    if (fu.has(k)) matched += Math.min(cnt, fu.get(k));
  }

  const mistakes = correctElems.length - matched;
  if (mistakes === 0) return true;
  if (maxPoints === 2 && mistakes === 1) return true;
  return false;
}

function normalizeText(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function splitVariants(correctAnswer) {
  return correctAnswer
    .split(/\/|или/i)
    .map(v => normalizeText(v))
    .filter(Boolean);
}

function checkTextAnswer(userAnswer, correctAnswer) {
  if (!userAnswer || !correctAnswer) return false;
  const normalizedUser = normalizeText(userAnswer);
  const variants = splitVariants(correctAnswer);
  return variants.includes(normalizedUser);
}

// ================== ПЕРЕПРОВЕРКА ==================

async function recheckSubject(subject) {
  const progressTable = `${subject}_progress`;
  const taskBankTable = `${subject}_ege_task_bank`;

  console.log(`\n=== Перепроверка для предмета: ${subject} ===`);

  // 1. Достаем все записи прогресса
  const { data: progress, error: progressErr } = await supabase
    .from(progressTable)
    .select("*");

  if (progressErr) {
    console.error("Ошибка загрузки прогресса:", progressErr);
    return;
  }

  for (const record of progress) {
    // 2. Достаем задание
    const { data: taskData, error: taskErr } = await supabase
      .from(taskBankTable)
      .select("answer, points")
      .eq("task_id", record.task_id)
      .single();

    if (taskErr || !taskData) {
      console.warn(`Нет задания для task_id=${record.task_id}`);
      continue;
    }

    const correctRaw = String(taskData.answer || '').trim();
    const userRaw = String(record.user_answer || '').trim();
    let isCorrect = false;
    let isPartiallyCorrect = false;

    if (isDigitSequence(correctRaw) && isDigitSequence(userRaw)) {
      const normalizeForEquality = (s) => splitNumericElements(s).join('');
      const normalizedCorrect = normalizeForEquality(correctRaw);
      const normalizedUser = normalizeForEquality(userRaw);

      isCorrect = normalizedUser === normalizedCorrect;
      if (!isCorrect && taskData.points === 2) {
        isPartiallyCorrect = checkPartialMatch(userRaw, correctRaw, taskData.points);
      }
    } else {
      isCorrect = checkTextAnswer(userRaw, correctRaw);
    }

    const score = isCorrect ? taskData.points : isPartiallyCorrect ? 1 : 0;

    // 3. Обновляем запись
    const { error: updateErr } = await supabase
      .from(progressTable)
      .update({
        score,
        is_completed: isCorrect || isPartiallyCorrect,
        last_updated: new Date().toISOString()
      })
      .eq("user_id", record.user_id)
      .eq("task_id", record.task_id);

    if (updateErr) {
      console.error(`Ошибка обновления user_id=${record.user_id}, task_id=${record.task_id}:`, updateErr);
    }
  }

  console.log(`Готово для ${subject}!`);
}

// ================== ЗАПУСК ==================

async function main() {
  const subjects = ["chemistry", "biology"];

  for (const subject of subjects) {
    await recheckSubject(subject);
  }

  console.log("\n=== Перепроверка завершена ===");
}

main();
