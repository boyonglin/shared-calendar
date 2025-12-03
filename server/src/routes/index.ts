/**
 * Main API router - aggregates all route modules
 *
 * Route structure:
 * - /api/users/*     - User profile operations
 * - /api/calendar/*  - Calendar events and provider integrations
 * - /api/friends/*   - Friend connections and calendar sharing
 * - /api/ai/*        - AI-powered features
 */
import express from "express";
import usersRoutes from "./users.js";
import calendarRoutes from "./calendar.js";
import friendsRoutes from "./friends.js";
import aiRoutes from "./ai.js";

const router = express.Router();

// Mount route modules
router.use("/users", usersRoutes);
router.use("/calendar", calendarRoutes);
router.use("/friends", friendsRoutes);
router.use("/ai", aiRoutes);

export default router;
