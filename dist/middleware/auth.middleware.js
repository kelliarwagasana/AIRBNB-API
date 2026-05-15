import jwt from "jsonwebtoken";
const JWT_SECRET = process.env["JWT_SECRET"];
// ─── authenticate ─────────────────────────────────────────────────────────────
// Verifies the JWT token from the Authorization header.
// Attaches userId and role to the request for downstream handlers.
// Returns 401 if token is missing, invalid, or expired.
export function authenticate(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.role = decoded.role;
        next();
    }
    catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}
// ─── requireHost ──────────────────────────────────────────────────────────────
// Must run after authenticate.
// Returns 403 if the user's role is not HOST.
export function requireHost(req, res, next) {
    if (req.role !== "HOST" && req.role !== "ADMIN") {
        return res.status(403).json({ error: "Only hosts or admins can perform this action" });
    }
    next();
}
// ─── requireGuest ─────────────────────────────────────────────────────────────
// Must run after authenticate.
// Returns 403 if the user's role is not GUEST.
export function requireGuest(req, res, next) {
    if (req.role !== "GUEST") {
        return res.status(403).json({ error: "Only guests can perform this action" });
    }
    next();
}
export function requireAdmin(req, res, next) {
    if (req.role !== "ADMIN") {
        return res.status(403).json({ error: "Only admins can perform this action" });
    }
    next();
}
