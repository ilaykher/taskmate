import jwt from 'jsonwebtoken';

export function setTokenCookie(res, userId) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn });
  res.cookie('taskmate_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearTokenCookie(res) {
  res.clearCookie('taskmate_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
}
