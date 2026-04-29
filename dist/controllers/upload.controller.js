import { prisma } from "../lib/prisma.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";
// POST /users/:id/avatar
export async function uploadAvatar(req, res) {
    try {
        console.log("File:", req.file);
        console.log("Body:", req.body);
        const userId = Number(req.params.id);
        // 1. Ownership check
        if (req.userId !== userId) {
            return res.status(403).json({ error: "Forbidden" });
        }
        // 2. Check file
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        // 3. Find user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                avatarPublicId: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        // 4. Delete old avatar if exists
        if (user.avatarPublicId) {
            await deleteFromCloudinary(user.avatarPublicId);
        }
        // 5. Upload new avatar
        const result = await uploadToCloudinary(req.file.buffer, "airbnb/avatars");
        // 6. Update user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                avatar: result.url,
                avatarPublicId: result.publicId,
            },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                avatarPublicId: true,
            },
        });
        return res.json(updatedUser);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Something went wrong" });
    }
}
// DELETE /users/:id/avatar
export async function deleteAvatar(req, res) {
    try {
        const userId = Number(req.params.id);
        // 1. Ownership check
        if (req.userId !== userId) {
            return res.status(403).json({ error: "Forbidden" });
        }
        // 2. Find user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                avatarPublicId: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        // 3. Check if avatar exists
        if (!user.avatar || !user.avatarPublicId) {
            return res.status(400).json({ error: "No avatar to remove" });
        }
        // 4. Delete from Cloudinary
        await deleteFromCloudinary(user.avatarPublicId);
        // 5. Update DB
        await prisma.user.update({
            where: { id: userId },
            data: {
                avatar: null,
                avatarPublicId: null,
            },
        });
        return res.json({ message: "Avatar removed successfully" });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Something went wrong" });
    }
}
// POST /listings/:id/photos
export async function uploadListingPhotos(req, res) {
    try {
        const listingId = Number(req.params.id);
        // 1. Require authenticate (already handled by middleware)
        // 2. Find listing
        const listing = await prisma.listing.findUnique({
            where: { id: listingId },
            select: {
                id: true,
                hostId: true,
            },
        });
        if (!listing) {
            return res.status(404).json({ error: "Listing not found" });
        }
        // 3. Check listing.hostId === req.userId
        if (listing.hostId !== req.userId) {
            return res.status(403).json({ error: "Forbidden" });
        }
        // 4. Count existing photos
        const existingCount = await prisma.listingPhoto.count({
            where: { listingId },
        });
        // 5. If count is already 5
        if (existingCount >= 5) {
            return res.status(400).json({ error: "Maximum of 5 photos allowed per listing" });
        }
        // 6. Check req.files exists and is not empty
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }
        // 7. Calculate remaining slots
        const remainingSlots = 5 - existingCount;
        const filesToProcess = req.files.slice(0, remainingSlots);
        // 8. For each file: upload to Cloudinary, create ListingPhoto record
        const photoPromises = filesToProcess.map(async (file) => {
            const result = await uploadToCloudinary(file.buffer, "airbnb/listings");
            return prisma.listingPhoto.create({
                data: {
                    url: result.url,
                    publicId: result.publicId,
                    listingId,
                },
            });
        });
        await Promise.all(photoPromises);
        // 9. Return updated listing with all photos
        const updatedListing = await prisma.listing.findUnique({
            where: { id: listingId },
            include: {
                photos: true,
            },
        });
        return res.json(updatedListing);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Something went wrong" });
    }
}
// DELETE /listings/:id/photos/:photoId
export async function deleteListingPhoto(req, res) {
    try {
        const listingId = Number(req.params.id);
        const photoId = Number(req.params.photoId);
        // 1. Require authenticate (already handled by middleware)
        // 2. Find listing
        const listing = await prisma.listing.findUnique({
            where: { id: listingId },
            select: {
                id: true,
                hostId: true,
            },
        });
        if (!listing) {
            return res.status(404).json({ error: "Listing not found" });
        }
        // 3. Check listing.hostId === req.userId
        if (listing.hostId !== req.userId) {
            return res.status(403).json({ error: "Forbidden" });
        }
        // 4. Find photo by photoId
        const photo = await prisma.listingPhoto.findUnique({
            where: { id: photoId },
        });
        if (!photo) {
            return res.status(404).json({ error: "Photo not found" });
        }
        // 5. Verify photo.listingId === id
        if (photo.listingId !== listingId) {
            return res.status(403).json({ error: "Photo does not belong to this listing" });
        }
        // 6. Call deleteFromCloudinary
        if (photo.publicId) {
            await deleteFromCloudinary(photo.publicId);
        }
        // 7. Delete ListingPhoto record from database
        await prisma.listingPhoto.delete({
            where: { id: photoId },
        });
        return res.json({ message: "Photo deleted successfully" });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Something went wrong" });
    }
}
