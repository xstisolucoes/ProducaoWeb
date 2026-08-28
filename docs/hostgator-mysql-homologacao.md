# XPAPER — Criação do MySQL de Homologação na HostGator

**Objetivo:** criar um banco MySQL/MariaDB de homologação para iniciar a evolução do XPAPER Central, sem alterar a operação atual baseada no Firebird.

> **Decisão recomendada:** crie agora o banco e o usuário de homologação, mas mantenha o **Firebird local como fonte oficial** de todos os dados e gravações. Nesta etapa, não importe o ERP inteiro nem aponte a Produção Web para o MySQL.

## 1. Sequência segura da transição

O banco hospedado deve nascer vazio e protegido. Enquanto o modelo de dados não estiver conferido e a replicação não for validada, o Firebird continua sendo a base oficial de Produção, estoque, OPs, qualidade e fiscal.

| Etapa | O que fazer agora | Fonte oficial |
|---|---|---|
| **1. Homologação** | Criar banco e usuário na HostGator. | Firebird local |
| **2. Modelagem** | Montar dicionário de dados e esquema compatível no MySQL. | Firebird local |
| **3. Leitura** | Replicar cadastros e consultas para conferência. | Firebird local |
| **4. Migração por módulo** | Transferir a escrita de um domínio validado por vez. | Definida por módulo |
| **5. Produção central** | Tornar o MySQL fonte oficial somente depois de reconciliação. | MySQL |

Nesta primeira etapa, **não apague, não altere e não exporte em massa** a base Firebird de produção. O resultado esperado é somente o banco `XPAPER` preparado para receber o esquema de homologação.

## 2. Padrão de nomes recomendado

O cPanel geralmente adiciona automaticamente o nome da conta antes do banco e do usuário. Use sufixos curtos, sem espaços, acentos ou caracteres especiais. A HostGator recomenda usar o nome conforme apresentado pelo próprio cPanel ao configurar a aplicação.[1]

| Item | Sufixo a digitar no cPanel | Nome final provável |
|---|---|---|
| Banco de homologação | `xpaper_hml` | `seuusuario_xpaper_hml` |
| Usuário de migração | `xpaper_mig` | `seuusuario_xpaper_mig` |
| Usuário da aplicação futura | `xpaper_app` | `seuusuario_xpaper_app` |

Use o usuário `xpaper_mig` apenas para criar e alterar o esquema durante a modelagem. O usuário `xpaper_app` será criado agora ou depois, mas deverá ter privilégios menores quando a aplicação entrar em uso.

## 3. Criar o banco no cPanel

1. Acesse a Área do Cliente HostGator e abra o **cPanel** da hospedagem correta.
2. Na busca do cPanel, digite **Manage My Databases**, **Banco de Dados MySQL** ou **MySQL Databases**.
3. Abra a ferramenta encontrada.
4. Em **Criar novo banco de dados**, informe `xpaper_hml`.
5. Clique em **Criar banco de dados**.
6. Aguarde a mensagem de sucesso e clique em **Voltar**.
7. Em **Bancos de dados atuais**, anote o nome completo criado pelo cPanel, por exemplo `seuusuario_xpaper_hml`.

> Não escolha um nome genérico como `banco`, `teste` ou `mysql`. O nome `xpaper_hml` deixa explícito que este ambiente ainda não é o banco de produção.

A criação pelo menu de bancos, seguida do retorno à lista de bancos atuais, é o fluxo indicado pela própria HostGator.[1]

## 4. Criar o usuário técnico de migração

1. Na mesma página, localize **Adicionar novo usuário** ou **MySQL Users**.
2. No nome do usuário, informe `xpaper_mig`.
3. Clique em **Gerar senha** e crie uma senha longa e exclusiva. Utilize letras maiúsculas, minúsculas, números e caracteres especiais.
4. Guarde a senha em um gerenciador de senhas; não a envie por WhatsApp, e-mail ou coloque em arquivos `.env` compartilhados.
5. Confirme a senha e clique em **Criar usuário**.
6. Anote o nome completo gerado pelo cPanel, por exemplo `seuusuario_xpaper_mig`.

> A senha do banco não é a senha de um usuário do ERP. Ela é uma credencial técnica e deve ser exclusiva do MySQL de homologação.

## 5. Associar o usuário ao banco

1. Desça até **Adicionar usuário ao banco de dados**.
2. Selecione o usuário `seuusuario_xpaper_mig`.
3. Selecione o banco `seuusuario_xpaper_hml`.
4. Clique em **Adicionar**.
5. Na tela de privilégios, para este usuário técnico de migração, marque **Todos os privilégios** apenas neste banco de homologação.
6. Clique em **Fazer alterações** e depois em **Voltar**.

A associação entre usuário e banco é uma etapa separada da criação. A HostGator orienta selecionar ambos, adicionar a associação e gravar os privilégios.[1]

### Privilégios futuros da aplicação

Quando a API XPAPER for conectada ao MySQL, crie um segundo usuário, `xpaper_app`. Para o funcionamento cotidiano, ele deve receber somente os privilégios necessários sobre `seuusuario_xpaper_hml`.

| Usuário | Uso | Privilégios sugeridos |
|---|---|---|
| `xpaper_mig` | Criar/alterar esquema durante homologação | Todos os privilégios **somente** no banco de homologação |
| `xpaper_app` | API XPAPER em execução | `SELECT`, `INSERT`, `UPDATE`, `DELETE` e `EXECUTE` quando necessário |
| Usuário de relatório futuro | Consulta e BI | `SELECT` apenas |

Não use a credencial de migração na aplicação diária quando o sistema estiver publicado.

## 6. Conferir o banco pelo phpMyAdmin

1. Volte à página inicial do cPanel.
2. Abra **phpMyAdmin**.
3. Na barra lateral, localize e selecione `seuusuario_xpaper_hml`.
4. Confirme que o banco está vazio.
5. Na aba SQL, execute apenas estas verificações:

```sql
SELECT DATABASE() AS banco_atual;
SELECT CURRENT_USER() AS usuario_conectado;
SHOW TABLES;
```

O último comando deve retornar vazio nesta etapa. Não crie tabelas industriais antes do inventário do Firebird e do dicionário de dados XPAPER.

## 7. Acesso remoto: não habilitar por enquanto

Por padrão, a HostGator bloqueia acessos MySQL externos e exige que o IP de origem seja incluído como host autorizado.[2] Como o XPAPER ainda não possui uma API hospedada nem um replicador validado, **não habilite Remote MySQL agora**.

Quando chegar o momento de conectar um serviço externo, siga estas regras:

| Regra | Aplicação |
|---|---|
| Autorizar somente IP fixo | Cadastre apenas o IP público fixo do servidor autorizado. |
| Não usar `%` ou “qualquer host” | Nunca liberar acesso global ao banco. |
| Remover IPs de teste | Revogue o acesso quando o teste terminar. |
| API, não navegador | O navegador não deve se conectar ao MySQL diretamente. |
| Usar conexão criptografada quando disponível | Configure TLS entre API e banco. |

> Se a aplicação XPAPER estiver hospedada na mesma conta ou infraestrutura do banco, ela normalmente se conecta internamente. O acesso remoto só deve ser configurado após identificar o servidor da API e seu IP permitido.

## 8. Informações que devem ser registradas, sem expor a senha

Depois de concluir os passos anteriores, registre internamente somente os dados abaixo. A senha deve ficar em um gerenciador de credenciais ou, posteriormente, em segredo de ambiente da aplicação.

```text
Ambiente: Homologação
Banco: seuusuario_xpaper_hml
Usuário de migração: seuusuario_xpaper_mig
Usuário da aplicação: seuusuario_xpaper_app (quando criado)
Host: confirmar no cPanel/HostGator
Porta: confirmar no cPanel/HostGator
Charset alvo: utf8mb4
Fonte oficial atual: Firebird local
```

## 9. O que faremos depois da criação

Após o banco estar criado, a próxima atividade não é carregar o Firebird inteiro. Primeiro será elaborado o **Dicionário de Dados XPAPER**, contendo tabela de origem, campo de origem, tipo Firebird, tipo MySQL, chave, relacionamento, regra de negócio e responsável pelo dado.

| Prioridade | Domínio a modelar | Motivo |
|---|---|---|
| 1 | Empresas, usuários, grupos e permissões | Base do login único e da autorização. |
| 2 | Clientes, produtos, revisões e máquinas | Cadastros necessários para todos os módulos. |
| 3 | OPs e processos | Núcleo de PCP e Produção. |
| 4 | Estoque, reservas, lotes e movimentações | Exige validação rigorosa de saldo e transação. |
| 5 | Qualidade, RPNC, fiscal e relatórios | Migração gradual após os domínios-base. |

As tabelas poderão manter os nomes legados do Firebird na primeira fase, como `MOV_PROCESSOS`, `MOV_PROCESSOS_HORARIOS` e `PRODUTOS_VENDAS`. As triggers, views e procedures terão a mesma finalidade, mas serão reescritas para a sintaxe MySQL/MariaDB e comparadas contra o resultado atual antes de entrar em produção.

## 10. Checklist de conclusão desta etapa

- [ ] Banco `xpaper_hml` criado no cPanel.
- [ ] Nome completo com prefixo do cPanel anotado.
- [ ] Usuário `xpaper_mig` criado com senha forte.
- [ ] Usuário associado ao banco com privilégios para migração.
- [ ] Verificação executada no phpMyAdmin.
- [ ] Acesso remoto mantido desabilitado por enquanto.
- [ ] Firebird preservado como fonte oficial.
- [ ] Nenhuma tabela de produção, estoque ou fiscal importada ainda.

## Referências

[1] [HostGator Brasil — Como criar um banco de dados no cPanel](https://suporte.hostgator.com.br/hc/pt-br/articles/30813397059987-Como-criar-um-banco-de-dados-no-cPanel)

[2] [HostGator — How to Set Up a Remote MySQL Database](https://www.hostgator.com/help/article/cp-remote-mysql)
