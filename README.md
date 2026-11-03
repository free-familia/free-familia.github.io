# Free Família · Arena de Duelos

Página para registrar os duelos de Free Fire da família.

- **Cabeçalho animado em pixel art**: campo de batalha ao pôr do sol, avião soltando airdrop, as duas equipes trocando tiros,
  Aline e Miguel apaixonados (corações, olhos de coração), Talisson com a Bíblia ("Romanos 6.23")
  Iago gritando "Bora Tia!", Aline chamando "Miguel!" e ele respondendo "Amor!", Isaías no celular cercado de anúncios, um avião com Dara, Lucélia e Ana jogando granadas na equipe da esquerda e Isaac chegando de moto dando grau.
- **Montar equipes**: marque quem vai jogar, sorteie (máx. 4 por equipe, o resto fica no banco) ou escale manualmente.
- **Placar**: informe o placar final; cada integrante da equipe vencedora ganha 1 ponto no ranking.
- **Ranking de vitórias** com aproveitamento e sequência de vitórias.
- **Histórico de combates** com data, hora, placar e integrantes de cada equipe (filtro por jogador, apagar com "desfazer").
- **Sorteio equilibrado**: monta equipes de força parecida pelo aproveitamento no ranking.
- **Revanche**: repete as equipes da última partida registrada.
- **Conquistas**: Casal Imbatível, Em Chamas, Pregador, Grau Perfeito e outras, calculadas do histórico.
- **Sons 8-bit** no sorteio, na vitória e nas conquistas, com botão de mudo no topo.
- **Backup**: exportar/importar JSON (os dados ficam salvos no navegador — `localStorage`).

## Como usar

Abra o `index.html` no navegador. Para publicar, ative o GitHub Pages
(Settings → Pages → Deploy from a branch → `main` / root).

Arquivos: `index.html`, `css/style.css`, `js/sprites.js` (personagens — edite `CHARS` para mudar pele, cabelo e acessórios),
`js/scene.js` (animação), `js/app.js` (equipes, placar, ranking, histórico).

## Placar online no GitHub Pages (Firebase)

Com o Firebase ligado, qualquer pessoa que abrir a página vê o mesmo histórico e ranking, sem login.
Só os e-mails autorizados registram ou apagam partidas (botão **Entrar para registrar**, no histórico).

1. **Repositório público + GitHub Pages**: em *Settings → General → Danger Zone*, torne o repositório público
   (GitHub Pages gratuito não funciona em repositório privado). Depois, em *Settings → Pages*, escolha
   *Deploy from a branch* e a branch com a página, pasta `/ (root)`.
   O endereço fica `https://free-familia.github.io/free-familia/`.
2. **Projeto Firebase** (gratuito): em https://console.firebase.google.com crie um projeto.
   - *Build → Firestore Database → Criar banco* (modo produção).
   - *Build → Authentication → Método de login → Google → Ativar*.
   - *Authentication → Configurações → Domínios autorizados → Adicionar* `free-familia.github.io`.
   - *Configurações do projeto → Seus apps → Web (</>)*: registre o app e copie o objeto `firebaseConfig`.
3. **Regras**: em *Firestore → Regras*, cole o conteúdo de `firestore.rules`, troque `seu-email@gmail.com`
   pelo(s) e-mail(s) que podem registrar e clique em *Publicar*.
4. **Configuração da página**: preencha `js/firebase-config.js` com o `firebaseConfig` e a lista `admins`
   (os mesmos e-mails das regras).

> Ao alterar CSS/JS, atualize o número `?v=` nos links de `index.html` para que os celulares
> baixem a versão nova (o GitHub Pages guarda os arquivos em cache por alguns minutos).
