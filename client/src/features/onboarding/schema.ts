import { z } from 'zod';

// We validate the payload, not just the formatting. 10-15 digits.
const phoneRegex = /^\+?[1-9]\d{1,14}$/; 

export const enterpriseSignupSchema = z.object({
  firstName: z.string().min(2, 'First name required').trim(),
  lastName: z.string().min(2, 'Last name required').trim(),
  companyName: z.string().min(2, 'Corporate entity required').trim(),
  phone: z.string().transform(val => val.replace(/\D/g, '')).pipe(z.string().regex(/^[2-9]\d{9}$/, 'Must be a valid 10-digit US number')),
  email: z.string().email('Invalid email').refine(
    (email) => {
      const blockedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'protonmail.com'];
      const domain = email.split('@')[1];
      return !blockedDomains.includes(domain?.toLowerCase());
    }, 
    { message: 'Corporate domains only' }
  ),
  password: z.string()
    .min(12, 'Passphrase must be at least 12 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passphrases do not match",
  path: ["confirmPassword"],
});

export const verificationSchema = z.object({
  code: z.string().length(6, 'Must be exactly 6 digits').regex(/^\d+$/, 'Numbers only')
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Passphrase is required')
});

// --- NEW: STRICT CSV ROW VALIDATION ---
export const csvRowSchema = z.object({
  mpn: z.string().min(2, 'Invalid MPN'),
  manufacturer: z.string().default('Unknown'),
  quantity: z.number().int().positive('Quantity must be > 0'),
  target_price: z.number().positive().nullable(),
  lead_time_weeks: z.number().int().nonnegative().nullable()
});

export type EnterpriseSignupData = z.infer<typeof enterpriseSignupSchema>;
export type VerificationData = z.infer<typeof verificationSchema>;
export type LoginData = z.infer<typeof loginSchema>;