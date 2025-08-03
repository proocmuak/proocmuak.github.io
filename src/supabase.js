import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mltqewxnxinaytavbmds.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sdHFld3hueGluYXl0YXZibWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzMyMTYsImV4cCI6MjA2OTc0OTIxNn0.YCH1G-aDCCc_bse_uVhxqBj4slsN-iDiFdoYZ1Qwsm8' // из настроек проекта



export const supabase = createClient(supabaseUrl, supabaseKey)