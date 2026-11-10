// Öffentliche Konfiguration. Hier stehen KEINE Passwörter.
// Supabase-URL und anon/publishable Key sind für den Browser gedacht;
// der Datenschutz erfolgt über Row Level Security in der Datenbank.
export const CONFIG = {
  supabaseUrl: '',      // wird in Phase 2 eingetragen
  supabaseAnonKey: '',  // wird in Phase 2 eingetragen
  homeBase: { name: 'Ulm', lat: 48.4011, lng: 9.9876 },
};
