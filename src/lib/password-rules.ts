import { z } from 'zod'

/** Mirrors backend/src/auth/password-policy.ts. */
export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: '8+ characters', test: (p) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Number', test: (p) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export const strongPassword = z
  .string()
  .max(128, 'Use at most 128 characters')
  .refine((p) => !/\s/.test(p), 'Passwords can’t contain spaces')
  .refine(
    (p) => PASSWORD_RULES.every((r) => r.test(p)),
    'Use 8+ characters with an uppercase and a lowercase letter, a number and a special character',
  )

/** The rule as one sentence, shown under password fields. */
export const PASSWORD_HINT = 'At least 8 characters, with upper and lowercase letters, a number and a special character.'
