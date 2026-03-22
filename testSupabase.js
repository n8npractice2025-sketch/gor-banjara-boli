import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://njyjtptsntaoovvwshud.supabase.co';
const supabaseKey = 'sb_publishable_dEtJXZH72BcFCc3j3jOCGQ_DjkQjLTK';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data: files, error } = await supabase.storage.from('audio-recordings').list();
  if (error) {
      console.log('Error listing files:', error);
  } else {
      console.log('Files in audio-recordings bucket:');
      console.log(JSON.stringify(files.slice(0, 20), null, 2));
      console.log(`Total files found: ${files.length}`);
  }
}

checkData();
