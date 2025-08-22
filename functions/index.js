import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();

async function isAdmin(uid){
  try{
    const snap = await getFirestore().doc(`players/${uid}`).get();
    if(!snap.exists) return false;
    const data = snap.data() || {};
    return data.isAdmin === true || data.role === 'admin';
  }catch(err){
    console.error("[isAdmin] Firestore error:", err);
    // on ne bloque pas sur une lecture ratée, mais on est prudent
    return false;
  }
}

async function deletePlayerDoc(uid){
  const db = getFirestore();
  // TODO: si tu as des sous-collections (logs, inventory...), supprime-les ici
  try{
    await db.doc(`players/${uid}`).delete();
  }catch(err){
    console.error("[deletePlayerDoc] delete players doc failed:", err);
    // Si le doc n'existe pas, ce n'est pas bloquant
    if (!(err && (err.code === 5 || err.code === "not-found"))) { // Firestore gRPC: 5
      throw err;
    }
  }
}

export const adminDeleteUser = onCall({
  region: "europe-west1",
  cors: ["https://grimoire-dusky.vercel.app", /^https?:\/\/localhost(:\\d+)?$/]
}, async (req) => {
  console.log("[adminDeleteUser] start", { origin: req.rawRequest?.headers?.origin, caller: req.auth?.uid });

  // 1) Auth requise
  const requesterUid = req.auth?.uid;
  if(!requesterUid){
    throw new HttpsError("unauthenticated", "Non authentifié");
  }

  // 2) Vérif admin
  const allowed = await isAdmin(requesterUid);
  if(!allowed){
    throw new HttpsError("permission-denied", "Accès refusé: admin requis");
  }

  // 3) Paramètre cible
  const targetUid = req.data?.targetUid;
  if(!targetUid){
    throw new HttpsError("invalid-argument", "Paramètre 'targetUid' manquant");
  }

  // 4) Ne pas supprimer un admin
  try{
    const tSnap = await getFirestore().doc(`players/${targetUid}`).get();
    const tData = tSnap.exists ? (tSnap.data()||{}) : {};
    if(tData.isAdmin === true || tData.role === "admin"){
      throw new HttpsError("failed-precondition", "Impossible de sup
