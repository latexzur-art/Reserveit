/**
 * Emergency Reschedule Handler — stable barrel (deferred-splits cleanup).
 * @module backend/booking/emergencyRescheduleHandler
 */

export type {
  EmergencyProposalInput,
  EmergencyRespondInput,
  EmergencyHoldInput,
  EmergencyRefundCancelInput,
  EmergencyResult,
  EmergencySettings,
} from './emergencyReschedule.shared'
export { getEmergencySettings } from './emergencyReschedule.shared'
export { proposeEmergencyReschedule } from './emergencyReschedule.propose'
export { respondToEmergencyReschedule } from './emergencyReschedule.respond'
export { putBookingOnHold, cancelWithRefund } from './emergencyReschedule.holdRefund'
