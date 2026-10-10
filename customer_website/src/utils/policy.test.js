import { describe, expect, it } from 'vitest';
import { validatePasswordStrength } from './passwordPolicy';
import { normalizeCustomerPhone, sanitizePhoneInput, isValidCustomerPhone } from './phonePolicy';

describe('passwordPolicy mirror', () => {
  it('grades weak through strong like the backend', () => {
    expect(validatePasswordStrength('abc').ok).toBe(false);
    expect(validatePasswordStrength('abc').label).toBe('Weak');
    expect(validatePasswordStrength('Password123', {}).failedRule).toBe('common');
    expect(validatePasswordStrength('Asley2024!', { name: 'Asley', email: 'a@b.c' }).failedRule).toBe('personal');
    const strong = validatePasswordStrength('Str0ng!Pass12', { name: 'Asley', email: 'asley@x.ph' });
    expect(strong.ok).toBe(true);
    expect(strong.label).toBe('Strong');
  });

  it('requires 8+, upper, lower, number but not special for submit', () => {
    // No special char: still submittable (Good), special only boosts the score.
    expect(validatePasswordStrength('Str0ngPass12', {}).ok).toBe(true);
    expect(validatePasswordStrength('str0ngpass12', {}).failedRule).toBe('uppercase');
    expect(validatePasswordStrength('STR0NGPASS12', {}).failedRule).toBe('lowercase');
    expect(validatePasswordStrength('StrongPass', {}).failedRule).toBe('number');
  });
});

describe('phonePolicy mirror', () => {
  it('accepts exactly 11 digits starting with 09', () => {
    expect(normalizeCustomerPhone('09569370220')).toEqual({ value: '09569370220' });
    expect(isValidCustomerPhone('09569370220')).toBe(true);
  });

  it('folds +63 pastes into the 09 form', () => {
    expect(normalizeCustomerPhone('+63 956 937 0220')).toEqual({ value: '09569370220' });
    expect(normalizeCustomerPhone('639569370220')).toEqual({ value: '09569370220' });
    expect(sanitizePhoneInput('+63 956 937 0220')).toBe('09569370220');
  });

  it('rejects 10 digits, 12 digits, and letters', () => {
    expect(normalizeCustomerPhone('0956937022').error).toMatch(/11-digit/);
    expect(normalizeCustomerPhone('095693702200').error).toMatch(/11-digit/);
    expect(normalizeCustomerPhone('09abc567890').error).toMatch(/11-digit/);
    expect(isValidCustomerPhone('0956937022')).toBe(false);
  });

  it('sanitize caps at 11 digits for 14-digit pastes', () => {
    expect(sanitizePhoneInput('09569370220000')).toBe('09569370220');
    expect(sanitizePhoneInput('09569370220000').length).toBe(11);
  });
});
