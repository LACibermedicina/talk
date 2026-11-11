# Segurança

- **Nunca** versione `.env`, chaves de API, senhas ou `config/usuarios.json` (o `.gitignore` já os exclui). Se uma chave vazar, revogue-a no provedor e gere outra.
- A `DATA_KEY` cifra mensagens, notas, transcrições e história clínica. Guarde uma cópia em cofre separado: perdê-la torna esses dados irrecuperáveis.
- Para reportar uma vulnerabilidade, contate o responsável pelo repositório em particular (não abra uma issue pública).
- Antes de produção com pacientes: teste de carga, revisão de segurança independente, RIPD/termos da LGPD e backup testado do banco.
- **Senhas de teste** (como `root`/`arcano`) só valem em servidor local. Em servidor público o sistema exige 12+ caracteres e troca obrigatória no primeiro login. Se usar essa senha de teste em algum lugar real, troque-a e não a reutilize.
- **Cadastro público** vem desativado. Se ligar, prefira o modo “com aprovação”: o e-mail informado não é verificado.
