# Segurança de cPanel, MySQL e API XPAPER

**Objetivo:** orientar a criação de um ambiente MySQL hospedado na HostGator para homologação do XPAPER e estruturar o acesso seguro por PHP ou Node.js. O Firebird atual continua sendo a fonte oficial até a migração por domínio ser concluída e reconciliada.

> **Regra central:** navegador, aplicativo móvel e operador nunca se conectam diretamente ao MySQL. Somente uma API autenticada no servidor pode usar as credenciais do banco.

## 1. Arquitetura recomendada

```text
Navegador / celular
       │ HTTPS
       ▼
XPAPER Web
       │ sessão, autorização, validação e auditoria
       ▼
API PHP ou API Node.js
       │ conexão privada ou IP liberado de forma restrita
       ▼
MySQL da HostGator
```

Use **uma API principal**, não PHP e Node.js para a mesma regra sem necessidade. Como o Produção Web atual já usa React, TypeScript e Node.js, o caminho preferencial é **Node.js como API do XPAPER**. PHP continua apropriado se o módulo for hospedado em plano compartilhado que suporte PHP, mas não suporte processo Node.js persistente.

| Cenário | Opção recomendada |
|---|---|
| XPAPER Central e módulos novos | API Node.js/TypeScript, com pool MySQL. |
| Site ou API limitada a hospedagem compartilhada cPanel | PHP com PDO, sem acesso do navegador ao banco. |
| Aplicação PHP e MySQL no mesmo plano HostGator | Conectar em `localhost`; não habilitar MySQL remoto. |
| API Node.js hospedada fora da HostGator | Liberar somente o IP público fixo da API em **Remote Database Access**. |

O acesso MySQL remoto é bloqueado por padrão na HostGator e depende da inclusão explícita do IP de origem em **Remote Database Access**. A HostGator alerta que o curinga `%` libera conexão de qualquer IP e não é recomendado. [1]

## 2. Proteção da conta cPanel

Proteja primeiro o cPanel, porque quem controla o painel pode alterar banco, arquivos, DNS, e-mails e usuários da hospedagem.

| Controle | Como aplicar |
|---|---|
| Senha exclusiva e longa | Use senha aleatória, exclusiva e guardada em gerenciador de senhas. Não reutilize a senha do ERP ou do e-mail. |
| Segundo fator | Ative autenticação em duas etapas no Portal/cPanel se estiver disponível no plano. Mantenha códigos de recuperação em cofre seguro. |
| E-mail de recuperação | Use caixa corporativa protegida por segundo fator; não use e-mail pessoal compartilhado. |
| Menor acesso | Crie acessos individuais para quem administra. Não compartilhe uma senha de cPanel entre equipe, fornecedor e desenvolvimento. |
| Revisão periódica | Revogue acessos de ex-colaboradores, revise usuários MySQL, cron jobs, chaves SSH e redirecionamentos. |
| Atualizações | Mantenha CMS, dependências PHP/Node, plugins e bibliotecas atualizados. |
| Backup | Teste restauração, não apenas a existência do backup. Mantenha cópia fora da conta de hospedagem. |

Não coloque arquivo `.env`, backup SQL, log detalhado, chave privada ou exportação Firebird dentro de `public_html`. Em PHP, mantenha a configuração fora da pasta pública sempre que o plano permitir; em Node.js, guarde os segredos em variáveis de ambiente do processo ou no gerenciador de segredos do provedor.

## 3. Banco e usuários MySQL

Crie bancos e credenciais separados por ambiente e finalidade. O usuário da aplicação não deve possuir permissões administrativas.

| Finalidade | Exemplo de banco | Exemplo de usuário | Privilégios |
|---|---|---|---|
| Homologação XPAPER | `prefixo_xpaper_hml` | `prefixo_xpapphml` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` nas tabelas do ambiente. |
| Produção XPAPER | `prefixo_xpaper_prd` | `prefixo_xpapprd` | Somente os privilégios necessários em produção. |
| Migração versionada | mesmo banco do ambiente | `prefixo_xpmigrate` | DDL temporário e controlado: `CREATE`, `ALTER`, `INDEX` e `REFERENCES`, somente durante migrações. |
| Relatórios somente leitura | mesmo banco do ambiente | `prefixo_xpreport` | Apenas `SELECT` em views/tabelas liberadas. |

No cPanel, crie o banco, crie o usuário, associe-o ao banco e selecione privilégios em **MySQL Databases → Add User to Database**. A HostGator documenta essa associação e a escolha de privilégios nessa tela. [2]

Não use `root`, não use a mesma conta para homologação e produção, e não use `ALL PRIVILEGES` para o usuário de execução da aplicação. Caso seja necessário aplicar uma migração, use um usuário de migração separado e remova permissões elevadas após a conclusão.

## 4. Acesso remoto e rede

Prefira que API e MySQL estejam no mesmo ambiente de hospedagem, pois a conexão tende a usar `localhost` e dispensa exposição remota. Se a API Node.js ficar fora da HostGator, ela precisa de IP de saída **fixo**. Cadastre somente esse IP em **Remote Database Access**.

| Nunca fazer | Alternativa segura |
|---|---|
| Liberar `%` no Remote MySQL | Liberar um IP fixo específico da API. |
| Usar IP residencial dinâmico em produção | Executar a API em servidor com IP estático ou usar túnel/VPN apropriado. |
| Abrir phpMyAdmin ao público sem proteção adicional | Usar cPanel protegido e acesso administrativo pontual. |
| Abrir MySQL ao navegador | Publicar somente API HTTPS com autenticação e autorização. |
| Gravar senha do banco no Git | Usar segredo/variável de ambiente fora do repositório. |

Caso o plano permita TLS para MySQL remoto, exija certificado da CA fornecida pelo provedor. Se o plano não fornecer TLS remoto, não trate a conexão MySQL pela internet como canal apropriado para produção; mantenha a API no mesmo ambiente do banco ou escolha uma hospedagem de banco gerenciada que ofereça TLS e rede privada.

## 5. Estrutura de conexão Node.js

Use `mysql2/promise` com pool, variáveis de ambiente e `execute` com parâmetros. A documentação do mysql2 descreve suporte a prepared statements e pools; o método `execute` utiliza prepared statements. [3] Consultas parametrizadas são a principal defesa contra injeção SQL, segundo a OWASP. [4]

```ts
// server/db/mysql.ts
import mysql from "mysql2/promise";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
};

export const mysqlPool = mysql.createPool({
  host: required("XPAPER_DB_HOST"),
  port: Number(process.env.XPAPER_DB_PORT ?? "3306"),
  user: required("XPAPER_DB_USER"),
  password: required("XPAPER_DB_PASSWORD"),
  database: required("XPAPER_DB_NAME"),
  waitForConnections: true,
  connectionLimit: 8,
  maxIdle: 4,
  idleTimeout: 60_000,
  enableKeepAlive: true,
  timezone: "Z",
  // Configure ssl somente quando a HostGator fornecer CA e suporte ao plano.
  // ssl: { ca: process.env.XPAPER_DB_CA }
});

export async function findOrderByCode(orderCode: number) {
  const [rows] = await mysqlPool.execute(
    "SELECT op_codigo, op_status FROM ordens_producao WHERE op_codigo = ?",
    [orderCode],
  );
  return rows;
}
```

O código acima deve ficar apenas no servidor. O frontend React chama uma rota/tRPC autenticada, e essa rota valida sessão, perfil e escopo de dados antes de usar o repositório. Nunca aceite nome de tabela, coluna, ordenação ou SQL bruto vindo do cliente; para filtros dinâmicos, use lista permitida de colunas e parâmetros para valores.

### Variáveis de ambiente Node.js

```dotenv
XPAPER_DB_HOST=localhost
XPAPER_DB_PORT=3306
XPAPER_DB_NAME=prefixo_xpaper_hml
XPAPER_DB_USER=prefixo_xpapphml
XPAPER_DB_PASSWORD=substituir_por_segredo_real
# XPAPER_DB_CA=/caminho/fora/do/repositorio/ca.pem
```

O exemplo usa nomes fictícios. Nunca envie valores reais por e-mail, chat, GitHub, ZIP de entrega ou código-fonte.

## 6. Estrutura de conexão PHP

Se um módulo ficar em PHP, use PDO com exceções, emulação de prepared statements desabilitada e credenciais vindas do ambiente. PHP também deve ser somente backend: a página ou aplicativo nunca recebe DSN, usuário ou senha.

```php
<?php
declare(strict_types=1);

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = getenv('XPAPER_DB_HOST') ?: 'localhost';
    $port = getenv('XPAPER_DB_PORT') ?: '3306';
    $name = getenv('XPAPER_DB_NAME');
    $user = getenv('XPAPER_DB_USER');
    $password = getenv('XPAPER_DB_PASSWORD');

    if (!$name || !$user || !$password) {
        throw new RuntimeException('Configuração de banco ausente.');
    }

    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function findOrderByCode(int $orderCode): array {
    $stmt = db()->prepare(
        'SELECT op_codigo, op_status FROM ordens_producao WHERE op_codigo = :op_codigo'
    );
    $stmt->execute(['op_codigo' => $orderCode]);
    return $stmt->fetchAll();
}
```

## 7. Segurança da API XPAPER

A conexão protegida não substitui controles de aplicação. A API deve aplicar autenticação, autorização por módulo/perfil, auditoria e limites de abuso antes de chegar ao banco.

| Controle | Aplicação no XPAPER |
|---|---|
| HTTPS | Obrigatório em produção; redirecionar HTTP para HTTPS. |
| Sessão | Cookie `HttpOnly`, `Secure` e `SameSite`; expiração e renovação controladas. |
| Autorização | Verificar perfil e permissões no servidor em cada mutação. |
| CSRF | Proteger rotas de sessão/cookie quando a arquitetura usar autenticação por cookie. |
| Rate limit | Limitar login, recuperação de senha e consultas pesadas. |
| Auditoria | Registrar usuário, perfil, IP, módulo, ação, entidade e resultado. |
| Erros | Não devolver host, SQL, stack trace ou credencial ao navegador. |
| Transações | Usar transação para estoque, reserva, apontamento, qualidade e estados dependentes. |

Para o módulo de Produção, mantenha as regras Firebird e proxy LAN enquanto ele não for migrado. Não faça a tela web gravar diretamente no MySQL e no Firebird na mesma operação sem uma estratégia de fonte oficial e reconciliação.

## 8. Sequência recomendada

1. Criar `prefixo_xpaper_hml` e usuários separados no cPanel.
2. Ativar proteção de conta, senha exclusiva, segundo fator quando disponível e backup validado.
3. Manter Remote MySQL desabilitado se PHP/API estiver no mesmo plano. Se Node externo for usado, liberar somente IP fixo da API.
4. Criar API mínima com endpoint de saúde e uma consulta de leitura autenticada.
5. Configurar segredo em ambiente, sem versionar arquivo de credenciais.
6. Criar schema MySQL compatível para cadastros e consultas, sem alterar a fonte oficial Firebird.
7. Implementar sincronização Firebird → MySQL somente em leitura e comparar contagem, chaves, saldos e relatórios.
8. Migrar escrita por módulo somente após critérios de reconciliação e janela de corte aprovados.

## Checklist antes de produção

- [ ] O banco de homologação é separado do banco de produção.
- [ ] A senha do cPanel não é compartilhada nem reutilizada.
- [ ] O usuário da aplicação não possui privilégios administrativos.
- [ ] Remote MySQL não usa `%` nem faixa de IP ampla.
- [ ] A aplicação usa HTTPS e o navegador não recebe credenciais do banco.
- [ ] SQL usa parâmetros/prepared statements.
- [ ] Credenciais estão fora do Git e dos pacotes de entrega.
- [ ] Backups e restauração foram testados.
- [ ] Erros de banco não expõem detalhes técnicos para o usuário final.
- [ ] A fonte oficial de cada módulo está documentada durante a migração Firebird → MySQL.

## Referências

[1]: https://www.hostgator.com/help/article/how-to-whitelist-your-ip-in-cpanel-for-remote-mysql-access "HostGator — Whitelist Your IP in cPanel for Remote MySQL Access"
[2]: https://www.hostgator.com/help/article/how-do-i-create-a-mysql-database-a-user-and-then-delete-if-needed "HostGator — How to Create or Delete a MySQL Database or User"
[3]: https://sidorares.github.io/node-mysql2/docs "MySQL2 — Quickstart"
[4]: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html "OWASP — SQL Injection Prevention Cheat Sheet"
