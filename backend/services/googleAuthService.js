const { OAuth2Client } = require('google-auth-library');
const prisma = require('../config/db');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify a Google ID token and return the payload
 */
const verifyGoogleToken = async (idToken) => {
  try {
    const audienceList = [
      process.env.GOOGLE_CLIENT_ID,
      '526721686264-ofhn2er026eej43ee4arn43mntl0h9dr.apps.googleusercontent.com',
    ].filter(Boolean);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: audienceList.length === 1 ? audienceList[0] : audienceList,
    });

    const payload = ticket.getPayload();

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatar: payload.picture,
      emailVerified: payload.email_verified,
    };
  } catch (error) {
    throw { status: 401, message: 'Google Authentication failed: ' + (error.message || 'Invalid or expired token') };
  }
};

/**
 * Login or register via Google
 * If user exists with this googleId → login
 * If user exists with this email but no googleId → link account
 * If no user exists → register
 */
const googleLogin = async (idToken, { role, learnerType } = {}) => {
  const googleData = await verifyGoogleToken(idToken);

  // Security: Prevent privileged role elevation via OAuth
  const allowedRoles = ['STUDENT', 'INSTRUCTOR', 'PARENT'];
  const safeRole = (role && allowedRoles.includes(role.toUpperCase())) ? role.toUpperCase() : 'STUDENT';

  // 1. Check if user exists by googleId
  let user = await prisma.user.findUnique({
    where: { googleId: googleData.googleId },
    include: { learnerProfile: true },
  });

  if (user) {
    return user;
  }

  // 2. Check if user exists by email (link Google to existing account)
  if (googleData.email) {
    user = await prisma.user.findUnique({
      where: { email: googleData.email },
      include: { learnerProfile: true },
    });

    if (user) {
      // Link Google ID to existing account
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleData.googleId,
          avatar: user.avatar || googleData.avatar,
          isEmailVerified: user.isEmailVerified || (googleData.emailVerified ?? true),
        },
        include: { learnerProfile: true },
      });
      return user;
    }
  }

  // 3. Create new user
  user = await prisma.user.create({
    data: {
      name: googleData.name,
      email: googleData.email,
      googleId: googleData.googleId,
      avatar: googleData.avatar,
      role: safeRole,
      learnerType: learnerType || 'SCHOOL',
      isEmailVerified: googleData.emailVerified ?? true,
      // Auto-create learner profile for students
      ...((safeRole === 'STUDENT') && {
        learnerProfile: {
          create: {
            xp: 0,
            level: 1,
            streakDays: 0,
          },
        },
      }),
    },
    include: { learnerProfile: true },
  });

  return user;
};

module.exports = { verifyGoogleToken, googleLogin };
