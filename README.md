# Free Família · Arena de Duelos

Página para registrar os duelos de Free Fire da família.

- **Cabeçalho animado em pixel art**: campo de batalha ao pôr do sol, avião soltando airdrop, tiros na barricada,
  Aline e Miguel apaixonados (corações, olhos de coração), Talisson com a Bíblia ("Romanos 6.23")
  e Isaías cercado de anúncios ("Tá cheio de propaganda aqui!").
- **Montar equipes**: marque quem vai jogar, sorteie (máx. 4 por equipe, o resto fica no banco) ou escale manualmente.
- **Placar**: informe o placar final; cada integrante da equipe vencedora ganha 1 ponto no ranking.
- **Ranking de vitórias** com aproveitamento e sequência de vitórias.
- **Histórico de combates** com data, hora, placar e integrantes de cada equipe (filtro por jogador, apagar com "desfazer").
- **Backup**: exportar/importar JSON (os dados ficam salvos no navegador — `localStorage`).

## Como usar

Abra o `index.html` no navegador. Para publicar, ative o GitHub Pages
(Settings → Pages → Deploy from a branch → `main` / root).

Arquivos: `index.html`, `css/style.css`, `js/sprites.js` (personagens — edite `CHARS` para mudar pele, cabelo e acessórios),
`js/scene.js` (animação), `js/app.js` (equipes, placar, ranking, histórico).
