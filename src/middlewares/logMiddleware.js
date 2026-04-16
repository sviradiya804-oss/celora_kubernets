exports.isAdmin = (req, res, next) => {
  if (['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) return next();
  return res.status(403).json({ message: 'Unauthorized' });
};
