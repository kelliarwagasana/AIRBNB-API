import { Router } from 'express'
import { getAdminAnalytics, getHostAnalytics } from '../../controllers/analytics.controller.js'
import { authenticate, requireAdmin, requireHost } from '../../middleware/auth.middleware.js'

const router = Router()

router.get('/host', authenticate, requireHost, getHostAnalytics)
router.get('/admin', authenticate, requireAdmin, getAdminAnalytics)

export default router
