// src/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mltqewxnxinaytavbmds.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sdHFld3hueGluYXl0YXZibWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzMyMTYsImV4cCI6MjA2OTc0OTIxNn0.YCH1G-aDCCc_bse_uVhxqBj4slsN-iDiFdoYZ1Qwsm8'

// Клиент Supabase для работы с таблицами
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Вызов edge-функции
 * @param {string} fnName - имя функции
 * @param {object} body - тело запроса
 */
// src/supabase.js
// src/supabase.js
export async function callFunction(fnName, body) {
  try {
    console.log('Calling function:', fnName, 'with body:', body)
    
    const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(body),
    })

    console.log('Response status:', res.status, res.statusText)
    
    if (!res.ok) {
      // Если это CORS ошибка, попробуем получить текст ответа
      let errorText = 'Unknown error'
      try {
        errorText = await res.text()
      } catch (e) {
        errorText = `CORS error or network issue: ${res.status} ${res.statusText}`
      }
      
      console.error('Function error details:', errorText)
      throw new Error(`Function call failed: ${res.status} ${res.statusText} - ${errorText}`)
    }

    const data = await res.json()
    console.log('Function response:', data)
    return data
    
  } catch (err) {
    console.error('Call function error:', err)
    throw err
  }
}