const admin = require("firebase-admin");

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawCredentials) throw new Error("Variavel FIREBASE_SERVICE_ACCOUNT ausente.");
    
    let serviceAccount;
    try {
      // Tenta fazer o parse normal
      serviceAccount = JSON.parse(rawCredentials);
    } catch (err) {
      try {
        // Tenta limpar quebras de linha caso venha formatada
        serviceAccount = JSON.parse(rawCredentials.replace(/\\n/g, '\n'));
      } catch (e) {
        // Extração direta por segurança caso o JSON esteja em linha única
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
