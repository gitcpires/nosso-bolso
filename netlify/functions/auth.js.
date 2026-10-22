const admin = require("firebase-admin");

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawCredentials) throw new Error("Credenciais do Firebase ausentes no Netlify.");
    
    // Proteção contra quebras de linha corrompidas no painel do Netlify
    const serviceAccount = JSON.parse(rawCredentials.replace(/\\n/g, '\n'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin;
}

exports.handler = async (event) => {
  // Configuração básica de segurança e permissão de acesso (CORS)
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };

  try {
    const firebaseAdmin = getFirebaseAdmin();
    const authHeader = event.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Acesso bloqueado: Token ausente." }) };
    }

    // O servidor Firebase descriptografa o token invisível e confirma quem é a pessoa
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(match[1]);
    
    // Resposta inicial de sucesso que o nosso HTML vai ler
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
    console.error("Falha no servidor:", error.message);
    return { 
      statusCode: 401, 
      headers, 
      body: JSON.stringify({ error: "Sessão inválida ou expirada. Faça login novamente." }) 
    };
  }
};
