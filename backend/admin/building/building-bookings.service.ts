/**
 * Building Bookings Service — stable barrel.
 * Implementation split into queries (getAll/getById) and mutations
 * (approve/reject/cancel/createManual) in the per-role refactor (Phase 5).
 */

import { BuildingBookingsQueries } from './building-bookings.queries'
import { BuildingBookingsMutations } from './building-bookings.mutations'

export const BuildingBookingsService = {
  ...BuildingBookingsQueries,
  ...BuildingBookingsMutations,
}
