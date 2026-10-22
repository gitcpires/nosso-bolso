const admin = require("firebase-admin");

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawCredentials) throw new Error("Variavel FIREBASE_SERVICE_ACCOUNT ausente.");
    let serviceAccount = JSON.parse(rawCredentials);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin;
}

exports.handler = async function(event, context) {
  try {
    const firebaseAdmin = getFirebaseAdmin();
    const db = firebaseAdmin.firestore();
    
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ error: "Token em falta." }) };
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const adminUid = process.env.ADMIN_UID ? process.env.ADMIN_UID.trim() : "";

    console.log("LOG DE AUTENTICAÇÃO:", { uidLogado: uid, adminEnv: adminUid });

    let isAdmin = (uid === adminUid);
    if (!isAdmin) {
      const userDoc = await db.collection('usuarios').doc(uid).get();
      if (userDoc.exists && userDoc.data().status === 'admin') {
        isAdmin = true;
      }
    }

    if (!isAdmin) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: "Acesso bloqueado.", debugUid: uid, debugAdminEnv: adminUid }) 
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Acesso autorizado", uid: uid })
    };

  } catch (error) {
    console.error("Erro:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
