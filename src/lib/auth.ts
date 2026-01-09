
export function requireAuth(req, res, next) {
  //  DEV MODE: auto-admin
  if (process.env.NODE_ENV !== 'production') {
    req.user = {
      id: 'dev-admin',
      role: 'ADMIN',
    };
    return next();
  }

  // production auth (disabled for now)
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'Missing token' });
  }

  return res.status(401).json({ error: 'Invalid token' });
}

export function requireRole(roles: string[]) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}