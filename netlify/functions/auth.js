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
    
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ error: "Token em falta." }) };
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    
    // LIBERAÇÃO DIRETA POR EMAIL: Se for o teu e-mail, entra imediatamente sem bloqueio!
    if (decodedToken.email === 'c.pirespm@gmail.com') {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: "Acesso autorizado", uid: decodedToken.uid })
      };
    }

    return { 
      statusCode: 403, 
      body: JSON.stringify({ error: "Acesso bloqueado." }) 
    };

  } catch (error) {
    console.error("Erro:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
