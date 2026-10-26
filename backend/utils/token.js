import jwt from 'jsonwebtoken';

function maxAgeMilliseconds(expiresIn) {
  const match = /^(\d+)(s|m|h|d)$/.exec(expiresIn);
  if (!match) throw new Error('JWT_EXPIRES_IN must use seconds, minutes, hours, or days, such as 7d.');
  return Number(match[1]) * ({ s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 })[match[2]];
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  path: '/'
});

export function setTokenCookie(res, userId) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn });
  res.cookie('taskmate_token', token, { ...cookieOptions(), maxAge: maxAgeMilliseconds(expiresIn) });
}

export function clearTokenCookie(res) {
  res.clearCookie('taskmate_token', cookieOptions());
}
