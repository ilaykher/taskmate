import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { clearTokenCookie, setTokenCookie } from '../utils/token.js';

const userDetails = ({ id, name, email }) => ({ id, name, email });

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Enter a name, valid email, and password with at least 8 characters.' });
  }
  try {
    const user = await prisma.user.create({ data: { name: name.trim(), email: email.trim().toLowerCase(), passwordHash: await bcrypt.hash(password, 12) } });
    setTokenCookie(res, user.id);
    res.status(201).json({ user: userDetails(user) });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'An account with this email already exists.' });
    throw error;
  }
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ message: 'Email and password are required.' });
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  setTokenCookie(res, user.id);
  res.json({ user: userDetails(user) });
});

export const me = asyncHandler(async (req, res) => { res.json({ user: userDetails(req.user) }); });
export const logout = asyncHandler(async (req, res) => { clearTokenCookie(res); res.json({ message: 'Signed out.' }); });
