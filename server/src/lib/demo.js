import { randomBytes } from 'node:crypto';

/*
 * The seeded accounts. A fixed password printed in the README and on the
 * login page made every visitor of a deployed copy an administrator — with
 * access to applicants' CVs — so a deployment chooses its own passwords, and
 * chooses separately what the login page may offer.
 *
 *   ADMIN_PASSWORD  the two administrator accounts
 *   DEMO_PASSWORD   the two researcher accounts
 *   DEMO_LOGINS     none | researcher | all — accounts the login page lists
 *
 * In production an unset password is generated at seeding time and printed
 * once to the log. Outside production both default to a known value so the
 * project works straight after cloning.
 */
const production = process.env.NODE_ENV === 'production';
const DEV_PASSWORD = 'genomika2026';

const configured = {
  admin: process.env.ADMIN_PASSWORD || (production ? null : DEV_PASSWORD),
  researcher: process.env.DEMO_PASSWORD || (production ? null : DEV_PASSWORD)
};

export const DEMO_ACCOUNTS = [
  { email: 'admin@genomika.mk',        role: 'admin',      person: 'ana-trajkovska' },
  { email: 'f.micevski@genomika.mk',   role: 'admin',      person: 'filip-micevski' },
  { email: 'n.avramovski@genomika.mk', role: 'researcher', person: 'nikola-avramovski' },
  { email: 's.jovanoska@genomika.mk',  role: 'researcher', person: 'sara-jovanoska' }
];

/** The password to seed for a role: the configured one, or a fresh random one. */
export function seedPassword(role) {
  return configured[role] ?? randomBytes(12).toString('base64url');
}

const LISTED = { none: [], researcher: ['researcher'], all: ['researcher', 'admin'] };
const listing = LISTED[process.env.DEMO_LOGINS] ?? (production ? LISTED.none : LISTED.all);

/**
 * What the login page may show: one account per listed role, and only when
 * its password is known here — a generated one is not, by design.
 */
export function listedDemoLogins() {
  return listing
    .filter(role => configured[role])
    .map(role => ({ role, email: DEMO_ACCOUNTS.find(a => a.role === role).email, password: configured[role] }));
}
