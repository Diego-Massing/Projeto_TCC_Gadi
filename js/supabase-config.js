// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://gqoefhecnsayjxyoutzo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxb2VmaGVjbnNheWp4eW91dHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5Njk3MTIsImV4cCI6MjA4NjU0NTcxMn0.WKJD2b59-pDXWXb0tDPPfXwu7GNncY_BHBjyBe9hY4k';

// The CDN script puts the Supabase library at window.supabase
// We create the client and replace window.supabase with the client instance
// so all code can use 'supabase.auth', 'supabase.from()' etc. directly
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
