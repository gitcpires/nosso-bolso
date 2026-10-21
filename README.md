# Nosso Bolso — estrutura inicial de migração segura

Esta pasta contém apenas o esqueleto inicial. **Não é uma versão pronta para produção** e não substitui o `index.html` original.

## Arquivos
- `admin.html`: página inicial do painel; ainda não executa operações administrativas.
- `netlify/functions/health.js`: endpoint de teste sem acesso a dados.
- `netlify.toml`: configura a pasta de funções da Netlify.
- `package.json`: dependência do Firebase Admin SDK para as próximas funções protegidas.
- `.env.example`: exemplo sem segredos reais.

## Antes de produção
1. Integrar o frontend ao Firebase Authentication (e-mail/senha).
2. Estabelecer o administrador inicial com procedimento controlado; nunca confiar em `role` enviado pelo navegador.
3. Implementar verificação de token Firebase em cada função privilegiada.
4. Aplicar autorização e isolamento por controle financeiro nas regras do Firestore.
5. Migrar os dados/formatos existentes sem apagar coleções.
6. Testar acesso permitido e negado com contas distintas.
7. Somente então substituir o site publicado.

## Segredos
Não comite chaves de conta de serviço, tokens ou arquivos `.env`. Os segredos reais devem ser configurados nas variáveis de ambiente da Netlify após a implementação e revisão das funções que os utilizarem.
