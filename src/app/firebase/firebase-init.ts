import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: "AIzaSyCpvLMjXAbj17FORPybFx2SXh_nHvL6U1k",
  authDomain: "page-builder-codex.firebaseapp.com",
  projectId: "page-builder-codex",
  storageBucket: "page-builder-codex.firebasestorage.app",
  messagingSenderId: "458631321358",
  appId: "1:458631321358:web:21fa8b025c6ad138bf695f",
  measurementId: "G-MLHJETME7B"
};

export const firebaseApp = initializeApp(firebaseConfig);
