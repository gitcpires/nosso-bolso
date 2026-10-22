const admin = require("firebase-admin");

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawCredentials) throw new Error("Variavel FIREBASE_SERVICE_ACCOUNT ausente.");
    
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(rawCredentials);
    } catch (err) {
      try {
        serviceAccount = JSON.parse(rawCredentials.replace(/\\n/g, '\n'));
      } catch (e) {
        const projectIdMatch = rawCredentials.match(/"project_id"\s*:\s*"([^"]+)"/);
        const clientEmailMatch = rawCredentials.match(/"client_email"\s*:\s*"([^"]+)"/);
        const privateKeyMatch = rawCredentials.match(/"private_key"\s*:\s*"([^"]+)"/);
        if (!projectIdMatch || !clientEmailMatch || !privateKeyMatch) throw new Error("Chave corrompida.");
        serviceAccount = { 
          projectId: projectIdMatch[1], 
          clientEmail: clientEmailMatch[1], 
          privateKey: privateKeyMatch[1].replace(/\\n/g, '\n') 
        };
      }
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin;
}

exports.handler = async function(event, context) {
  try {
    const firebaseAdmin = getFirebaseAdmin();
    const db = firebaseAdmin.firestore();
    
    // Verifica o cabeçalho de autorização enviado pelo front-end
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ error: "Não autorizado. Token em falta." }) };
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const adminUid = process.env.ADMIN_UID;

    // Se for o admin configurado ou se existir na coleção usuarios com status admin
    let isAdmin = (uid === adminUid);
    if (!isAdmin) {
      const userDoc = await db.collection('usuarios').doc(uid).get();
      if (userDoc.exists && userDoc.data().status === 'admin') {
        isAdmin = true;
      }
    }

    if (!isAdmin) {
      return { statusCode: 403, body: JSON.stringify({ error: "Acesso bloqueado." }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Acesso autorizado", uid: uid })
    };

  } catch (error) {
    console.error("Erro na função auth:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
