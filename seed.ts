import "dotenv/config";
import { prisma } from "./src/lib/prisma.js";
import bcrypt from "bcrypt";
import { title } from "node:process";

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.booking.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  // Create 3 users (at least 1 host, 1 guest)
  const user1 = await prisma.user.upsert({
    where: {
      email: "john@example.com",
    },
    update: {
      name: "John Host",
      username: "johnhost",
    },
    create: {
      name: "John Host",
      email: "john@example.com",
      username: "johnhost",
      phone: "555-1234",
      role: "HOST",
     // avatar: "https://i.pravatar.cc/150?u=john",
      bio: "Superhost with 5+ years experience",
      password: await bcrypt.hash("password123", 10),
    },
  });

  const user2 = await prisma.user.upsert({
    where: {
      email: "jane@example.com",
    },
    update: {
      name: "Jane Guest",
      username: "janeguest",
    },
    create: {
      name: "Jane Guest",
      email: "jane@example.com",
      username: "janeguest",
      phone: "555-5678",
      role: "GUEST",
     // avatar: "https://i.pravatar.cc/150?u=jane",
      password: await bcrypt.hash("password123", 10),
    },
  });

  const user3 = await prisma.user.upsert({
    where: {
      email: "bob@example.com",
    },
    update: {
      name: "Bob Smith",
      username: "bobsmith",
    },
    create: {
      name: "Bob Smith",
      email: "bob@example.com",
      username: "bobsmith",
      phone: "555-9012",
      role: "GUEST",
     // avatar: "https://i.pravatar.cc/150?u=bob",
      password: await bcrypt.hash("password123", 10),
    },
  });

  console.log("✅ Created 3 users");

  // Create 3 listings
  const listing = await prisma.listing.createMany({
    data: [
      {
        title: "Cozy Downtown Apartment",
        description: "Beautiful 2-bedroom apartment in the heart of the city. Walking distance to restaurants and attractions.",
        location: "New York",
        pricePerNight: 150.0,
        guests: 4,
        type: "APARTMENT",
        amenities: ["WiFi", "Kitchen", "Air Conditioning", "TV"],
        rating: 4.8,
        hostId: user1.id,
      },
      {
        title: "Beachfront Villa",
        description: "Luxury villa with stunning ocean views. Private pool and direct beach access.",
        location: "Miami",
        pricePerNight: 350.0,
        guests: 8,
        type: "VILLA",
        amenities: ["WiFi", "Pool", "Kitchen", "Parking", "Air Conditioning"],
        rating: 4.9,
        hostId: user1.id,
      },
      {
        title: "Mountain Cabin Retreat",
        description: "Peaceful cabin surrounded by nature. Perfect for a weekend getaway.",
        location: "Denver",
        pricePerNight: 95.0,
        guests: 2,
        type: "CABIN",
        amenities: ["WiFi", "Fireplace", "Kitchen"],
        rating: 4.7,
        hostId: user1.id,
      }
    ],
    skipDuplicates: true,
  });

  const listing1 = await prisma.listing.create({
    data: {
      title: "GREAT Downtown Apartment",
      description: "Beautiful 3-bedroom apartment in the heart of the city. Walking distance to restaurants and attractions.",
      location: "New York",
      pricePerNight: 150.0,
      guests: 4,
      type: "APARTMENT",
      amenities: ["WiFi", "Kitchen", "Air Conditioning", "TV"],
      rating: 4.8,
      hostId: user1.id,
    },
  });

  console.log("✅ Created 3 listings");

  // Create 2 bookings
   await prisma.booking.create({
    data: {
      guestId: user2.id,
      listingId: listing1.id,
      checkIn: new Date("2026-05-01"),
      checkOut: new Date("2026-05-03"),
      totalPrice: 300.0, // 2 nights x $150
      status: "CONFIRMED",
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      guestId: user3.id,
      listingId: listing1.id,
      checkIn: new Date("2026-06-15"),
      checkOut: new Date("2026-06-20"),
      totalPrice: 1750.0, // 5 nights x $350
      status: "PENDING",
    },
  });

  console.log("✅ Created 2 bookings");

  console.log("\n🎉 Database seeded successfully!");
  console.log(`   - 3 users (1 host, 2 guests)`);
  console.log(`   - 3 listings`);
  console.log(`   - 2 bookings`);
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
