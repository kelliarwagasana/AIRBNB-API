import nodemailer from "nodemailer";

const hasEmailConfig = Boolean(
  process.env.EMAIL_HOST &&
  process.env.EMAIL_PORT &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS &&
  process.env.EMAIL_FROM,
);
const shouldVerifyEmailOnStartup = process.env.VERIFY_EMAIL_ON_STARTUP === "true";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
});

if (hasEmailConfig && shouldVerifyEmailOnStartup) {
  transporter.verify((error) => {
    if (error) {
      console.error("Email config error:", error);
    } else {
      console.log("Email server is ready");
    }
  });
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!hasEmailConfig) {
    throw new Error("Email configuration is missing");
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}
