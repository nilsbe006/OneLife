// Öffentliche Konfiguration. Hier stehen KEINE Passwörter.
// Die Firebase-Web-Konfiguration ist laut Firebase für den Browser gedacht
// (https://firebase.google.com/docs/projects/api-keys). Geschützt werden die
// Daten über die Firestore Security Rules (firebase/firestore.rules).
export const CONFIG = {
  firebase: {
    apiKey: 'AIzaSyDyx8vfZxi3L8nDL9ZxTOM4Lt8pdfdCQls',
    authDomain: 'onelife-164d7.firebaseapp.com',
    projectId: 'onelife-164d7',
    storageBucket: 'onelife-164d7.firebasestorage.app',
    messagingSenderId: '734025775754',
    appId: '1:734025775754:web:eca4c43f2e836aef804b73',
  },
  homeBase: { name: 'Ulm', lat: 48.4011, lng: 9.9876 },
};
