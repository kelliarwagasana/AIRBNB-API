import { Router } from "express";
import authRouter from "./auth.routes.js";
import usersRouter from "./users.route.js";
import listingsRouter from "./listings.route.js";
import bookingsRouter from "./bookings.route.js";
import reviewsRouter from "./review.routes.js";
import aiRouter from "./ai.routes.js";
import uploadRouter from "./upload.routes.js";
import adminRouter from "./admin.routes.js";
import savedRouter from "./saved.routes.js";
import notificationsRouter from "./notifications.route.js";
import analyticsRouter from "./analytics.routes.js";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/users", usersRouter);
v1Router.use("/listings", listingsRouter);
v1Router.use("/bookings", bookingsRouter);
v1Router.use("/reviews", reviewsRouter);
v1Router.use("/ai", aiRouter);
v1Router.use("/upload", uploadRouter);
v1Router.use("/admin", adminRouter);
v1Router.use("/saved", savedRouter);
v1Router.use("/notifications", notificationsRouter);
v1Router.use("/analytics", analyticsRouter);

export default v1Router;