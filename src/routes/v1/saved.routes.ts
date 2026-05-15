import { Router } from "express";
import { getSavedListings, toggleSavedListing } from "../../controllers/saved.controller.js";
import { authenticate, requireGuest } from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/", authenticate, requireGuest, getSavedListings);
router.post("/:listingId", authenticate, requireGuest, toggleSavedListing);

export default router;
