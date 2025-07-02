# ⚠️ FUNÇÃO CRÍTICA DO PORTAL RH — SELEÇÃO DE FUNCIONÁRIO

> Este ficheiro deve ser LIDO e RESPEITADO por qualquer programador ou IA (ex: Cursor) envolvido no desenvolvimento deste projeto.

---

## 🔐 LOGIN & SELEÇÃO OBRIGATÓRIA DE FUNCIONÁRIO

- A autenticação é feita via **MSAL (Microsoft Authentication Library)**.
- Após login, o utilizador é **redirecionado automaticamente para `/landing`**.
- Nesta página, o utilizador **é obrigado a selecionar um dos funcionários ativos associados ao seu `UserId`**.
- Só após esta seleção pode navegar para qualquer outra rota ou funcionalidade.
- A consulta que alimenta esta seleção deve ser semelhante a:

```ts
SELECT
  [Number], [Name], [UserId], [Active], ...
FROM [RFWebApp].[dbo].[Employee]
WHERE [UserId] = ${userId}
  AND [Active] = 1
```

---

## 🚫 BLOQUEIO DE FUNCIONALIDADE SEM FUNCIONÁRIO ATIVO

- **Não pode haver navegação ou interação com a aplicação sem um funcionário selecionado.**
- A aplicação deve **impedir acesso a qualquer rota protegida** se o `employeeNumber` estiver ausente no estado do frontend.
- Rota `/landing` é a única exceção visível até que a seleção seja feita.
- Implementar redirect automático (ex: `router.push('/landing')`) caso tente avançar sem seleção.

---

## ✅ TODAS AS OPERAÇÕES DEVEM USAR O FUNCIONÁRIO ATIVO

- Qualquer operação que grave ou altere dados (ex: avaliações, objetivos, registos de formação) deve sempre incluir:
  - `employee_number`: número do funcionário selecionado
  - `user_upn`: UPN (User Principal Name) do utilizador autenticado via MSAL
- Estes campos são **obrigatórios** em todas as tabelas que exijam rastreabilidade ou auditoria.

---

## 🛡️ SEGURANÇA E VALIDAÇÃO DE DATOS

- ❗ Nunca permitir seleção de funcionário com `[Active] = 0`.
- ❗ Nunca permitir submissão de dados se `employee_number` não estiver definido ou não for válido.
- ❗ Todos os endpoints devem rejeitar com erro (403 ou 422) se `employee_number` estiver em falta.
- 🚫 A API deve ser validada do lado do servidor mesmo que o frontend falhe em controlar este fluxo.

---

## 🧠 BOAS PRÁTICAS (CURSOR & DEVs)

- ❗ **Nunca assumes que há apenas um funcionário por `UserId`** — essa é precisamente a exceção que obriga à escolha.
- 📦 Usa **React Context API**, Zustand ou similar para guardar `employeeNumber` de forma global.
- 🔄 O estado do funcionário deve **persistir entre páginas, reloads e sessões**.
- 🧪 Testa com contas que tenham:
  - 1 funcionário
  - 2+ funcionários (fluxo crítico)
  - 0 funcionários (deve apresentar erro ou mensagem explicativa)
- 🕵️‍♂️ Inclui sempre logs ou auditorias com:
  - `created_by_user_upn`
  - `employee_number`
  - `timestamp`

---

## 🧰 SUGESTÕES TÉCNICAS

- Criar hook `useFuncionarioAtivo()` para encapsular a lógica de verificação, fallback, refresh e acesso.
- Armazenar `employeeNumber` no `localStorage` com validade curta e verificação adicional via API.
- Criar middleware (`middleware.ts`) que bloqueia rotas não autorizadas.
- Garantir que todas as mutações (POST, PUT, DELETE) no backend validam `employee_number`.

---

## 🧩 INTEGRAÇÃO COM O BACKEND

- Todas as tabelas relacionáveis devem conter:
  - `employee_number TEXT`
  - `created_by_user_upn TEXT`
  - Campos `created_at`, `updated_at` para auditoria
- Stored procedures, funções e endpoints REST devem aceitar ou inferir o funcionário ativo conforme o utilizador autenticado e contexto de sessão.

---

## ❌ ERROS COMUNS A EVITAR

- ❌ Esquecer de preencher o `employee_number` nos registos criados.
- ❌ Permitir navegação no menu sem funcionário escolhido.
- ❌ Supor que todos os utilizadores só têm um funcionário.
- ❌ Misturar dados entre funcionários por má gestão de contexto.
- ❌ Validar apenas no frontend — nunca confiar exclusivamente no cliente.

---

## 📅 DATA & RESPONSÁVEL

_Atualizado em: 2025-05-16_

Autor: **Gilberto Marques Silva**  
Especialista em deixar tudo à prova de asneiras de IA ou devs distraídos.  
👨‍💻 “Testa, valida, verifica. E só depois commits.” 🚀

---
