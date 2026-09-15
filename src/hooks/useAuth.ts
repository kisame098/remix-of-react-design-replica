// Thin re-export from AuthContext.
// Keep backward-compatible `signUpSchool` wrapper so existing code doesn't break.
import { useAuth as useAuthContext } from '@/contexts/AuthContext';

export function useAuth() {
  const ctx = useAuthContext();

  // Backward-compat wrapper: (email, password, schoolName, fullName) → signUp({…})
  const signUpSchool = (
    email: string,
    password: string,
    schoolName: string,
    fullName: string,
  ) => ctx.signUp({ email, password, schoolName, fullName });

  return {
    ...ctx,
    signUpSchool,
    isAdmin: ctx.accountRole === 'admin',
    roles: [],
  };
}
