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
    const email = decodedToken.email;

    // 1. Se fores tu (Administrador), entra direto
    if (email === 'c.pirespm@gmail.com') {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: "Acesso autorizado como Administrador", isAdmin: true })
      };
    }

    // 2. Verifica se já está aprovado na coleção de usuários
    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (userDoc.exists && userDoc.data().status) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: "Acesso autorizado", isAdmin: userDoc.data().status === 'admin' })
      };
    }

    // 3. Se não tem cadastro aprovado, cria/atualiza um pedido pendente automaticamente
    await db.collection('solicitacoes').doc(uid).set({
      email: email,
      criadoEm: new Date().toISOString(),
      status: 'pendente'
    }, { merge: true });

    return { 
      statusCode: 403, 
      body: JSON.stringify({ error: "Conta criada! Acesso pendente de aprovação pelo administrador." }) 
    };

  } catch (error) {
    console.error("Erro:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
