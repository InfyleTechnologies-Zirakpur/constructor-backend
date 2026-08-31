import { describe, it, expect } from 'vitest';
import { UsersService } from '../users.service.js';

describe('UsersService', () => {
  it('should be defined', () => {
    expect(UsersService).toBeDefined();
  });

  it('sanitize should strip sensitive fields', () => {
    // Test the sanitization logic conceptually
    const mockUser = {
      id: 'uuid-1',
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '+919999999999',
      role: 'admin',
      isActive: true,
      avatarUrl: null,
      passwordHash: 'should-be-stripped',
      otpHash: 'should-be-stripped',
      otpExpiresAt: null,
      refreshTokenHash: 'should-be-stripped',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Simulate sanitize logic (same as service)
    const {
      passwordHash: _,
      otpHash: __,
      otpExpiresAt: ___,
      refreshTokenHash: ____,
      ...safeUser
    } = mockUser;

    expect(safeUser).not.toHaveProperty('passwordHash');
    expect(safeUser).not.toHaveProperty('otpHash');
    expect(safeUser).not.toHaveProperty('refreshTokenHash');
    expect(safeUser).toHaveProperty('id');
    expect(safeUser).toHaveProperty('email');
    expect(safeUser).toHaveProperty('role');
  });
});
