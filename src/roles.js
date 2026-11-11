// Papéis do sistema. "role" define permissões; "cargo" é o rótulo livre exibido na tela.
export const HEALTH = ['medico', 'fisio', 'enfermeiro', 'nutricionista', 'farmaceutico', 'profissional']; // profissionais de saúde: dado clínico dos pacientes vinculados
export const CARE = [...HEALTH, 'cuidador'];                 // equipe assistencial: agenda, tarefas, evolução e chat (sem prontuário completo)
export const ADMIN_STAFF = ['recepcao', 'funcionario'];       // funcionários sem acesso clínico (secretaria, apoio administrativo etc.)
export const STAFF = [...CARE, ...ADMIN_STAFF, 'admin'];
export const ALL = [...STAFF, 'paciente'];
export const DOCS = { medico: ['receita', 'atestado', 'pedido_exames', 'relatorio'], fisio: ['atestado', 'relatorio'], enfermeiro: ['relatorio'], nutricionista: ['relatorio'], farmaceutico: ['relatorio'], profissional: ['relatorio'] };
