import { saveAccount, forgetAccount, getSavedAccountIds, rememberTermsAccepted, hasAcceptedTermsLocally } from '../src/app/services/savedAccounts';
import { trustDevice, untrustDevice, isDeviceTrusted } from '../src/app/services/deviceTrust';
import { teachesClass } from '../src/app/services/classAccess';

beforeEach(() => localStorage.clear());

describe('saved accounts (account switcher)', () => {
  test('adds each account once and forgets it', () => {
    saveAccount('a1'); saveAccount('a1'); saveAccount('s1');
    expect(getSavedAccountIds()).toEqual(['a1', 's1']);
    forgetAccount('a1');
    expect(getSavedAccountIds()).toEqual(['s1']);
  });
  test('ignores empty ids and corrupt storage', () => {
    saveAccount(null); saveAccount('');
    expect(getSavedAccountIds()).toEqual([]);
    localStorage.setItem('savedAccounts:v1', '{broken');
    expect(getSavedAccountIds()).toEqual([]);
  });
  test('remembers Terms acceptance per account', () => {
    rememberTermsAccepted('a1');
    expect(hasAcceptedTermsLocally('a1')).toBe(true);
    expect(hasAcceptedTermsLocally('s1')).toBe(false);
  });
});

describe('trusted devices', () => {
  test('trust is per email and case-insensitive', () => {
    trustDevice('Ann@Example.com');
    expect(isDeviceTrusted('ann@example.com')).toBe(true);
    expect(isDeviceTrusted('other@example.com')).toBe(false);
  });
  test('signing out untrusts the device', () => {
    trustDevice('a@x.com');
    untrustDevice('A@x.com');
    expect(isDeviceTrusted('a@x.com')).toBe(false);
  });
  test('no email is never trusted', () => {
    expect(isDeviceTrusted(undefined)).toBe(false);
  });
});

describe('class access', () => {
  const c = { instructorId: 'owner', coInstructors: ['co'] };
  test('owner and co-instructors teach the class', () => {
    expect(teachesClass(c, 'owner')).toBe(true);
    expect(teachesClass(c, 'co')).toBe(true);
  });
  test('others and missing data do not', () => {
    expect(teachesClass(c, 'student')).toBe(false);
    expect(teachesClass({ instructorId: 'owner' }, 'co')).toBe(false);
    expect(teachesClass(null, 'owner')).toBe(false);
    expect(teachesClass(c, undefined)).toBe(false);
  });
});
