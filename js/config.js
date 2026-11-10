// Öffentliche Konfiguration. Hier stehen KEINE Passwörter.
// Die Firebase-Web-Konfiguration ist laut Firebase für den Browser gedacht;
// der Datenschutz erfolgt über die Firestore Security Rules.
export const CONFIG = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  }, // wird in Phase 2 eingetragen
  homeBase: { name: 'Ulm', lat: 48.4011, lng: 9.9876 },
};
