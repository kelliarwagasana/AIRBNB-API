import multer from "multer";
import { Request } from "express";

// 1. Use memory storage (files stay in RAM as Buffer)
const storage = multer.memoryStorage();

// 2. File filter (only allow specific image types)
function fileFilter(
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only jpeg, png, webp allowed"));
  }
}

// 3. Limits (max 5MB)
const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB
};

// 4. Custom error handler for multer
function handleMulterError(err: Error, req: Request, res: any, next: any) {
  if (err.message === "Unexpected field") {
    return res.status(400).json({
      error: "Unexpected field",
      message: "Make sure the form field is named 'avatar'",
      received: Object.keys(req.body || {}),
    });
  }
  next(err);
}

// 5. Export configured multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits,
});

export { handleMulterError };