# Talk.M3D — Manual do Usuário (v7)

Talk.M3D é um mensageiro clínico com agenda, teleconsulta, prontuário, receitas e acompanhamento. O que você vê depende do seu **perfil**. A ajuda está sempre à mão: botão **Ajuda** (chat com IA, só indica o que o seu perfil pode usar) e botão **?** / `Alt+G` (guia que destaca a área explicada).

## 1. Primeiros passos
- **Primeira vez que o sistema é aberto:** o assistente de instalação abre sozinho no navegador, verifica o servidor, testa o banco e as integrações, cria o root e a equipe. Ele só aparece nessa primeira vez (ou quando o root pedir para restaurar a configuração).
- **Entrar:** usuário ou e-mail e senha. Com senha temporária, o sistema pede que você crie uma senha nova (12 caracteres ou mais) antes de continuar.
- **Travou?** 8 senhas erradas bloqueiam a conta por 15 minutos. O administrador pode **destravar** em Usuários.
- **Criar conta:** na tela de login, "Criar conta" (se a clínica permitir) ou "Usar token de convite". Com um **token válido** sua conta é liberada na hora, com período de teste e/ou créditos. Sem token, a conta pode aguardar **aprovação** da clínica.
- **Idioma:** seletor com bandeiras: português, espanhol, guarani, inglês e chinês. Nomes, mensagens e prontuário nunca são traduzidos.
- **Estado:** Online, Ocupado ou Offline, na barra superior. **Notificações:** sino na barra superior.
- **Instalar como app:** o navegador oferece "Instalar" (PWA).

## 2. A área de trabalho
- **Desktop:** com nenhuma conversa aberta aparecem a logo, os **post-its** (agenda de hoje, tarefas, notificações, anotações) e a barra de ícones das funcionalidades. Clique num post-it para abrir a tela. Arraste pelo título; **▁** minimiza para a pilha lateral; 2 cliques no título recolhem a barra.
- **Dock de funcionalidades** (base da tela): clique no ícone para **abrir**; se já está aberta, **minimiza**; a ativa fica marcada. Funciona dentro de qualquer funcionalidade.
- **Barra de submenus** (topo): mostra as subfunções da funcionalidade em foco, ícones pequenos lado a lado e coloridos. Clique para minimizar/restaurar um quadro, **3 cliques** fecham a funcionalidade, e dá para arrastá-la (volta ao lugar ao abrir outra). "Fechar todos os quadros" e "Abrir todos os painéis" estão nela. Ao abrir, a funcionalidade começa **sem quadros**; eles abrem na última modalidade usada (normal ou maximizado).
- **Quadros e painéis:** arraste pelo título, redimensione pelo canto, ⤢ maximiza, ▁ ou **2 cliques no título** minimizam, ✕ oculta. Ocultos voltam pelo menu **Painéis**; **Reorganizar** restaura o padrão. Ajuda, assistente, dock e barra da consulta também podem ser movidos.
- **Cor:** ao abrir um quadro pelo ícone, o fundo assume a cor do ícone, ligando visualmente a função ao que aparece.
- **Menu lateral:** contatos e grupos em blocos coloridos recolhíveis (crie grupos, arraste pessoas). Aproxime o mouse da borda para revelar; fixe pela aba vertical da logo. Clicar na logo leva ao desktop.
- **Anotações:** guarde observações a partir do mapa de relações e outros pontos; aparecem como post-its amarelos laterais (passe o mouse para ver o título). **Ficam só neste navegador**: apague em computador compartilhado.

## 3. Conversas
Chat em tempo real com indicador de online, botão **Traduzir** por mensagem, **urgente** em destaque, **fixar** mensagens, canais internos (plantão, avisos gerais). Atalhos conforme o interlocutor: paciente → *Agendar consulta* / *Ver prontuário*; médico ↔ médico → *Interconsulta*; recepção → *Checar agenda*.

## 4. Agenda
Agenda visual: arraste cards para mudar horário (conflitos são recusados), `+` cria, clique abre detalhes e notas (cifradas). Ao mover, o sistema pede o **motivo** (pode desativar "não pedir mais"; o administrador restabelece). O card mostra **risco de falta**; o lembrete por SMS sai 24 h antes (48 h se o risco for alto). Em toque, use o campo "Data e horário" do detalhe. Ao abrir um paciente, os cards dele ficam em destaque; "Limpar foco" volta ao normal.

## 5. Teleconsulta (profissionais e pacientes)
- **Video Chat** abre para consulta agendada agora (±3 h). A janela pode ser movida, redimensionada, maximizada ou reduzida a miniatura no canto; compartilhe a tela. **Convite de especialista** por link (só durante a consulta).
- **Paciente:** quando o profissional liga a transcrição, aparece um pedido de **consentimento**. Sem aceite, seu áudio não é enviado nem transcrito.
- **Profissional:** a barra da chamada traz *transcrição ao vivo*, *transcrição estruturada* (queixa, HDA, medicações, alergias, hipóteses, conduta, pendências), *histórico por minuto*, *apoio cognitivo* (hipóteses, condutas, riscos, perguntas, interconsultas, conforme a hierarquia: Ministério da Saúde → sociedades → OMS → seu material → material geral; sua **preferência local** é sinalizada), *relatório* (padrão de documentação médica + relato de caso CARE; edite, salve, copie, exporte em PDF) e *biblioteca*. A transcrição exige o seu consentimento para IA nas configurações.
- Tudo que a IA gera é **rascunho de apoio**: revise antes de usar.

## 6. Prontuário e caso clínico (profissionais de saúde)
- **Resumo, evolução (EVA), metas, plano e documentos** no painel do paciente. A IA estrutura a conversa em rascunho; só entra no prontuário depois que você **aprova**.
- **Caso clínico:** resumo de apresentação, conduta e próximos passos pelas diretrizes do seu país, alternativas internacionais, **SOAP** e **estudo de caso** (com opção de anonimizar). Resultados abrem como janelas que você minimiza, copia, fixa no desktop ou exporta em PDF.
- **Familiograma e ecomapa:** a IA desenha a partir da história familiar aprovada (sem o nome do paciente) e o que faltar aparece em "o que perguntar". Edite pessoas, uniões e vínculos, imprima. Confirme sempre com o paciente.
- **Biblioteca:** guarde materiais próprios e preferências locais. O administrador cadastra fontes oficiais e pode **reordenar a hierarquia protocolar**.
- **Receitas, atestados e pedidos:** exigem registro profissional configurado. Cada documento tem **validade** e **usos máximos**; o QR abre a verificação com o médico responsável, e quem usa marca "foi utilizada". A assinatura é eletrônica simples, **não ICP-Brasil**.
- **Exercícios, rotinas e tarefas:** o paciente cumpre as etapas em ordem (QR de rotina) e registra dor; o profissional é notificado.

## 7. Recepção e administração
- **Usuários:** criar (senha temporária mostrada uma vez), aprovar ou recusar cadastros, vincular paciente ↔ profissional, bloquear/reativar. O **administrador** também: **redefinir senha**, **destravar** conta, **encerrar sessões**, configurar registro profissional e assinatura. A lista mostra **último acesso**. Só o root cria administradores. Recepção e funcionário cadastram apenas pacientes e nunca veem dado clínico.
- **Financeiro:** entradas, saídas, pacotes de sessões e pagamentos PayPal.
- **Integrações:** chaves de vídeo, IA, PayPal, SMS e **cadastro público** (desativado, com aprovação ou aberto); cada chave é testada ao salvar.
- **Restaurar a configuração original (só o root):** em Integrações, informe sua senha de root e digite RESTAURAR para apagar as integrações e reabrir o assistente de instalação. Usuários, prontuários e créditos **não** são apagados. Use quando for trocar de provedores ou refazer a configuração do zero.
- **Auditoria:** quem fez o quê, em cadeia à prova de adulteração (verifique a integridade). **Alertas** de anomalias e faltas. **Relações (3D)** e **Histórico de atividades** em Relatórios.

## 8. Créditos e planos
- **Menu Créditos** (todos os perfis): saldo, plano, validade do plano ou teste, **extrato** e planos. Alterne **Semanal** ou **Mensal**: Básico (grátis), Essencial, Profissional e Clínica, com mais vantagens a cada nível. Os créditos do ciclo entram ao ativar e na renovação.
- **Comprar:** "Assinar" (PayPal ou pedido que o administrador confirma). Planos gratuitos ativam na hora.
- **Tenho um token:** informe um token de convite ou promoção para ganhar teste e créditos (uma vez por token).
- **Recursos com custo** aparecem na tela com o valor em créditos; os demais são livres. Se uma ação falhar, os créditos voltam.
- **Teste ou plano vencido, ou acesso bloqueado:** o sistema leva você direto a esta tela para escolher um plano.
- **Embaixador:** se o administrador lhe deu esse nível, você cria **grupos de tokens** (nome, quantidade, usos, bônus, dias de teste dentro dos limites mostrados), acompanha usos e ganha créditos por cada cadastro.
- **Administrador, Gestão de créditos:** *Regras* (ligar a cobrança, limites do programa de embaixadores, situação geral), *Planos* (preços, créditos e vantagens), *Custos* por funcionalidade (0 = livre), *Usuários* (conceder créditos, conceder plano, dar teste, bloquear, tornar embaixador, distribuir créditos em massa), *Tokens* (criar promoções, com dono para premiar quem indicou; ativar/desativar o **TALK**), *Pedidos* (confirmar pagamento) e *Extrato*.

## 9. Privacidade e segurança
Você só vê os dados a que seu perfil dá direito; profissionais veem apenas pacientes vinculados. Mensagens, transcrições, notas e prontuário são cifrados. O nome do paciente é removido do texto enviado à IA. Troque a senha periodicamente, nunca a compartilhe e encerre a sessão em computadores de uso comum.

## 10. Dúvidas frequentes
- **Esqueci a senha:** peça ao administrador para redefinir (você receberá uma senha temporária).
- **Conta travada:** aguarde 15 minutos ou peça para destravar.
- **Não aparece uma função:** ela não faz parte do seu perfil; use o botão Ajuda.
- **A tela pediu créditos:** seu teste ou plano acabou; escolha um plano em Créditos.
- **Vídeo sem imagem:** permita câmera e microfone no navegador (exige HTTPS).

### Qual usuário e senha usar após instalar?
- **Pelo assistente (normal):** no passo "Quem vai usar o sistema?" você define o usuário do root (padrão `root`), nome e e-mail, e escolhe **gerar senha temporária** (recomendado) ou a sua. Na última tela aparecem as credenciais **uma única vez**: copie. No primeiro login o sistema pede uma senha nova (12+ caracteres).
- **Não anotou, ou o assistente não abriu:** rode no servidor `docker compose exec app node src/reset-root.js` (sem Docker: `node src/reset-root.js`). Ele gera uma senha temporária nova para o root, ou cria o root se não existir, e a mostra no terminal.
