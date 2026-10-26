import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies.taskmate_token;
  if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ message: 'Session expired. Please sign in again.' }); }
  if (!Number.isSafeInteger(decoded.id)) return res.status(401).json({ message: 'Invalid session.' });
  req.user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!req.user) return res.status(401).json({ message: 'Account not found.' });
  next();
});
