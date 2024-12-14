import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAdkQKbKU854FSaXIttjg30xh4DVGdj-Es",
  authDomain: "snake-ed264.firebaseapp.com",
  projectId: "snake-ed264",
  storageBucket: "snake-ed264.firebasestorage.app",
  messagingSenderId: "95766919512",
  appId: "1:95766919512:web:78498968a8383721cecd2d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function saveScore(name, score) {
  try {
    await addDoc(collection(db, "scores"), { name, score });
  } catch (error) {
    console.error("Fehler beim Speichern des Scores:", error);
  }
}

export async function fetchScores() {
  const scores = [];
  try {
    const querySnapshot = await getDocs(collection(db, "scores"));
    querySnapshot.forEach(doc => scores.push({ name: doc.data().name, score: doc.data().score }));
    scores.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error("Fehler beim Abrufen der Scores:", error);
  }
  return scores.slice(0, 3); // Nur die Top 3 Scores
}