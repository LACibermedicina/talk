// Política de senhas e cadastro. Senhas fracas (ex.: de teste) só valem em servidor local ou com opt-in explícito.
export const weakAllowed = () => process.env.ALLOW_WEAK_PASSWORDS === 'true' || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(process.env.APP_ORIGIN || '');
export const minPw = () => weakAllowed() ? 6 : 12;
export const USERNAME = /^[a-z][a-z0-9._-]{2,29}$/;
export const signupMode = () => ['approval', 'open'].includes(process.env.SIGNUP_MODE) ? process.env.SIGNUP_MODE : 'off';
