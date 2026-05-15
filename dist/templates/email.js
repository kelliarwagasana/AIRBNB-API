const primaryColor = "#FF5A5F";
export function welcomeEmail(name, role) {
    const message = role === "HOST"
        ? "Start creating your first listing and welcome guests!"
        : "Explore amazing places and book your next stay!";
    return `
    <div style="font-family: Arial; padding: 20px;">
      <h1 style="color: ${primaryColor};">Welcome to Airbnb, ${name}! 🎉</h1>
      <p>${message}</p>
      <a href="#" style="
        display: inline-block;
        margin-top: 20px;
        padding: 10px 20px;
        background-color: ${primaryColor};
        color: white;
        text-decoration: none;
        border-radius: 5px;
      ">
        Get Started
      </a>
    </div>
  `;
}
export function bookingConfirmationEmail(guestName, listingTitle, location, checkIn, checkOut, totalPrice) {
    return `
    <div style="font-family: Arial; padding: 20px;">
      <h2 style="color: ${primaryColor};">Booking Confirmed 🎉</h2>
      <p>Hi ${guestName},</p>
      <p>Your booking has been confirmed!</p>

      <ul>
        <li><strong>Listing:</strong> ${listingTitle}</li>
        <li><strong>Location:</strong> ${location}</li>
        <li><strong>Check-in:</strong> ${checkIn}</li>
        <li><strong>Check-out:</strong> ${checkOut}</li>
        <li><strong>Total Price:</strong> $${totalPrice}</li>
      </ul>

      <p><strong>Note:</strong> Please review the cancellation policy before your stay.</p>
    </div>
  `;
}
export function bookingCancellationEmail(guestName, listingTitle, checkIn, checkOut) {
    return `
    <div style="font-family: Arial; padding: 20px;">
      <h2 style="color: ${primaryColor};">Booking Cancelled ❌</h2>
      <p>Hi ${guestName},</p>
      <p>Your booking has been cancelled.</p>

      <ul>
        <li><strong>Listing:</strong> ${listingTitle}</li>
        <li><strong>Check-in:</strong> ${checkIn}</li>
        <li><strong>Check-out:</strong> ${checkOut}</li>
      </ul>

      <p>We encourage you to explore other listings and find a new place to stay.</p>

      <a href="http://localhost:4000/listings"
        display: inline-block;
        margin-top: 20px;
        padding: 10px 20px;
        background-color: ${primaryColor};
        color: white;
        text-decoration: none;
        border-radius: 5px;
      ">
        Browse Listings
      </a>
    </div>
  `;
}
export function passwordResetEmail(name, resetLink) {
    return `
    <div style="font-family: Arial; padding: 20px;">
      <h2 style="color: ${primaryColor};">Reset Your Password 🔐</h2>
      <p>Hi ${name},</p>
      <p>Click the button below to reset your password:</p>

      <a href="${resetLink}" style="
        display: inline-block;
        margin-top: 20px;
        padding: 12px 25px;
        background-color: ${primaryColor};
        color: white;
        text-decoration: none;
        border-radius: 5px;
        font-weight: bold;
      ">
        Reset Password
      </a>

      <p style="margin-top: 20px;">This link will expire in 1 hour.</p>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `;
}
