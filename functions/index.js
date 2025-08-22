// functions/index.js
import { onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();

async function isAdmin(uid){
  if(!uid) return false;
  try{
    const snap = await getFirestore().doc(`players/${uid}`).get();
    const data = snap.exists ? (snap.data()||{}) : {};
    return data.isAdmin === true || data.role === 'admin';
  }catch{ return false; }
}

async function deletePlayerData(uid){
  const db = getFirestore();
  // TODO: si tu as des sous-collections (ex: logs, inventory), supprime-les ici
  await db.doc(`players/${uid}`).delete().catch(()=>{});
}

/** Admin supprime n'importe quel compte (sauf admin) */
export const adminDeleteUser = onCall({ cors: true, region: "europe-west1" }, async (req) => {
  const requester = req.auth?.uid;
  if(!requester) throw new Error("Non authentifié");

  if(!(await isAdmin(requester))) throw new Error("Accès refusé: admin requis");

  const targetUid = req.data?.targetUid;
  if(!targetUid) throw new Error("Paramètre 'targetUid' manquant");

  const targetSnap = await getFirestore().doc(`players/${targetUid}`).get();
  const targetData = targetSnap.exists ? (targetSnap.data()||{}) : {};
  if(targetData.isAdmin === true || targetData.role === 'admin'){
    throw new Error("Impossible de supprimer un compte admin");
  }

  // 1) Auth
  try{ await getAuth().deleteUser(targetUid); }catch(e){ if(e?.code !== 'auth/user-not-found') throw e; }
  // 2) Données
  await deletePlayerData(targetUid);

  return { ok:true };
});

/** Un utilisateur supprime SON propre compte (pas besoin d'être admin) */
export const userDeleteSelf = onCall({ cors: true, region: "europe-west1" }, async (req) => {
  const uid = req.auth?.uid;
  if(!uid) throw new Error("Non authentifié");

  // 1) Auth
  try{ await getAuth().deleteUser(uid); }catch(e){ if(e?.code !== 'auth/user-not-found') throw e; }
  // 2) Données
  await deletePlayerData(uid);

  return { ok:true };
});
