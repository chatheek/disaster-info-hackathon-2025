import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://utgogjwjzbiysqthtzjp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z29nandqemJpeXNxdGh0empwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDgwMTYsImV4cCI6MjA4MTE4NDAxNn0.Lc4mtyeMsWWvHk9Mxlmrfi1VfzcL6DwweF6c9Gnx1sg'

export const supabase = createClient(supabaseUrl, supabaseKey)