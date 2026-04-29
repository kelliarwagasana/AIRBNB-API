import { v2 as cloudinary } from "cloudinary";

// 1. Configure Cloudinary using env variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Upload function
export function uploadToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        folder,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error);
        }

        resolve({
          url: result.secure_url,     //  always use HTTPS
          publicId: result.public_id, //  needed for deletion
        });
      }
    );

    // Write buffer to stream
    stream.end(buffer);
  });
}

// 3. Delete function
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}