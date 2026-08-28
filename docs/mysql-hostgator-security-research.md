# Pesquisa de Segurança — HostGator e MySQL

## Fontes consultadas

1. HostGator, [Whitelist Your IP in cPanel for Remote MySQL Access](https://www.hostgator.com/help/article/how-to-whitelist-your-ip-in-cpanel-for-remote-mysql-access).
2. HostGator, [How to Create or Delete a MySQL Database or User](https://www.hostgator.com/help/article/how-do-i-create-a-mysql-database-a-user-and-then-delete-if-needed).
3. HostGator Brasil, [Como habilitar acesso remoto no banco de dados MySQL](https://suporte.hostgator.com.br/hc/pt-br/articles/30811068544403-Como-habilitar-acesso-remoto-no-banco-de-dados-MySQL).

## Achados aplicáveis ao XPAPER

- O acesso remoto ao MySQL fica bloqueado por padrão e precisa de um IP explicitamente cadastrado em **Remote Database Access** no cPanel.
- O uso do curinga `%` permite acesso de qualquer origem e não deve ser utilizado pelo XPAPER.
- O cPanel permite criar usuários de banco, associá-los a um banco e selecionar privilégios. Para a aplicação, a recomendação é aplicar menor privilégio e separar usuários por finalidade.
- A conexão do navegador ao MySQL não é aceitável: o acesso deve ocorrer somente por API PHP/Node.js com credenciais guardadas no servidor.
