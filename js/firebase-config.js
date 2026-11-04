/* Placar online para a versão publicada no GitHub Pages.
 *
 * Deixe null para salvar só no navegador. Para ligar o placar compartilhado,
 * cole a configuração do app Web do seu projeto Firebase
 * (Console do Firebase → Configurações do projeto → Seus apps → </> Web)
 * e a lista de e-mails Google que podem registrar partidas.
 * Esses dados não são secretos: quem protege o placar são as regras em firestore.rules.
 */
window.FREE_FAMILIA_FIREBASE = {
  config: {
    apiKey: 'AIzaSyAO8nee0AYeE2VThS9yfz4MMEnk4yvbSrU',
    authDomain: 'free-familia.firebaseapp.com',
    projectId: 'free-familia',
    storageBucket: 'free-familia.firebasestorage.app',
    messagingSenderId: '940142368796',
    appId: '1:940142368796:web:689b0ec359526593ee27d9',
  },
  admins: ['alessonmiranda@gmail.com', 'carvalhoaline098b@gmail.com'],
};

/* Exemplo:
window.FREE_FAMILIA_FIREBASE = {
  config: {
    apiKey: 'AIza...',
    authDomain: 'seu-projeto.firebaseapp.com',
    projectId: 'seu-projeto',
    appId: '1:123:web:abc',
  },
  admins: ['seu-email@gmail.com'],
};
*/
