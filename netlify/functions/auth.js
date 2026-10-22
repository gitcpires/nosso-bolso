const admin = require("firebase-admin");

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawCredentials) throw new Error("Variavel FIREBASE_SERVICE_ACCOUNT nao encontrada no Netlify.");
    
    let serviceAccount;
    try {
      // Tentativa 1: Leitura padrão
      serviceAccount = JSON.parse(rawCredentials.replace(/\\n/g, '\n'));
    } catch (err) {
      // Tentativa 2: Extração à força (ignora quebras de linha do celular)
      const projectIdMatch = rawCredentials.match(/"project_id"\s*:\s*"([^"]+)"/);
      const clientEmailMatch = rawCredentials.match(/"client_email"\s*:\s*"([^"]+)"/);
      const privateKeyMatch = rawCredentials.match(/"private_key"\s*:\s*"([^"]+)"/);

      if (!projectIdMatch || !clientEmailMatch || !privateKeyMatch) {
        throw new Error("O texto colado no Netlify está incompleto. Faltam partes da chave.");
      }

      serviceAccount = {
        projectId: projectIdMatch[1],
        clientEmail: clientEmailMatch[1],
        privateKey: privateKeyMatch[1].replace(/\\n/g, '\n')
      };
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
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
        mensagem: "Servidor conectado e identidade confirmada com sucesso!"
      })
    };
  } catch (error) {
    return { 
      statusCode: 401, 
      headers, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};
