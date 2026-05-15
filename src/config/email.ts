import nodemailer from "nodemailer";

// export const isEmailConfigured = (): boolean =>
//   Boolean(
//     process.env.EMAIL_HOST &&
//       process.env.EMAIL_PORT &&
//       process.env.EMAIL_USER &&
//       process.env.EMAIL_PASS &&
//       process.env.EMAIL_FROM,
//   );

// const hasEmailConfig = isEmailConfigured();
// const shouldVerifyEmailOnStartup = process.env.VERIFY_EMAIL_ON_STARTUP === "true";

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

// if (hasEmailConfig && shouldVerifyEmailOnStartup) {
//   transporter.verify((error) => {
//     if (error) {
//       console.error("Email config error:", error);
//     } else {
//       console.log("Email server is ready");
//     }
//   });
// }

export async function sendEmail(to:string,subject:string,html:string){
  await transporter.sendMail({
    from:process.env["EMAIL_FROM"],
    to,
    subject,
    html
  })
}
export default transporter


