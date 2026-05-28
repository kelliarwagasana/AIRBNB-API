import type { Response } from 'express'
import { prisma } from '../lib/prisma.js'
import type { AuthRequest } from '../middleware/auth.middleware.js'
import { countByMonth, getCalendarYearMonthBuckets, sumByMonth } from '../utils/analytics.js'

function buildAnalyticsPayload(
  listings: { status: string; createdAt: Date }[],
  bookings: { status: string; totalPrice: number; createdAt: Date }[],
  reviews: { rating: number; createdAt: Date }[],
) {
  const months = getCalendarYearMonthBuckets()

  const listingsByStatus = {
    published: listings.filter((l) => l.status === 'PUBLISHED').length,
    pending: listings.filter((l) => l.status === 'PENDING_APPROVAL').length,
    rejected: listings.filter((l) => l.status === 'REJECTED').length,
  }

  const bookingsByStatus = {
    pending: bookings.filter((b) => b.status === 'PENDING').length,
    confirmed: bookings.filter((b) => b.status === 'CONFIRMED').length,
    cancelled: bookings.filter((b) => b.status === 'CANCELLED').length,
  }

  const ratingCounts = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
  }))

  const totalRevenue = bookings
    .filter((b) => b.status === 'CONFIRMED')
    .reduce((sum, b) => sum + b.totalPrice, 0)

  const averageRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : null

  const revenueEntries = bookings
    .filter((b) => b.status === 'CONFIRMED')
    .map((b) => ({ date: b.createdAt, amount: b.totalPrice }))

  return {
    summary: {
      totalListings: listings.length,
      totalBookings: bookings.length,
      totalReviews: reviews.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageRating,
    },
    listingsByStatus,
    bookingsByStatus,
    reviewsByRating: ratingCounts,
    listingsByMonth: countByMonth(
      listings.map((l) => l.createdAt),
      months,
    ),
    bookingsByMonth: countByMonth(
      bookings.map((b) => b.createdAt),
      months,
    ),
    reviewsByMonth: countByMonth(
      reviews.map((r) => r.createdAt),
      months,
    ),
    revenueByMonth: sumByMonth(revenueEntries, months),
  }
}

export async function getHostAnalytics(req: AuthRequest, res: Response) {
  try {
    if (req.role !== 'HOST' || !req.userId) {
      return res.status(403).json({ error: 'Only hosts can view host analytics' })
    }

    const hostId = req.userId

    const [listings, bookings, reviews] = await Promise.all([
      prisma.listing.findMany({
        where: { hostId },
        select: { status: true, createdAt: true },
      }),
      prisma.booking.findMany({
        where: { listing: { hostId } },
        select: { status: true, totalPrice: true, createdAt: true },
      }),
      prisma.review.findMany({
        where: { listing: { hostId } },
        select: { rating: true, createdAt: true },
      }),
    ])

    return res.json(buildAnalyticsPayload(listings, bookings, reviews))
  } catch {
    return res.status(500).json({ error: 'Something went wrong' })
  }
}

export async function getAdminAnalytics(req: AuthRequest, res: Response) {
  try {
    const [listings, bookings, reviews] = await Promise.all([
      prisma.listing.findMany({
        select: { status: true, createdAt: true },
      }),
      prisma.booking.findMany({
        select: { status: true, totalPrice: true, createdAt: true },
      }),
      prisma.review.findMany({
        select: { rating: true, createdAt: true },
      }),
    ])

    return res.json(buildAnalyticsPayload(listings, bookings, reviews))
  } catch {
    return res.status(500).json({ error: 'Something went wrong' })
  }
}
