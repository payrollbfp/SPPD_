const sb = supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);

async function testSupabase(){
  const { data, error } = await sb.from('employees').select('id,nama,lokasi_kerja').limit(3);
  if(error) {
    console.error(error);
    alert('Koneksi Supabase gagal: '+error.message);
    return;
  }
  console.log('Supabase connected:', data);
}
testSupabase();
