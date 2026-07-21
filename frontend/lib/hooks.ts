'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  addFavorite,
  addStaffTimeOff,
  approveAdminBusiness,
  assignBusinessBookingStaff,
  createAdminCategory,
  approveAdminCategory,
  fetchAdminCities,
  createAdminCity,
  approveAdminCity,
  deleteAdminCity,
  approveAdminReview,
  blockAdminBusiness,
  blockAdminUser,
  cancelBusinessBooking,
  cancelClientBooking,
  changeClientPassword,
  clearAdminReplyFlag,
  completeBusinessBooking,
  confirmAdminTopPlacement,
  confirmCancellation,
  confirmInvoicePayment,
  confirmTopPlacementPayment,
  createBooking,
  createGroupBooking,
  createBusinessService,
  createBusinessStaff,
  createManualBooking,
  createReview,
  deleteAdminBusiness,
  deleteAdminCategory,
  deleteAdminUser,
  deleteBusinessCoverPhoto,
  deleteBusinessGalleryPhoto,
  deleteBusinessService,
  deleteBusinessStaff,
  deleteClientAvatar,
  deleteStaffPhoto,
  deleteServicePhoto,
  fetchAdminAnalytics,
  fetchAdminAuditLog,
  fetchAdminBusinessDetail,
  fetchAdminBusinesses,
  grantAdminBusinessTop,
  revokeAdminBusinessTop,
  fetchAdminCategories,
  fetchAdminFinanceOverview,
  fetchAdminInvoices,
  fetchAdminOverview,
  fetchAdminPendingCounts,
  fetchAdminRequisites,
  fetchBusinessPaymentRequisites,
  fetchAdminReviews,
  fetchAdminTeam,
  fetchAdminTopPlacements,
  fetchAdminUsers,
  fetchAvailability,
  fetchAvailabilityMulti,
  fetchBusinessAnalytics,
  fetchBusinessBookings,
  fetchBusinessDetail,
  fetchBusinesses,
  fetchBusinessInvoices,
  fetchBusinessMe,
  fetchBusinessNotifications,
  fetchBusinessOwnReviews,
  fetchBusinessReviewsPublic,
  fetchBusinessServices,
  fetchBusinessStaff,
  fetchBusinessStats,
  fetchBusinessTopPlacement,
  fetchCategories,
  fetchCities,
  fetchClientBookings,
  fetchFavorites,
  fetchMe,
  fetchNotifications,
  inviteAdminTeamMember,
  login,
  logout,
  markAdminInvoicePaid,
  markBusinessBookingReady,
  markBusinessNotificationRead,
  markNotificationRead,
  noShowBusinessBooking,
  purchaseTopPlacement,
  registerBusiness,
  registerClient,
  verifyRegistrationCode,
  resendVerificationCode,
  forgotPassword,
  resetPassword,
  rejectAdminBusiness,
  rejectAdminCategory,
  rejectAdminInvoiceReceipt,
  createAdminInvoice,
  rejectAdminReview,
  rejectAdminTopPlacement,
  removeAdminReviewReply,
  removeAdminTeamMember,
  removeFavorite,
  removeStaffTimeOff,
  replyToReview,
  disputeReview,
  respondToReviewDispute,
  resolveAdminReviewDispute,
  rescheduleBusinessBooking,
  rescheduleClientBooking,
  unblockAdminBusiness,
  unblockAdminUser,
  updateAdminRequisites,
  updateAdminOwnCredentials,
  updateAdminTeamMemberCredentials,
  updateBookingDuration,
  updateBusinessMe,
  updateBusinessWorkingHours,
  fetchBackupSheetInfo,
  connectBackupSheet,
  disconnectBackupSheet,
  updateBusinessService,
  updateBusinessStaff,
  fetchClientStats,
  updateClientProfile,
  uploadBusinessCoverPhoto,
  uploadBusinessGalleryPhotos,
  uploadClientAvatar,
  uploadStaffPhoto,
  uploadServicePhoto,
  fetchSupportThread,
  sendSupportMessage,
  markSupportThreadRead,
  fetchAdminSupportThreads,
  fetchAdminSupportThread,
  sendAdminSupportMessage,
  markAdminSupportThreadRead,
  resolveAdminSupportThread,
  reopenAdminSupportThread,
  fetchBusinessClients,
  fetchBusinessClientDetail,
  updateBusinessClient,
  fetchCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  fetchBusinessExpenses,
  createExpense,
  deleteExpense,
  fetchMetricDefinitions,
  createMetricDefinition,
  updateMetricDefinition,
  deleteMetricDefinition,
  fetchMonthLedger,
  updateMonthLedger,
  fetchLedgerReport,
  type ReportPeriod,
  fetchServiceWeekAvailability,
  fetchPlatformMetricDefinitions,
  createPlatformMetricDefinition,
  updatePlatformMetricDefinition,
  deletePlatformMetricDefinition,
  fetchMonthPlatformLedger,
  updateMonthPlatformLedger,
  fetchPlatformLedgerReport,
} from './utils/api';

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });
}

export function useCities() {
  return useQuery({ queryKey: ['cities'], queryFn: fetchCities, staleTime: Infinity });
}

export function useBusinesses(params: {
  city: string;
  category?: string;
  date?: string;
  sort?: string;
  q?: string;
  requireSlot?: boolean;
}) {
  return useQuery({
    queryKey: ['businesses', params],
    queryFn: () => fetchBusinesses(params),
  });
}

export function useBusinessDetail(id: string) {
  return useQuery({ queryKey: ['business', id], queryFn: () => fetchBusinessDetail(id), enabled: !!id });
}

export function useBusinessReviewsPublic(businessId: string) {
  return useQuery({
    queryKey: ['business-reviews-public', businessId],
    queryFn: () => fetchBusinessReviewsPublic(businessId),
    enabled: !!businessId,
  });
}

export function useAvailability(businessId: string, serviceId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['availability', businessId, serviceId, date],
    queryFn: () => fetchAvailability(businessId, serviceId as string, date),
    enabled: !!businessId && !!serviceId && !!date,
  });
}

export function useAvailabilityMulti(businessId: string, serviceIds: string[], date: string) {
  return useQuery({
    queryKey: ['availability-multi', businessId, serviceIds, date],
    queryFn: () => fetchAvailabilityMulti(businessId, serviceIds, date),
    enabled: !!businessId && serviceIds.length > 0 && !!date,
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => login(email, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useRegisterClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: registerClient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useRegisterBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: registerBusiness,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useVerifyRegistrationCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: verifyRegistrationCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useResendVerificationCode() {
  return useMutation({ mutationFn: resendVerificationCode });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: forgotPassword });
}

export function useResetPassword() {
  return useMutation({ mutationFn: resetPassword });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Write the known post-logout state directly instead of invalidating —
      // invalidation triggers a fresh /auth/me fetch that can race with any
      // request already in flight from just before logout (e.g. a component
      // that mounted a moment earlier). If that stale request resolves after
      // this one, it "revives" the authenticated state and the role-gated
      // layouts bounce between the protected page and /login forever.
      qc.setQueryData(['me'], null);
      qc.invalidateQueries({ queryKey: ['me'], refetchType: 'none' });
    },
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBooking,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['availability', variables.businessId] });
    },
  });
}

export function useCreateGroupBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGroupBooking,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['availability-multi', variables.businessId] });
    },
  });
}

export function useClientBookings(tab?: 'upcoming' | 'past' | 'cancelled') {
  return useQuery({ queryKey: ['client-bookings', tab], queryFn: () => fetchClientBookings(tab) });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelClientBooking,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-bookings'] }),
  });
}

export function useRescheduleBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { date: string; startTime: string; staffId: string } }) =>
      rescheduleClientBooking(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-bookings'] }),
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, payload }: { bookingId: string; payload: { rating: number; text: string } }) =>
      createReview(bookingId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-bookings'] }),
  });
}

export function useRespondToReviewDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, response }: { reviewId: string; response: string }) =>
      respondToReviewDispute(reviewId, response),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-bookings'] }),
  });
}

export function useFavorites(enabled = true) {
  return useQuery({ queryKey: ['favorites'], queryFn: fetchFavorites, enabled, retry: false });
}

export function useAddFavorite() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: addFavorite, onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }) });
}

export function useRemoveFavorite() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: removeFavorite, onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }) });
}

export function useNotifications(enabled = true) {
  return useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications, enabled });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useConfirmCancellation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, response }: { bookingId: string; response: 'yes' | 'no' }) =>
      confirmCancellation(bookingId, response),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateClientProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useUploadClientAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadClientAvatar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useDeleteClientAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteClientAvatar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useChangeClientPassword() {
  return useMutation({
    mutationFn: changeClientPassword,
  });
}

export function useClientStats() {
  return useQuery({ queryKey: ['client-stats'], queryFn: fetchClientStats });
}

export function useBusinessMe(options?: { refetchInterval?: number | false | ((query: { state: { data?: { business?: { status?: string } } } }) => number | false) }) {
  return useQuery({ queryKey: ['business-me'], queryFn: fetchBusinessMe, ...options });
}

export function useUpdateBusinessMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateBusinessMe,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-me'] }),
  });
}

export function useUpdateBusinessWorkingHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateBusinessWorkingHours,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-me'] }),
  });
}

export function useBackupSheetInfo() {
  return useQuery({ queryKey: ['backup-sheet-info'], queryFn: fetchBackupSheetInfo });
}

export function useConnectBackupSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: connectBackupSheet,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-me'] }),
  });
}

export function useDisconnectBackupSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: disconnectBackupSheet,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-me'] }),
  });
}

export function useUploadBusinessCoverPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadBusinessCoverPhoto,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-me'] }),
  });
}

export function useUploadBusinessGalleryPhotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadBusinessGalleryPhotos,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-me'] }),
  });
}

export function useDeleteBusinessGalleryPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBusinessGalleryPhoto,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-me'] }),
  });
}

export function useBusinessStats() {
  return useQuery({ queryKey: ['business-stats'], queryFn: fetchBusinessStats });
}

export function useBusinessBookings(date: string) {
  return useQuery({ queryKey: ['business-bookings', date], queryFn: () => fetchBusinessBookings(date) });
}

export function useCreateManualBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createManualBooking,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-bookings'] });
      qc.invalidateQueries({ queryKey: ['business-stats'] });
      qc.invalidateQueries({ queryKey: ['business-analytics'] });
    },
  });
}

function useBusinessBookingMutation(fn: (id: string) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-bookings'] });
      qc.invalidateQueries({ queryKey: ['business-stats'] });
      qc.invalidateQueries({ queryKey: ['business-analytics'] });
      qc.invalidateQueries({ queryKey: ['service-week-availability'] });
    },
  });
}

export function useCancelBusinessBooking() {
  return useBusinessBookingMutation(cancelBusinessBooking);
}

export function useMarkBookingReady() {
  return useBusinessBookingMutation(markBusinessBookingReady);
}

export function useCompleteBusinessBooking() {
  return useBusinessBookingMutation(completeBusinessBooking);
}

export function useUpdateBookingDuration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, durationMinutes }: { id: string; durationMinutes: number }) =>
      updateBookingDuration(id, durationMinutes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-bookings'] });
      qc.invalidateQueries({ queryKey: ['business-stats'] });
      qc.invalidateQueries({ queryKey: ['business-analytics'] });
      qc.invalidateQueries({ queryKey: ['service-week-availability'] });
    },
  });
}

export function useAssignBookingStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) => assignBusinessBookingStaff(id, staffId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-bookings'] });
      qc.invalidateQueries({ queryKey: ['service-week-availability'] });
    },
  });
}

export function useRescheduleBusinessBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { date: string; startTime: string; staffId?: string };
    }) => rescheduleBusinessBooking(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-bookings'] });
      qc.invalidateQueries({ queryKey: ['business-stats'] });
      qc.invalidateQueries({ queryKey: ['business-analytics'] });
      qc.invalidateQueries({ queryKey: ['service-week-availability'] });
    },
  });
}

export function useNoShowBusinessBooking() {
  return useBusinessBookingMutation(noShowBusinessBooking);
}

export function useBusinessOwnReviews() {
  return useQuery({ queryKey: ['business-reviews'], queryFn: fetchBusinessOwnReviews });
}

export function useReplyToReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => replyToReview(id, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-reviews'] }),
  });
}

export function useDisputeReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => disputeReview(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-reviews'] }),
  });
}

export function useBusinessTopPlacement() {
  return useQuery({ queryKey: ['business-top-placement'], queryFn: fetchBusinessTopPlacement });
}

export function usePurchaseTopPlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: purchaseTopPlacement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-top-placement'] }),
  });
}

export function useBusinessInvoices() {
  return useQuery({ queryKey: ['business-invoices'], queryFn: fetchBusinessInvoices });
}

export function useConfirmInvoicePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, receipt }: { id: string; receipt: File }) => confirmInvoicePayment(id, receipt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-invoices'] }),
  });
}

export function useConfirmTopPlacementPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, receipt }: { id: string; receipt: File }) => confirmTopPlacementPayment(id, receipt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-top-placement'] }),
  });
}

export function useBusinessAnalytics(days: 7 | 30 | 90 = 30, staffId?: string) {
  return useQuery({
    queryKey: ['business-analytics', days, staffId],
    queryFn: () => fetchBusinessAnalytics(days, staffId),
  });
}

export function useBusinessServices() {
  return useQuery({ queryKey: ['business-services'], queryFn: fetchBusinessServices });
}

export function useCreateBusinessService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBusinessService,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-services'] }),
  });
}

export function useUpdateBusinessService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateBusinessService>[1] }) =>
      updateBusinessService(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-services'] }),
  });
}

export function useDeleteBusinessService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBusinessService,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-services'] }),
  });
}

export function useUploadServicePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadServicePhoto(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-services'] }),
  });
}

export function useDeleteServicePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteServicePhoto,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-services'] }),
  });
}

export function useBusinessStaff() {
  return useQuery({ queryKey: ['business-staff'], queryFn: fetchBusinessStaff });
}

export function useCreateBusinessStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBusinessStaff,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-staff'] }),
  });
}

export function useUpdateBusinessStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateBusinessStaff>[1] }) =>
      updateBusinessStaff(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-staff'] }),
  });
}

export function useDeleteBusinessStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBusinessStaff,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-staff'] }),
  });
}

export function useUploadStaffPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadStaffPhoto(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-staff'] }),
  });
}

export function useDeleteStaffPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteStaffPhoto,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-staff'] }),
  });
}

export function useDeleteBusinessCoverPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBusinessCoverPhoto,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-me'] }),
  });
}

export function useAddStaffTimeOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { from: string; to: string; note?: string } }) =>
      addStaffTimeOff(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-staff'] }),
  });
}

export function useRemoveStaffTimeOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, timeOffId }: { id: string; timeOffId: string }) => removeStaffTimeOff(id, timeOffId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-staff'] }),
  });
}

export function useBusinessNotifications() {
  return useQuery({ queryKey: ['business-notifications'], queryFn: fetchBusinessNotifications });
}

export function useMarkBusinessNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markBusinessNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-notifications'] }),
  });
}

export function useAdminPendingCounts(enabled = true) {
  return useQuery({
    queryKey: ['admin-pending-counts'],
    queryFn: fetchAdminPendingCounts,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useAdminOverview() {
  return useQuery({ queryKey: ['admin-overview'], queryFn: fetchAdminOverview });
}

export function useAdminAnalytics(days: 7 | 30 | 90 = 30) {
  return useQuery({ queryKey: ['admin-analytics', days], queryFn: () => fetchAdminAnalytics(days) });
}

export function useAdminTeam() {
  return useQuery({ queryKey: ['admin-team'], queryFn: fetchAdminTeam });
}

export function useInviteTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inviteAdminTeamMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-team'] }),
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeAdminTeamMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-team'] }),
  });
}

export function useUpdateAdminOwnCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateAdminOwnCredentials,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useUpdateAdminTeamMemberCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { newEmail?: string; newPassword?: string } }) =>
      updateAdminTeamMemberCredentials(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-team'] }),
  });
}

export function useAdminAuditLog() {
  return useQuery({ queryKey: ['admin-audit-log'], queryFn: fetchAdminAuditLog });
}

export function useAdminBusinesses(status?: string) {
  return useQuery({ queryKey: ['admin-businesses', status], queryFn: () => fetchAdminBusinesses(status) });
}

export function useAdminCategories(status?: string) {
  return useQuery({ queryKey: ['admin-categories', status], queryFn: () => fetchAdminCategories(status) });
}

function useAdminCategoryMutation(fn: (id: string) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAdminCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useApproveCategory() {
  return useAdminCategoryMutation(approveAdminCategory);
}

export function useRejectCategory() {
  return useAdminCategoryMutation(rejectAdminCategory);
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string }) => deleteAdminCategory(id, reassignTo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useAdminCities(status?: 'active' | 'pending' | 'all') {
  return useQuery({ queryKey: ['admin-cities', status], queryFn: () => fetchAdminCities(status) });
}

export function useCreateAdminCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAdminCity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cities'] });
      qc.invalidateQueries({ queryKey: ['cities'] });
    },
  });
}

export function useApproveAdminCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveAdminCity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cities'] });
      qc.invalidateQueries({ queryKey: ['cities'] });
    },
  });
}

export function useDeleteAdminCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminCity,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-cities'] }),
  });
}

function useAdminBusinessMutation(fn: (id: string) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-businesses'] });
      qc.invalidateQueries({ queryKey: ['admin-business-detail'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
}

export function useApproveBusiness() {
  return useAdminBusinessMutation(approveAdminBusiness);
}

export function useRejectBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => rejectAdminBusiness(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-businesses'] });
      qc.invalidateQueries({ queryKey: ['admin-business-detail'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
}

export function useBlockBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, durationDays }: { id: string; reason?: string; durationDays?: number }) =>
      blockAdminBusiness(id, { reason, durationDays }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-businesses'] });
      qc.invalidateQueries({ queryKey: ['admin-business-detail'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
}

export function useUnblockBusiness() {
  return useAdminBusinessMutation(unblockAdminBusiness);
}

export function useGrantBusinessTop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, durationDays }: { id: string; durationDays: number }) => grantAdminBusinessTop(id, durationDays),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-businesses'] });
      qc.invalidateQueries({ queryKey: ['admin-business-detail'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
}

export function useRevokeBusinessTop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeAdminBusinessTop,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-businesses'] });
      qc.invalidateQueries({ queryKey: ['admin-business-detail'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
}

export function useAdminBusinessDetail(id: string) {
  return useQuery({
    queryKey: ['admin-business-detail', id],
    queryFn: () => fetchAdminBusinessDetail(id),
    enabled: !!id,
  });
}

export function useDeleteAdminBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminBusiness,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-businesses'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
}

export function useAdminUsers(params: { role?: 'CLIENT' | 'BUSINESS_OWNER'; q?: string } = {}) {
  return useQuery({ queryKey: ['admin-users', params], queryFn: () => fetchAdminUsers(params) });
}

function useAdminUserMutation(fn: (id: string) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useBlockAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, durationDays }: { id: string; reason?: string; durationDays?: number }) =>
      blockAdminUser(id, { reason, durationDays }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useUnblockAdminUser() {
  return useAdminUserMutation(unblockAdminUser);
}

export function useDeleteAdminUser() {
  return useAdminUserMutation(deleteAdminUser);
}

export function useAdminReviews(params: { status?: string; flaggedReplies?: boolean } = {}) {
  return useQuery({ queryKey: ['admin-reviews', params], queryFn: () => fetchAdminReviews(params) });
}

function useAdminReviewMutation(fn: (id: string) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reviews'] }),
  });
}

export function useApproveReview() {
  return useAdminReviewMutation(approveAdminReview);
}

export function useRejectReview() {
  return useAdminReviewMutation(rejectAdminReview);
}

export function useResolveReviewDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'UPHELD' | 'DISMISSED'; note?: string }) =>
      resolveAdminReviewDispute(id, decision, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reviews'] }),
  });
}

export function useRemoveReviewReply() {
  return useAdminReviewMutation(removeAdminReviewReply);
}

export function useClearReplyFlag() {
  return useAdminReviewMutation(clearAdminReplyFlag);
}

export function useAdminTopPlacements(params: { status?: string; business?: string } = {}) {
  return useQuery({
    queryKey: ['admin-top-placements', params],
    queryFn: () => fetchAdminTopPlacements(params),
  });
}

function useAdminTopPlacementMutation(fn: (id: string) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-top-placements'] }),
  });
}

export function useConfirmTopPlacement() {
  return useAdminTopPlacementMutation(confirmAdminTopPlacement);
}

export function useRejectTopPlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => rejectAdminTopPlacement(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-top-placements'] }),
  });
}

export function useAdminInvoices(params: { status?: string; business?: string } = {}) {
  return useQuery({ queryKey: ['admin-invoices', params], queryFn: () => fetchAdminInvoices(params) });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAdminInvoicePaid,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invoices'] }),
  });
}

export function useRejectInvoiceReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => rejectAdminInvoiceReceipt(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invoices'] }),
  });
}

export function useCreateAdminInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAdminInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invoices'] }),
  });
}

export function useAdminFinanceOverview() {
  return useQuery({ queryKey: ['admin-finance-overview'], queryFn: fetchAdminFinanceOverview });
}

export function useAdminRequisites() {
  return useQuery({ queryKey: ['admin-requisites'], queryFn: fetchAdminRequisites });
}

export function useUpdateAdminRequisites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateAdminRequisites,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-requisites'] }),
  });
}

export function useBusinessPaymentRequisites() {
  return useQuery({ queryKey: ['business-payment-requisites'], queryFn: fetchBusinessPaymentRequisites });
}

// Support chat — polled rather than pushed, matching the rest of this app
// (no websocket infra exists anywhere else in the codebase).
export function useSupportThread() {
  return useQuery({ queryKey: ['support-thread'], queryFn: fetchSupportThread, refetchInterval: 8000 });
}

export function useSendSupportMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendSupportMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-thread'] }),
  });
}

export function useMarkSupportThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markSupportThreadRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-thread'] }),
  });
}

export function useAdminSupportThreads(enabled = true) {
  return useQuery({
    queryKey: ['admin-support-threads'],
    queryFn: fetchAdminSupportThreads,
    refetchInterval: 8000,
    enabled,
  });
}

export function useAdminSupportThread(id: string | null) {
  return useQuery({
    queryKey: ['admin-support-thread', id],
    queryFn: () => fetchAdminSupportThread(id as string),
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export function useSendAdminSupportMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text, image }: { id: string; text?: string; image?: File }) =>
      sendAdminSupportMessage(id, { text, image }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-support-thread', vars.id] });
      qc.invalidateQueries({ queryKey: ['admin-support-threads'] });
    },
  });
}

export function useMarkAdminSupportThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAdminSupportThreadRead,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['admin-support-thread', id] });
      qc.invalidateQueries({ queryKey: ['admin-support-threads'] });
    },
  });
}

export function useResolveAdminSupportThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resolveAdminSupportThread,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['admin-support-thread', id] });
      qc.invalidateQueries({ queryKey: ['admin-support-threads'] });
    },
  });
}

export function useReopenAdminSupportThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reopenAdminSupportThread,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['admin-support-thread', id] });
      qc.invalidateQueries({ queryKey: ['admin-support-threads'] });
    },
  });
}

// Business client CRM — the client roster is derived live from bookings on the
// server, so this list should stay reasonably fresh without being annoying;
// notes/custom fields are the only real mutable state here.
export function useBusinessClients(q?: string) {
  return useQuery({ queryKey: ['business-clients', q ?? ''], queryFn: () => fetchBusinessClients(q) });
}

export function useBusinessClientDetail(phone: string | null) {
  return useQuery({
    queryKey: ['business-client', phone],
    queryFn: () => fetchBusinessClientDetail(phone as string),
    enabled: !!phone,
  });
}

export function useUpdateBusinessClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phone, ...payload }: { phone: string; notes?: string; customFieldValues?: Record<string, unknown> }) =>
      updateBusinessClient(phone, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['business-client', vars.phone] });
      qc.invalidateQueries({ queryKey: ['business-clients'] });
    },
  });
}

export function useCustomFields() {
  return useQuery({ queryKey: ['custom-fields'], queryFn: fetchCustomFields });
}

export function useCreateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCustomField,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
      qc.invalidateQueries({ queryKey: ['business-client'] });
    },
  });
}

export function useUpdateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; label?: string; options?: string[]; order?: number }) =>
      updateCustomField(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
      qc.invalidateQueries({ queryKey: ['business-client'] });
    },
  });
}

export function useDeleteCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
      qc.invalidateQueries({ queryKey: ['business-client'] });
    },
  });
}

export function useMetricDefinitions() {
  return useQuery({ queryKey: ['metric-definitions'], queryFn: fetchMetricDefinitions });
}

export function useCreateMetricDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMetricDefinition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metric-definitions'] });
      qc.invalidateQueries({ queryKey: ['month-ledger'] });
    },
  });
}

export function useUpdateMetricDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; label?: string; group?: string; unit?: string; persistence?: string }) =>
      updateMetricDefinition(id, payload as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metric-definitions'] });
      qc.invalidateQueries({ queryKey: ['month-ledger'] });
    },
  });
}

export function useDeleteMetricDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMetricDefinition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metric-definitions'] });
      qc.invalidateQueries({ queryKey: ['month-ledger'] });
    },
  });
}

export function useMonthLedger(month: string) {
  return useQuery({ queryKey: ['month-ledger', month], queryFn: () => fetchMonthLedger(month) });
}

export function useUpdateMonthLedger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ month, values }: { month: string; values: Record<string, string | number> }) => updateMonthLedger(month, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['month-ledger'] }),
  });
}

export function useLedgerReport(period: ReportPeriod, endMonth?: string) {
  return useQuery({ queryKey: ['ledger-report', period, endMonth ?? ''], queryFn: () => fetchLedgerReport(period, endMonth) });
}

// ---- Platform ledger (super-admin) ----

export function usePlatformMetricDefinitions() {
  return useQuery({ queryKey: ['platform-metric-definitions'], queryFn: fetchPlatformMetricDefinitions });
}

export function useCreatePlatformMetricDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPlatformMetricDefinition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-metric-definitions'] });
      qc.invalidateQueries({ queryKey: ['month-platform-ledger'] });
    },
  });
}

export function useUpdatePlatformMetricDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; label?: string; group?: string; unit?: string; persistence?: string }) =>
      updatePlatformMetricDefinition(id, payload as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-metric-definitions'] });
      qc.invalidateQueries({ queryKey: ['month-platform-ledger'] });
    },
  });
}

export function useDeletePlatformMetricDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePlatformMetricDefinition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-metric-definitions'] });
      qc.invalidateQueries({ queryKey: ['month-platform-ledger'] });
    },
  });
}

export function useMonthPlatformLedger(month: string) {
  return useQuery({ queryKey: ['month-platform-ledger', month], queryFn: () => fetchMonthPlatformLedger(month) });
}

export function useUpdateMonthPlatformLedger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ month, values }: { month: string; values: Record<string, string | number> }) => updateMonthPlatformLedger(month, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['month-platform-ledger'] }),
  });
}

export function usePlatformLedgerReport(period: ReportPeriod, endMonth?: string) {
  return useQuery({
    queryKey: ['platform-ledger-report', period, endMonth ?? ''],
    queryFn: () => fetchPlatformLedgerReport(period, endMonth),
  });
}

export function useServiceWeekAvailability(serviceId: string | null, weekStart: string) {
  return useQuery({
    queryKey: ['service-week-availability', serviceId, weekStart],
    queryFn: () => fetchServiceWeekAvailability(serviceId as string, weekStart),
    enabled: !!serviceId,
  });
}

export function useBusinessExpenses(days: 7 | 30 | 90 = 30) {
  return useQuery({ queryKey: ['business-expenses', days], queryFn: () => fetchBusinessExpenses(days) });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createExpense,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-expenses'] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-expenses'] }),
  });
}

export { ApiError };
