# Estação do operador em modo restrito

O sistema restringe a navegação interna para perfis **Operador**: na tela inicial não é exibido menu lateral e, durante uma OP em produção, o retorno pelo histórico do navegador é bloqueado pela aplicação. O acesso em tela cheia é solicitado ao confirmar o login, mas navegadores não podem bloquear integralmente atalhos do sistema operacional, troca de aplicativos ou o encerramento forçado da janela.

Para uma estação realmente dedicada, configure o Windows para abrir o Microsoft Edge em modo de quiosque. A opção recomendada é **Acesso atribuído / Configurar um quiosque**, usando uma conta Windows exclusiva do operador e o endereço LAN da aplicação. O modo de sinalização digital abre uma única URL em tela cheia e impede as barras usuais do navegador.[1] [2]

Como alternativa de teste, crie um atalho para o Edge com o comando abaixo, substituindo o endereço pelo IP ou nome interno usado na sua rede:

```bat
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk http://IP_DA_APLICACAO:3000 --edge-kiosk-type=fullscreen --no-first-run
```

> O modo de quiosque deve ser aplicado somente à conta Windows da estação de chão de fábrica. Mantenha uma conta administrativa separada para suporte, atualizações e saída controlada.

## Referências

[1] [Configurar o modo quiosque do Microsoft Edge](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-configure-kiosk-mode)

[2] [Visão geral do Acesso Atribuído do Windows](https://learn.microsoft.com/en-us/windows/configuration/assigned-access/)
