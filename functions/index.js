import { onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();

async function isAdmin(uid){
  if(!uid) return false;
  const snap = await getFirestore().doc(`players/${uid}`).get();
  const data = snap.exists ? (snap.data()||{}) : {};
  return data.isAdmin === true || data.role === 'admin';
}

async function deletePlayerData(uid){
  const db = getFirestore();
  // TODO: supprimer ici les sous-collections si tu en as
  await db.doc(`players/${uid}`).delete().catch(()=>{});
}

export const adminDeleteUser = onCall({
  region: "europe-west1",
  // Autorise UNIQUEMENT tes origines (Vercel + localhost)
  cors: ["https://grimoire-dusky.vercel.app", /^https?:\/\/localhost(:\d+)?$/]
}, async (req) => {
  const requester = req.auth?.uid;
  if(!requester) throw new Error("Non authentifié");
  if(!(await isAdmin(requester))) throw new Error("Accès refusé (admin requis)");

  const targetUid = req.data?.targetUid;
  if(!targetUid) throw new Error("UID manquant");

  // Ne pas supprimer un admin
  const tSnap = await getFirestore().doc(`players/${targetUid}`).get();
  const tData = tSnap.exists ? (tSnap.data()||{}) : {};
  if(tData.isAdmin===true || tData.role==='admin') throw new Error("Impossible de supprimer un compte admin");

  try{ await getAuth().deleteUser(targetUid); }catch(e){ if(e?.code!=='auth/user-not-found') throw e; }
  await deletePlayerData(targetUid);
  return { ok:true };
});
