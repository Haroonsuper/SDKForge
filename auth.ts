import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from './clients.js';

export interface AuthedUser {
  id: string;
  email: string | undefined;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthedUser;
  }
}

/** Verifies the Supabase access token sent as `Authorization: Bearer <jwt>`. */
export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization') ?? '';
    const match = /^Bearer\s+([A-Za-z0-9\-._~+/]+=*)$/.exec(header);
    if (!match || !match[1]) {
      res.status(401).json({ error: 'Missing or malformed Authorization header.' });
      return;
    }
    const { data, error } = await supabaseAdmin.auth.getUser(match[1]);
    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid or expired session.' });
      return;
    }
    req.user = { id: data.user.id, email: data.user.email };
    next();
  } catch (err) {
    console.error('[auth] verification failed', err);
    res.status(500).json({ error: 'Authentication service unavailable.' });
  }
}
