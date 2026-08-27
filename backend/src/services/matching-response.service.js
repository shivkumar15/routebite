export function toCustomerMatchingSummary(matching) {
  if (!matching) return null;

  return {
    id: matching.id,
    attemptNumber: matching.attemptNumber,
    status: matching.status,
    resumeAt: matching.resumeAt ?? null,
    routeSource: matching.routeSource,
    discoveredCandidateCount: matching.discoveredCandidateCount,
    eligibleCandidateCount: matching.eligibleCandidateCount,
    offerReadyCount: matching.offerReadyPartnerIds?.length ?? 0,
    candidateModes: matching.candidates?.map((candidate) => ({
      mode: candidate.mode,
      routeSource: candidate.routeSource,
      predictedPickupAt: candidate.predictedPickupAt,
      predictedDeliveryAt: candidate.predictedDeliveryAt,
      rankPosition: candidate.rankPosition,
    })) ?? [],
    rejectionSummary: matching.rejectionSummary ?? {},
    failureReason: matching.failureReason,
    completedAt: matching.completedAt,
  };
}
