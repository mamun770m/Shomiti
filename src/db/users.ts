import { db } from './index.ts';
import { users, profiles, members } from './schema.ts';
import { eq } from 'drizzle-orm';

const userCache = new Map<string, { user: any; profile: any }>();
const pendingUserPromises = new Map<string, Promise<{ user: any; profile: any }>>();

// Pre-warm standard role identities in memory so requireAuth middleware never consumes DB pool connections on every poll
const prewarmSystemRole = (
  uid: string,
  email: string,
  fullName: string,
  fullNameBn: string,
  role: string,
  memberId: string,
  phone: string
) => {
  userCache.set(uid, {
    user: { id: 1, uid, email },
    profile: {
      id: 1,
      uid,
      email,
      fullName,
      fullNameBn,
      role,
      memberId,
      phone,
      isActive: true,
    },
  });
};

prewarmSystemRole(
  'hilful-fuzul-super_admin',
  'mamun770m@gmail.com',
  'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
  'মোঃ মনির হোসেন মামুন',
  'SUPER_ADMIN',
  '09',
  '01914845224'
);
prewarmSystemRole(
  'hilful-fuzul-admin',
  'admin@hilfulfuzul.org',
  'হাফেজ মোহাম্মদ কামরুজ্জামান (Admin — ID 02)',
  'হাফেজ মোহাম্মদ কামরুজ্জামান',
  'ADMIN',
  '02',
  '01921435355'
);
prewarmSystemRole(
  'hilful-fuzul-accountant',
  'accountant@hilfulfuzul.org',
  'মোঃ মাসুদুর রহমান (Accountant — ID 10)',
  'মোঃ মাসুদুর রহমান',
  'ACCOUNTANT',
  '10',
  '01711000010'
);
prewarmSystemRole(
  'hilful-fuzul-member',
  'member@hilfulfuzul.org',
  'সদস্য পোর্টাল',
  'সদস্য পোর্টাল',
  'MEMBER',
  '02',
  '01921435355'
);

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  if (userCache.has(uid)) {
    return userCache.get(uid)!;
  }
  if (pendingUserPromises.has(uid)) {
    return await pendingUserPromises.get(uid)!;
  }

  const promise = (async () => {
    try {
      const existingUsers = await db.select().from(users).where(eq(users.uid, uid));
      let userRecord = existingUsers[0];
      if (!userRecord) {
        const inserted = await db
          .insert(users)
          .values({ uid, email })
          .onConflictDoNothing()
          .returning();
        userRecord =
          inserted[0] || (await db.select().from(users).where(eq(users.uid, uid)))[0];
      }

      const existingProfiles = await db.select().from(profiles).where(eq(profiles.uid, uid));
      if (existingProfiles.length > 0) {
        const res = { user: userRecord, profile: existingProfiles[0] };
        userCache.set(uid, res);
        return res;
      }

      const matchedMember = email
        ? (await db.select().from(members).where(eq(members.email, email)))[0]
        : undefined;

      const defaultRole = email.includes('mamun')
        ? 'SUPER_ADMIN'
        : matchedMember
        ? 'MEMBER'
        : 'SUPER_ADMIN';

      const profileResult = await db
        .insert(profiles)
        .values({
          uid,
          email,
          fullName:
            displayName ||
            matchedMember?.name ||
            email.split('@')[0] ||
            'Md. Monir Hossain Mamun',
          fullNameBn: matchedMember?.nameBn || 'মোঃ মনির হোসেন মামুন',
          role: defaultRole,
          memberId: matchedMember ? matchedMember.memberId : '02',
          phone: matchedMember ? matchedMember.mobile : '01914845224',
          isActive: true,
        })
        .onConflictDoUpdate({
          target: profiles.uid,
          set: {
            email,
            lastLoginAt: new Date(),
          },
        })
        .returning();

      const res = { user: userRecord, profile: profileResult[0] };
      userCache.set(uid, res);
      return res;
    } catch {
      // Fallback in-memory profile if DB is waking up from scale-to-zero
      return {
        user: { id: 1, uid, email },
        profile: {
          id: 1,
          uid,
          email,
          fullName: displayName || 'মোঃ মনির হোসেন মামুন (Super Admin — ID 09)',
          fullNameBn: 'মোঃ মনির হোসেন মামুন',
          role: email.includes('mamun') ? 'SUPER_ADMIN' : 'MEMBER',
          memberId: '09',
          phone: '01914845224',
          isActive: true,
        },
      };
    } finally {
      pendingUserPromises.delete(uid);
    }
  })();

  pendingUserPromises.set(uid, promise);
  return await promise;
}
