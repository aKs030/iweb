import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAdkQKb...",
  authDomain: "snake-ed264.firebaseapp.com",
  projectId: "snake-ed264",
  storageBucket: "snake-ed264.appspot.com",
  messagingSenderId: "95766919512",
  appId: "1:95766919512:web:78498968a8383721cecd2d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function saveScore(name, score) {
  try {
    await addDoc(collection(db, "scores"), { name, score, timestamp: new Date() });
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
  }
}

export async function fetchTopScores() {
  const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(3));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data());
}