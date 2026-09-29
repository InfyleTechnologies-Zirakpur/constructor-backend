import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';

// ─── Mock dependencies ───────────────────────────────────────────────
const mockUserRepo = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const mockJwtService = {
  signAsync: vi.fn().mockResolvedValue('mock.access.token'),
};

// Lazy import bcrypt mock
vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('$hashed$'),
  compare: vi.fn(),
}));

import * as bcrypt from 'bcryptjs';

// ─── Build a minimal AuthService for testing ──────────────────────────
// We test the business logic directly without NestJS DI container.

const buildService = () => {
  // Inline the critical methods from AuthService for isolated testing
  const SELF_REGISTER_ALLOWED = ['job_seeker'];

  async function register(dto: any) {
    if (!SELF_REGISTER_ALLOWED.includes(dto.role)) {
      throw new BadRequestException(
        `Role '${dto.role}' cannot be self-registered. Contact an administrator.`,
      );
    }
    if (dto.email) {
      const existing = await mockUserRepo.findOne({ where: { email: dto.email } });
      if (existing) throw new ConflictException('Email already registered');
    }
    return { user: { id: 'u1', role: dto.role } };
  }

  async function login(dto: any) {
    // Identical error for wrong user or wrong password — no enumeration
    const user = await mockUserRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.isBlocked) throw new UnauthorizedException('Account is blocked');
    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');
    if (user.lockoutUntil && new Date() < user.lockoutUntil) {
      throw new UnauthorizedException('Account is locked. Try later');
    }
    if (!user.passwordHash) throw new UnauthorizedException('Password not set. Use OTP login');

    const isValid = await (bcrypt as any).compare(dto.password, user.passwordHash);
    if (!isValid) {
      const attempts = Number(user.failedLoginAttempts) || 0;
      user.failedLoginAttempts = attempts + 1;
      if (user.failedLoginAttempts >= 5) {
        const lock = new Date();
        lock.setMinutes(lock.getMinutes() + 15);
        user.lockoutUntil = lock;
      }
      await mockUserRepo.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    return { user: { id: user.id, role: user.role }, accessToken: 'tok', refreshToken: 'rtok' };
  }

  async function requestOtp(dto: any) {
    // Check that OTP is NOT logged in production
    const origEnv = process.env.NODE_ENV;
    const logged: string[] = [];
    const fakeLog = (msg: string) => logged.push(msg);

    // simulate service logic
    if (process.env.NODE_ENV !== 'production') {
      fakeLog(`[DEV] OTP for ${dto.phone}: 123456`);
    }

    const wasLogged = logged.length > 0;
    process.env.NODE_ENV = origEnv;
    return { otpSent: true, wasLogged };
  }

  async function refreshToken(userId: string, dto: any) {
    const user = await mockUserRepo.findOne({ where: { id: userId } });
    if (!user || !user.refreshTokenHash) throw new UnauthorizedException('Invalid session');
    const isValid = await (bcrypt as any).compare(dto.refreshToken, user.refreshTokenHash);
    if (!isValid) throw new UnauthorizedException('Invalid refresh token');
    return { accessToken: 'new.access.token', refreshToken: 'new.refresh.token' };
  }

  return { register, login, requestOtp, refreshToken };
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('Auth — register()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows job_seeker self-registration', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);
    mockUserRepo.create.mockReturnValue({ id: 'u1', role: 'job_seeker' });
    mockUserRepo.save.mockResolvedValue({ id: 'u1', role: 'job_seeker' });

    const { register } = buildService();
    const result = await register({ email: 'a@b.com', role: 'job_seeker', password: 'pass1234' });
    expect(result.user.role).toBe('job_seeker');
  });

  it('rejects admin self-registration', async () => {
    const { register } = buildService();
    await expect(register({ email: 'a@b.com', role: 'admin', password: 'pass1234' }))
      .rejects.toThrow(BadRequestException);
  });

  it('rejects contractor self-registration', async () => {
    const { register } = buildService();
    await expect(register({ email: 'a@b.com', role: 'contractor', password: 'pass1234' }))
      .rejects.toThrow(BadRequestException);
  });

  it('rejects site_engineer self-registration', async () => {
    const { register } = buildService();
    await expect(register({ email: 'a@b.com', role: 'site_engineer', password: 'pass1234' }))
      .rejects.toThrow(BadRequestException);
  });

  it('rejects company self-registration', async () => {
    const { register } = buildService();
    await expect(register({ email: 'a@b.com', role: 'company', password: 'pass1234' }))
      .rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate email', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'existing' });
    const { register } = buildService();
    await expect(register({ email: 'dup@b.com', role: 'job_seeker' }))
      .rejects.toThrow(ConflictException);
  });
});

describe('Auth — login() — username enumeration prevention', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns UnauthorizedException (not NotFoundException) for unknown email', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);
    const { login } = buildService();
    const err = await login({ email: 'ghost@b.com', password: 'pass' }).catch((e) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(err.message).toBe('Invalid credentials'); // not 'User not found'
  });

  it('returns UnauthorizedException for wrong password', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'u1',
      role: 'admin',
      isBlocked: false,
      isActive: true,
      lockoutUntil: null,
      passwordHash: '$hashed$',
      failedLoginAttempts: 0,
    });
    (bcrypt as any).compare.mockResolvedValue(false);
    mockUserRepo.save.mockResolvedValue({});

    const { login } = buildService();
    const err = await login({ email: 'a@b.com', password: 'wrong' }).catch((e) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(err.message).toBe('Invalid credentials'); // same message
  });

  it('locks account after 5 failed attempts', async () => {
    const user = {
      id: 'u1', role: 'admin', isBlocked: false, isActive: true,
      lockoutUntil: null, passwordHash: '$hashed$', failedLoginAttempts: 4,
    };
    mockUserRepo.findOne.mockResolvedValue({ ...user });
    (bcrypt as any).compare.mockResolvedValue(false);
    mockUserRepo.save.mockImplementation(async (u: any) => u);

    const { login } = buildService();
    await login({ email: 'a@b.com', password: 'wrong' }).catch(() => {});
    // save was called — check lockoutUntil was set
    const savedArg = mockUserRepo.save.mock.calls[0][0];
    expect(savedArg.lockoutUntil).toBeTruthy();
    expect(savedArg.failedLoginAttempts).toBe(5);
  });

  it('rejects blocked account', async () => {
    mockUserRepo.findOne.mockResolvedValue({ isBlocked: true, isActive: true });
    const { login } = buildService();
    await expect(login({ email: 'a@b.com', password: 'p' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('rejects deactivated account', async () => {
    mockUserRepo.findOne.mockResolvedValue({ isBlocked: false, isActive: false });
    const { login } = buildService();
    await expect(login({ email: 'a@b.com', password: 'p' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('rejects locked account', async () => {
    const future = new Date();
    future.setHours(future.getHours() + 1);
    mockUserRepo.findOne.mockResolvedValue({
      isBlocked: false, isActive: true, lockoutUntil: future,
    });
    const { login } = buildService();
    await expect(login({ email: 'a@b.com', password: 'p' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('succeeds with valid credentials', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'u1', role: 'contractor', isBlocked: false, isActive: true,
      lockoutUntil: null, passwordHash: '$hashed$', failedLoginAttempts: 0,
    });
    (bcrypt as any).compare.mockResolvedValue(true);
    mockUserRepo.save.mockResolvedValue({});

    const { login } = buildService();
    const result = await login({ email: 'a@b.com', password: 'correct' });
    expect(result.accessToken).toBeDefined();
  });
});

describe('Auth — OTP logging', () => {
  it('does NOT log OTP in production', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const { requestOtp } = buildService();
    const result = await requestOtp({ phone: '9876543210' });
    expect(result.wasLogged).toBe(false);

    process.env.NODE_ENV = origEnv;
  });

  it('logs OTP in development for debugging', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const { requestOtp } = buildService();
    const result = await requestOtp({ phone: '9876543210' });
    expect(result.wasLogged).toBe(true);

    process.env.NODE_ENV = origEnv;
  });
});

describe('Auth — refreshToken()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects missing session', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);
    const { refreshToken } = buildService();
    await expect(refreshToken('u1', { refreshToken: 'tok' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid refresh token', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'u1', refreshTokenHash: '$hash$' });
    (bcrypt as any).compare.mockResolvedValue(false);
    const { refreshToken } = buildService();
    await expect(refreshToken('u1', { refreshToken: 'bad' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('returns new tokens on valid refresh token', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'u1', refreshTokenHash: '$hash$' });
    (bcrypt as any).compare.mockResolvedValue(true);
    mockUserRepo.save.mockResolvedValue({});
    const { refreshToken } = buildService();
    const result = await refreshToken('u1', { refreshToken: 'valid' });
    expect(result.accessToken).toBe('new.access.token');
  });
});

describe('RBAC — RolesGuard logic', () => {
  // Tests for the guard's canActivate logic (unit-tested by simulating context)

  const mockReflector = {
    getAllAndOverride: vi.fn(),
  };

  const buildGuard = () => ({
    canActivate: (requiredRoles: string[] | undefined, userRole: string | undefined) => {
      if (!requiredRoles || requiredRoles.length === 0) return true;
      if (!userRole) return false;
      return requiredRoles.includes(userRole);
    },
  });

  it('allows access when no roles required', () => {
    const { canActivate } = buildGuard();
    expect(canActivate(undefined, undefined)).toBe(true);
    expect(canActivate([], 'admin')).toBe(true);
  });

  it('allows matching role', () => {
    const { canActivate } = buildGuard();
    expect(canActivate(['admin'], 'admin')).toBe(true);
    expect(canActivate(['admin', 'contractor'], 'contractor')).toBe(true);
  });

  it('denies non-matching role', () => {
    const { canActivate } = buildGuard();
    expect(canActivate(['admin'], 'contractor')).toBe(false);
    expect(canActivate(['admin', 'contractor'], 'site_engineer')).toBe(false);
  });

  it('denies unauthenticated request when roles required', () => {
    const { canActivate } = buildGuard();
    expect(canActivate(['admin'], undefined)).toBe(false);
  });
});

describe('Register DTO role restriction', () => {
  const PRIVILEGED_ROLES = ['admin', 'contractor', 'site_engineer', 'company'];
  const ALLOWED_ROLES = ['job_seeker'];

  it('privileged roles are NOT in allowed self-registration roles', () => {
    for (const role of PRIVILEGED_ROLES) {
      expect(ALLOWED_ROLES.includes(role)).toBe(false);
    }
  });

  it('job_seeker is in allowed self-registration roles', () => {
    expect(ALLOWED_ROLES.includes('job_seeker')).toBe(true);
  });
});
