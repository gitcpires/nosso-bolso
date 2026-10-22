const admin = require("firebase-admin");

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawCredentials) throw new Error("Variavel FIREBASE_SERVICE_ACCOUNT nao encontrada no Netlify.");
    
    try {
      const serviceAccount = JSON.parse(rawCredentials.replace(/\\n/g, '\n'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (err) {
      throw new Error("JSON da chave secreta corrompido: " + err.message);
    }
  }
  return admin;
}

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };

  try {
    const firebaseAdmin = getFirebaseAdmin();
    const authHeader = event.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      throw new Error("Token de seguranca nao chegou no servidor.");
    }

    const decodedToken = await firebaseAdmin.auth().verifyIdToken(match[1]);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        ok: true,
        uid: decodedToken.uid,
        email: decodedToken.email,
        mensagem: "Servidor conectado e identidade confirmada!"
      })
    };
  } catch (error) {
    // AGORA O ERRO REAL VAI APARECER NA SUA TELA
    return { 
      statusCode: 401, 
      headers, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};
