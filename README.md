# A3 Premiação — versão 2.0

Aplicativo PWA instalável no Android para avaliação diária, metas semanais, autoavaliação e acompanhamento da premiação da equipe de produção.

## Regras configuradas

- Prêmio máximo: **R$ 500,00 por mês**.
- Nota mínima para premiação: **70 pontos**.
- Nota final: **80% individual + 20% coletivo**.
- Pesos individuais:
  - Produtividade: **30%**
  - Qualidade: **25%**
  - Perdas / desperdícios: **15%**
  - Assiduidade / pontualidade: **10%**
  - Segurança / procedimentos: **10%**
  - 5S / organização: **5%**
  - Trabalho em equipe: **5%**
- Ocorrência crítica de qualidade ou segurança: padrão atual **zera a premiação do mês**.
- Autoavaliação semanal: **não altera diretamente o prêmio**.

## Melhorias da versão 2.0

- Identidade visual A3 Sementes com logomarca enviada.
- Equipe inicial importada do arquivo `NOMES_E_LOGO.xlsx`.
- CPFs **não são armazenados** no aplicativo.
- Três acessos de gestor.
- Metas semanais por colaborador.
- Pendências de avaliação diária no painel do gestor.
- Autoavaliação semanal pelo celular do colaborador.
- Ciência mensal do resultado com campo para observação.
- Exportação mensal em CSV, compatível com Excel.
- Troca obrigatória da senha inicial.
- PWA instalável no Android quando publicada em HTTPS.

## Equipe inicial

Colaboradores:

- LUCIEL NEVES MESSIAS — Ensaque
- WESLEY DE ALMEIDA DA SILVA LIMA — Ensaque
- DENILSON MARANHAO VENANCIO — Limpeza de Sementes
- GUSTAVO RAFAEL DE AS — Ensaque
- WALLACE JONATAS BELLO DA SILVA — Logística / Empilhadeira
- SELMA DE OLIVEIRA SANTOS — Laboratório
- ELVIS VERONESE — Logística / Empilhadeira

Gestores:

- JOAO VICTOR
- DIEGO PAPINI
- ALANA LUISA CARVALHO

Os usuários iniciais estão no arquivo `ACESSOS_INICIAIS.csv`. Todos são obrigados a alterar a senha no primeiro acesso.

## Como executar no computador

Requer Node.js 22 ou superior.

```bash
node server.mjs
```

Abra:

```text
http://localhost:8080
```

Para celulares na mesma rede local, use o IP do computador:

```text
http://IP-DO-COMPUTADOR:8080
```

## Uso fora da empresa / em casa

Para que os colaboradores façam a autoavaliação em casa, publique o sistema em um servidor com **HTTPS**. Pode ser VPS, servidor próprio ou plataforma de hospedagem compatível com Node.js 22.

O banco SQLite fica em:

```text
data/app.db
```

Faça backup periódico desse arquivo.

## Produção

Antes de publicar na internet, defina uma chave secreta longa:

```bash
APP_SECRET="uma-chave-longa-e-aleatoria" NODE_ENV=production node server.mjs
```

Também é possível alterar a senha inicial genérica usada na criação automática do banco:

```bash
DEFAULT_PASSWORD="senha-inicial-forte" node server.mjs
```

## Docker

```bash
docker build -t a3-premiacao .
docker run -d -p 8080:8080 -e APP_SECRET="troque-por-uma-chave-forte" -v a3-premiacao-data:/app/data a3-premiacao
```

## Observação de privacidade

O arquivo original contém CPF, mas o aplicativo não importa nem armazena esse dado. Para o programa de desempenho são usados apenas nome, setor, função, avaliações, metas e informações de acesso.

## Próximas evoluções possíveis

- Integração com ponto eletrônico.
- Integração com balança/produção para produtividade automática.
- Fotos de evidência de ocorrências.
- Notificações push semanais.
- Painel web avançado com relatórios PDF.
- APK/AAB nativo para Play Store.
