import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import bcrypt from "bcrypt";

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.booking.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  // Create 3 users (at least 1 host, 1 guest)
  const user1 = await prisma.user.upsert({
    where: {
      email: "johnmuka@gmail.com",
    },
    update: {
      name: "John Host",
      username: "johnhost",
    },
    create: {
      name: "John Host",
      email: "johnmuka@gmail..com",
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
      email: "janelia@gmail.com",
    },
    update: {
      name: "Jane Guest",
      username: "jane",
    },
    create: {
      name: "Jane Guest",
      email: "janelia@gmail.com.com",
      username: "janeguest",
      phone: "555-5678",
      role: "GUEST",
     // avatar: "https://i.pravatar.cc/150?u=jane",
      password: await bcrypt.hash("password123", 10),
    },
  });

  const user3 = await prisma.user.upsert({
    where: {
      email: "bobsmith@gmail.com",
    },
    update: {
      name: "Bob Smith",
      username: "bobsmith",
    },
    create: {
      name: "Bob Smith",
      email: "bobsmith@gmail.com",
      username: "bobsmith",
      phone: "555-9012",
      role: "GUEST",
     // avatar: "https://i.pravatar.cc/150?u=bob",
      password: await bcrypt.hash("password123", 10),
    },
  });

  console.log("✅ Created 3 users");

  const cover1 = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80";
  const cover3 = "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1400&q=80";

  const listing1 = await prisma.listing.create({
    data: {
      title: "Cozy Downtown Apartment",
      description:
        "Beautiful 2-bedroom apartment in the heart of the city. Walking distance to restaurants and attractions.",
      location: "New York",
      pricePerNight: 150.0,
      guests: 4,
      type: "APARTMENT",
      amenities: ["WiFi", "Kitchen", "Air Conditioning", "TV"],
      rating: 4.8,
      hostId: user1.id,
      url: cover1,

      photos: {
        create: [
          { url: cover1 },
          {
            url: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80",
          },
        ],
      },
    },
  });

  const listing3 = await prisma.listing.create({
    data: {
      title: "Mountain Cabin Retreat",
      description: "Peaceful cabin surrounded by nature. Perfect for a weekend getaway.",
      location: "Denver",
      pricePerNight: 95.0,
      guests: 2,
      type: "CABIN",
      amenities: ["WiFi", "Fireplace", "Kitchen"],
      rating: 4.7,
      hostId: user1.id,
      url: cover3,

      photos: {
        create: [
          { url: cover3 },
          {
            url: "https://images.unsplash.com/photo-1472224371017-08207f84aaae?auto=format&fit=crop&w=1400&q=80",
          },
        ],
      },
    },
  });

  console.log("✅ Created 2 listings (photos in ListingPhoto; cover also on Listing.url for Prisma Studio)");

  // Create 1 booking
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


  console.log("✅ Created 1 booking");

  console.log("\n🎉 Database seeded successfully!");
  console.log(`   - 3 users (1 host, 2 guests)`);
  console.log(`   - 2 listings`);
  console.log(`   - 1 booking`);
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
