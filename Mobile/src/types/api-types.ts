/**
 * WorldWeCare API types for the React Native app.
 * Generated from the backend source (src/app/api/**, src/lib/**, prisma/schema.prisma).
 * Dates are ISO-8601 strings in JSON. Money amounts are integer cents.
 * Shared enums/entities are top-level; each module is a namespace (e.g. Feed.FeedPost, AdminCore.AdminUserRow).
 */

/** Standard error body returned by most endpoints. */
export interface ApiError { error: string; needsVerification?: boolean; [k: string]: unknown }

// ════════════════════════════════════════════════════════════
// Enums & shared entities (prisma/schema.prisma)
// ════════════════════════════════════════════════════════════

// Platform types — generated from prisma/schema.prisma (all 39 enums) plus API entity shapes.
// Source: prisma/schema.prisma, src/lib/notifications.ts, src/lib/admin-notifications.ts, src/lib/upload.ts, src/lib/video-status.ts

export type AdminRole = "OWNER" | "ADMIN" | "MODERATOR";
export type VerificationPurpose = "EMAIL_CHANGE" | "EMAIL_CONFIRM" | "PASSWORD_RESET";
export type UserActivityType = "SIGNED_UP" | "SIGNED_IN" | "SIGN_IN_FAILED" | "EMAIL_VERIFIED" | "PASSWORD_CHANGED" | "PROFILE_UPDATED" | "ADMIN_ACTION";
export type AdminAction = "USER_UPDATED" | "USER_ACTIVATED" | "USER_DEACTIVATED" | "USER_BANNED" | "USER_UNBANNED" | "USER_DELETED" | "USER_PASSWORD_RESET_SENT" | "USER_EMAIL_SENT" | "USER_CREATED" | "POST_REMOVED" | "POST_RESTORED" | "POST_FEATURED" | "POST_UNFEATURED" | "COMMENT_REMOVED" | "COMMENT_RESTORED" | "REPORT_RESOLVED" | "REPORT_DISMISSED" | "PAYOUT_APPROVED" | "PAYOUT_PAID" | "PAYOUT_REJECTED" | "PAYOUT_REVERSED" | "PAYOUT_DETAILS_VIEWED" | "PAYMENT_SETTINGS_UPDATED";
export type AdminNotifType = "USER_SIGNED_UP" | "USER_EMAIL_VERIFIED" | "USER_BANNED" | "USER_DELETED" | "POST_REPORTED" | "POST_REMOVED" | "CONFESSION_PENDING" | "EVENT_PENDING" | "PLACE_PENDING" | "PLACE_REPORTED" | "PETITION_PENDING" | "CAMPAIGN_PENDING";
export type PostStatus = "PUBLISHED" | "PENDING" | "REMOVED" | "DRAFT";
export type Reaction = "LIKE" | "HEART" | "CARE" | "STRENGTH" | "PROUD" | "SAME";
export type ReportTargetType = "POST" | "COMMENT";
export type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";
export type ReportReason = "SPAM" | "HARASSMENT" | "HATE_SPEECH" | "SELF_HARM" | "ADULT_CONTENT" | "MISINFORMATION" | "OFF_TOPIC" | "OTHER";
export type TextDirection = "LTR" | "RTL";
export type TranslationSource = "GOOGLE" | "HUMAN";
export type StreakKind = "SOBER" | "MEDITATION" | "VOLUNTEERING" | "JOURNALING" | "CUSTOM";
export type EmailStatus = "QUEUED" | "SENT" | "FAILED";
export type PetitionStatus = "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";
export type ChatTier = "PUBLIC" | "SUPPORT" | "CRISIS" | "CAVALRY";
export type ChatRoomStatus = "ACTIVE" | "ARCHIVED";
export type ChatMemberRole = "MEMBER" | "MODERATOR";
export type ChatMemberStatus = "PENDING" | "ACTIVE" | "BANNED";
export type ChatMessageStatus = "PUBLISHED" | "PENDING" | "REMOVED";
export type UserNotifType = "CHAT_REPLY" | "CHAT_MENTION" | "CHAT_REACTION" | "CRISIS_ALERT" | "POST_LIKE" | "POST_COMMENT" | "FOLLOW" | "DIRECT_MESSAGE" | "EVENT_APPROVED" | "EVENT_REJECTED" | "EVENT_CANCELLED" | "PLACE_APPROVED" | "PLACE_REJECTED" | "PETITION_APPROVED" | "PETITION_REJECTED" | "CAMPAIGN_APPROVED" | "CAMPAIGN_REJECTED" | "DONATION_RECEIVED" | "PAYOUT_APPROVED" | "PAYOUT_PAID" | "PAYOUT_REJECTED" | "TOWN_HERO_APPROVED" | "TOWN_HERO_REJECTED" | "SYSTEM";
export type ConfessionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type GratitudeStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ArticleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ArticleCommentStatus = "PUBLISHED" | "REMOVED";
export type EventStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type VideoStatus = "UPLOADING" | "QUEUED" | "PROCESSING" | "READY" | "FAILED";
export type ClipCommentStatus = "PUBLISHED" | "REMOVED";
export type ClipKind = "EMBED" | "UPLOAD";
export type CampaignStatus = "PENDING" | "DRAFT" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
export type PlaceType = "RECOVERY_PROGRAM" | "CLINIC" | "COUNSELLING" | "CHURCH" | "FOOD_BANK" | "ANIMAL_SHELTER" | "SHELTER" | "COMMUNITY_CENTRE" | "DONATING_BUSINESS" | "OTHER";
export type PlaceStatus = "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";
export type PlaceReportKind = "CLOSED_DOWN" | "MOVED" | "WRONG_DETAILS" | "DUPLICATE" | "NOT_APPROPRIATE" | "OTHER";
export type LiveStreamStatus = "IDLE" | "LIVE" | "ENDED";
export type LiveStreamVisibility = "PUBLIC" | "UNLISTED";
export type DonationStatus = "PENDING" | "SUCCEEDED" | "REFUNDED" | "FAILED" | "DISPUTED";
export type PayoutMethodType = "PAYPAL" | "BANK" | "WISE" | "CHECK";
export type PayoutStatus = "REQUESTED" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";
export type TownHeroStatus = "PENDING" | "APPROVED" | "REJECTED";

// ── Common JSON shapes ─────────────────────────────────────────────
/** All DateTime columns are serialised as ISO-8601 strings. Money is integer cents. */
export type ISODateString = string;

/** Standard error body: { error } with 400/401/403/404/409/413/415/429/500. */
export interface PlatformApiError {
  error: string;
  /** Set by middleware for signed-in but unverified members (403). */
  needsVerification?: true;
}

// ── In-app notifications (src/lib/notifications.ts) ────────────────
export interface PlatformUserNotification {
  id: string;
  type: UserNotifType;
  title: string;
  body: string | null;
  /** Web route, e.g. "/post/<id>", "/chatrooms/<slug>", "/settings/payouts". */
  actionUrl: string | null;
  isRead: boolean;
  createdAt: ISODateString;
}

/** GET /api/user/notifications?cursor=&limit= (limit clamped 10..50, default 25). */
export interface PlatformUserNotificationPage {
  items: PlatformUserNotification[];
  /** "<ISO createdAt>_<id>" or null. */
  nextCursor: string | null;
  unread: number;
}

// ── Admin notifications (src/lib/admin-notifications.ts) ───────────
export interface PlatformAdminNotification {
  id: string;
  type: AdminNotifType;
  title: string;
  message: string | null;
  actionUrl: string | null;
  readAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface PlatformAdminBellPayload {
  unread: number;
  items: PlatformAdminNotification[];
}

// ── Uploads (src/lib/upload.ts, src/lib/video-status.ts) ───────────
export type PlatformImageMime =
  | "image/png" | "image/jpeg" | "image/webp" | "image/gif"
  | "image/svg+xml" | "image/x-icon" | "image/vnd.microsoft.icon";

/** POST /api/user/upload (multipart: file). Category is always "posts". */
export type PlatformUserUploadResponse =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** POST /api/admin/upload (multipart: file, category). */
export interface PlatformAdminUploadResponse {
  ok: boolean;
  url?: string;
  thumbUrl?: string;
  width?: number | null;
  height?: number | null;
  error?: string;
}

/** POST /api/user/upload/video → 201. */
export interface PlatformVideoUploadCreated { ok: true; id: string }

/** GET /api/user/upload/video → current limits. */
export interface PlatformVideoLimits { maxMB: number; maxSeconds: number; [k: string]: unknown }

/** GET /api/user/upload/video/[id] — poll until READY or FAILED. */
export interface PlatformVideoStatus {
  id: string;
  status: VideoStatus;
  percent: number;
  etaSeconds: number | null;
  stage: string;
  message: string;
  url: string | null;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  error: string | null;
}

/** JSON stored in Post.video / Petition.video / Confession.video / GratitudeEntry.video. */
export interface PlatformAttachedVideo {
  assetId: string;
  url: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

/** JSON stored in *.photos columns. */
export interface PlatformPhoto { url: string; alt?: string }

/** JSON stored in Post.images. */
export interface PlatformPostImage { url: string; alt?: string; width?: number; height?: number }

/** JSON stored in Place.hours. day 0-6. */
export interface PlatformPlaceHours { day: number; opens: string; closes: string; closed?: true }

// ── Settings (PlatformSetting key/value rows) ──────────────────────
export type PlatformSettingKey =
  | "general.siteName" | "general.tagline" | "general.description" | "general.textLogo"
  | "general.svgLogo" | "general.logoUrl" | "general.faviconUrl" | "general.supportEmail"
  | "general.appUrl"
  | "email.provider" | "email.resendApiKey" | "email.fromEmail" | "email.fromName"
  | "email.replyToEmail" | "email.enabled"
  | "storage.provider" | "storage.localPath" | "storage.maxFileMB" | "storage.publicBaseUrl"
  | "storage.maxVideoMB" | "storage.maxVideoSeconds"
  | "cache.enabled" | "cache.defaultTtlSeconds"
  | "stream.enabled" | "stream.publicUrl" | "stream.pathPrefix" | "stream.apiUrl" | "stream.apiUser"
  | "stream.apiPass" | "stream.playbackUrl" | "stream.allowedIps" | "stream.defaultVisibility"
  | "stream.requireEmailVerified" | "stream.autoRecord" | "stream.maxDurationMin"
  | "stream.maxConcurrentPerUser" | "stream.maxHeight" | "stream.recordingRetentionDays"
  | "payments.enabled" | "payments.mode" | "payments.publishableKey" | "payments.secretKey"
  | "payments.webhookSecret" | "payments.currency" | "payments.creditRecipient"
  | "payments.payoutFeeBasisPoints" | "payments.payoutMinCents" | "payments.payoutHoldDays"
  | "payments.payoutMethods" | "payments.minDonationCents" | "payments.maxDonationCents"
  | "translation.googleApiKey" | "translation.showPicker"
  | "media.ffmpegPath" | "media.ffprobePath" | "media.ffmpegInstalledAt"
  | "media.ffmpegArchiveSha256" | "media.ffmpegSource";

// ── Stripe events handled by POST /api/webhooks/stripe ─────────────
export type PlatformStripeEvent =
  | "checkout.session.completed" | "checkout.session.async_payment_succeeded"
  | "checkout.session.async_payment_failed" | "checkout.session.expired"
  | "charge.refunded" | "charge.refund.updated"
  | "charge.dispute.created" | "charge.dispute.closed";

// ── Email templates ────────────────────────────────────────────────
export type PlatformEmailTemplateSlug =
  | "welcome" | "email_confirm" | "password_reset" | "password_reset_confirmed"
  | "donation_receipt" | "daily_digest";

// ── i18n ───────────────────────────────────────────────────────────
export interface PlatformLocale {
  code: string;
  name: string;
  nativeName: string;
  direction: TextDirection;
}
/** Locale cookie set by the web picker: "wwc-locale" (default "en"). */
export type PlatformLocaleCookie = "wwc-locale";


// ════════════════════════════════════════════════════════════
// Auth, Account, Profile & Social
// ════════════════════════════════════════════════════════════

/** Auth, Account, Profile & Social. Use as Account.TypeName — shared enums above are visible inside. */
export namespace Account {
  // Auth, Account, Profile & Social — request/response types.
  // Generated from src/app/api/user/{auth,settings,profile,u,members,follow,block,blocks,
  // notifications,sidebar,search,saved,progress,streaks,journal,daily-reflection} and src/lib/*.
  // All dates are ISO-8601 strings unless noted (streak startedOn = "YYYY-MM-DD").

  /* ── common ─────────────────────────────────────────── */
  export interface AccountErrorResponse { error: string }
  export interface AccountNeedsVerificationError { error: "Confirm your email address first."; needsVerification: true }
  export interface AccountOkResponse { ok: true }

  /* ── auth ───────────────────────────────────────────── */
  export interface AccountCaptchaChallenge { question: string; token: string }

  export interface AccountSignupRequest {
    email: string;
    password: string;
    displayName: string;
    countryId: string;
    acceptedTerms: true;
    captchaToken: string;
    captchaAnswer: string | number;
    /** Honeypot — must be empty or omitted. */
    website?: string;
  }
  export interface AccountSignupResponse { ok: true; emailSent: boolean; emailError?: string }
  export interface AccountSignupCaptchaError { error: string; newChallenge: boolean }

  export interface AccountLoginRequest { email: string; password: string }
  export type AccountLoginResponse = AccountOkResponse;

  export type AccountResendVerificationResponse = { ok: true } | { ok: true; alreadyVerified: true };
  export interface AccountRefreshVerifiedResponse { verified: boolean }
  export interface AccountRefreshVerifiedQuery { next?: string }

  export interface AccountPendingEmailRequest { email: string; currentPassword: string }
  export interface AccountEmailChangeResponse { ok: true; pendingEmail: string }

  export interface AccountForgotPasswordRequest { email: string }
  export interface AccountForgotPasswordResponse { ok: true; message: string }

  export interface AccountResetPasswordRequest { token: string; password: string; confirm: string }
  export type AccountResetPasswordResponse = AccountOkResponse;

  /* ── settings ───────────────────────────────────────── */
  export interface AccountBlockedUser { userId: string; displayName: string; avatarUrl: string | null; createdAt: string }

  export interface AccountSettings {
    email: string;
    pendingEmail: string | null;
    displayName: string;
    countryId: string | null;
    anonymousByDefault: boolean;
    emailVerifiedAt: string | null;
    createdAt: string;
  }
  export interface AccountSettingsResponse { settings: AccountSettings; blocked: AccountBlockedUser[] }

  export interface AccountChangeEmailRequest { email: string; currentPassword: string }

  export interface AccountChangePasswordRequest { currentPassword: string; password: string; confirm: string }
  export interface AccountChangePasswordResponse { ok: true; otherDevicesSignedOut: true }

  export interface AccountPreferencesRequest { countryId?: string | null; anonymousByDefault?: boolean }

  export type AccountThemeId =
    | "sky" | "grounded" | "dusk" | "meadow" | "ember" | "plum"
    | "rose" | "slate" | "apricot" | "citron" | "lagoon" | "mulberry";
  export type AccountAppearanceMode = "light" | "dark" | "system";
  /** 0 Lightest, 1 Light, 2 Default, 3 Deep, 4 Deepest */
  export type AccountBrandTone = 0 | 1 | 2 | 3 | 4;
  export interface AccountAppearanceRequest {
    colorThemeId?: AccountThemeId | null;
    appearanceMode?: AccountAppearanceMode;
    brandTone?: AccountBrandTone;
  }

  export interface AccountDigestRequest { digestEnabled?: boolean; digestHour?: number; timezone?: string }
  export interface AccountDigestResponse { settings: { digestEnabled: boolean; digestHour: number; timezone: string | null } }

  export interface AccountDeactivateRequest { currentPassword: string }
  export interface AccountDeleteRequest { currentPassword: string; confirm: "DELETE" }
  export interface AccountDeleteResponse {
    ok: true;
    removed: { posts: number; comments: number; gratitude: number; messages: number; chatMessages: number };
  }

  /* ── profile ────────────────────────────────────────── */
  export interface AccountMyProfile {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    bio: string | null;
    location: string | null;
    emailVerifiedAt: string | null;
    createdAt: string;
  }
  export interface AccountMyProfileResponse { profile: AccountMyProfile | null }
  export interface AccountUpdateProfileRequest {
    displayName?: string;
    bio?: string | null;
    location?: string | null;
    avatarUrl?: string | null;
    coverUrl?: string | null;
  }

  export interface AccountJourneyStats {
    posts: number; replies: number; rooms: number; saved: number;
    followers: number; following: number; memberSince: string;
  }
  export interface AccountJourneyStatsResponse { stats: AccountJourneyStats | null }

  export interface AccountPublicProfile {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    bio: string | null;
    location: string | null;
    createdAt: string;
    postCount: number;
    roomCount: number;
    followerCount: number;
    followingCount: number;
  }
  export interface AccountPublicProfileResponse { profile: AccountPublicProfile; isSelf: boolean }

  /** Shared feed shape (src/lib/posts-feed.ts) */
  export type AccountReactionType = string;
  export interface AccountPostVideo {
    assetId: string; url: string; posterUrl: string | null;
    width: number | null; height: number | null; durationSec: number | null;
  }
  export interface AccountFeedPost {
    id: string;
    authorId: string | null;
    authorName: string;
    authorAvatar: string | null;
    body: string;
    images: Array<{ url: string; alt?: string | null }>;
    video: AccountPostVideo | null;
    isAnonymous: boolean;
    isFeatured: boolean;
    likeCount: number;
    commentCount: number;
    saveCount: number;
    liked: boolean;
    myReaction: AccountReactionType | null;
    saved: boolean;
    isOwn: boolean;
    countryName: string | null;
    countryCode: string | null;
    createdAt: string;
  }
  export interface AccountFeedPage { items: AccountFeedPost[]; nextCursor: string | null }
  export interface AccountCursorQuery { cursor?: string; limit?: number }

  /* ── social ─────────────────────────────────────────── */
  export interface AccountFollowListUser {
    id: string; displayName: string; avatarUrl: string | null; bio: string | null;
    isFollowing: boolean; isSelf: boolean;
  }
  export interface AccountFollowListResponse { users: AccountFollowListUser[] }

  export interface AccountFollowRequest { userId: string; follow?: boolean }
  export interface AccountFollowResponse { ok: true; following: boolean }

  export type AccountFollowReason =
    | { kind: "sharedRoom"; room: string; roomId: string }
    | { kind: "sharedRooms"; n: number }
    | { kind: "followedByOne" }
    | { kind: "followedByMany"; n: number }
    | { kind: "postingThisWeek" }
    | { kind: "newHere" };
  export interface AccountFollowSuggestion { id: string; displayName: string; avatarUrl: string | null; reason: AccountFollowReason }
  export interface AccountFollowSuggestionsResponse { people: AccountFollowSuggestion[] }

  export interface AccountMembersQuery { q?: string; country?: string; cursor?: string; limit?: number }
  export interface AccountMemberRow {
    id: string; displayName: string; avatarUrl: string | null; bio: string | null;
    location: string | null; followerCount: number; isFollowing: boolean;
  }
  export interface AccountMembersResponse { items: AccountMemberRow[]; nextCursor: string | null }

  export interface AccountBlockRequest { userId: string; block?: boolean }
  export interface AccountBlockResponse { ok: true; blocked: boolean }
  export interface AccountBlocksResponse { blocked: AccountBlockedUser[] }

  /* ── notifications ──────────────────────────────────── */
  export type AccountNotificationType =
    | "CHAT_REPLY" | "CHAT_MENTION" | "CHAT_REACTION" | "CRISIS_ALERT"
    | "POST_LIKE" | "POST_COMMENT" | "FOLLOW" | "DIRECT_MESSAGE"
    | "EVENT_APPROVED" | "EVENT_REJECTED" | "EVENT_CANCELLED"
    | "PLACE_APPROVED" | "PLACE_REJECTED" | "PETITION_APPROVED" | "PETITION_REJECTED"
    | "CAMPAIGN_APPROVED" | "CAMPAIGN_REJECTED" | "DONATION_RECEIVED"
    | "PAYOUT_APPROVED" | "PAYOUT_PAID" | "PAYOUT_REJECTED"
    | "TOWN_HERO_APPROVED" | "TOWN_HERO_REJECTED" | "SYSTEM";
  export interface AccountNotification {
    id: string; type: AccountNotificationType; title: string; body: string | null;
    actionUrl: string | null; isRead: boolean; createdAt: string;
  }
  export interface AccountNotificationsResponse { items: AccountNotification[]; nextCursor: string | null; unread: number }
  export interface AccountMarkNotificationsReadRequest { ids?: string[] }

  /* ── sidebar ────────────────────────────────────────── */
  export type AccountStreakKind = "SOBER" | "MEDITATION" | "VOLUNTEERING" | "JOURNALING" | "CUSTOM";
  export interface AccountSidebarResponse {
    stats: AccountJourneyStats | { posts: 0; followers: 0; following: 0 };
    topStreak: {
      kind: AccountStreakKind; label: string | null; name: string; emoji: string; unit: string; days: number;
    } | null;
    badges: Array<{ slug: string; name: string; emoji: string }>;
    badgeCount: number;
    rooms: Array<{
      id: string; slug: string; name: string; emoji: string | null; color: string | null;
      tier: string; unread: number;
    }>;
  }

  /* ── search ─────────────────────────────────────────── */
  export interface AccountSearchQuery { q: string; countryId?: string }
  export type AccountSearchKind = "member" | "article" | "place" | "event" | "campaign" | "room";
  export interface AccountSearchHit {
    kind: AccountSearchKind;
    id: string;
    href: string;
    title: string;
    subtitle: string | null;
    onlineLabel?: boolean;
    emoji: string;
    avatarUrl?: string | null;
  }
  export interface AccountSearchResponse {
    q: string;
    hits: AccountSearchHit[];
    counts: Record<AccountSearchKind, number>;
    truncated: boolean;
  }

  /* ── saved ──────────────────────────────────────────── */
  export interface AccountSavedArticle {
    savedAt: string;
    id: string; slug: string; title: string; excerpt: string | null;
    coverUrl: string | null; coverAlt: string | null; videoUrl: string | null;
    readMinutes: number | null; publishedAt: string | null;
    viewCount: number; likeCount: number; saveCount: number; commentCount: number;
    authorNameSnapshot: string | null; authorAvatarSnapshot: string | null;
    category: { id: string; name: string; slug: string } | null;
  }
  export interface AccountSavedArticlesResponse { articles: AccountSavedArticle[] }
  export interface AccountSavedClip {
    savedAt: string;
    id: string; themeId: string; title: string; caption: string | null;
    kind: "EMBED" | "UPLOAD";
    embedUrl: string | null; videoUrl: string | null; posterUrl: string | null;
    width: number | null; height: number | null; durationSec: number | null;
    likeCount: number; saveCount: number; commentCount: number;
    publishedAt: string | null; createdAt: string; isPublished: boolean;
    theme: { slug: string; name: string; emoji: string | null; isActive: boolean };
    liked: false; myReaction: null; saved: true;
  }
  export interface AccountSavedClipsResponse { clips: AccountSavedClip[] }

  /* ── progress / streaks / badges ────────────────────── */
  export interface AccountStreak {
    id: string;
    kind: AccountStreakKind;
    label: string | null;
    name: string;
    unit: string;
    emoji: string;
    /** YYYY-MM-DD */
    startedOn: string;
    days: number;
    bestDays: number;
    resetCount: number;
    isPublic: boolean;
    archived: boolean;
  }
  export type AccountBadgeGroup = "recovery" | "writing" | "community" | "action";
  export type AccountBadgeSlug =
    | "sober-30" | "sober-90" | "sober-365" | "started-again"
    | "first-entry" | "journal-30" | "opened-up" | "grateful-10"
    | "first-post" | "first-reply" | "crisis-responder" | "hero-spotter"
    | "showed-up" | "petition-starter" | "gave";
  export interface AccountBadgeProgress {
    slug: AccountBadgeSlug; name: string; description: string; emoji: string;
    group: AccountBadgeGroup; earnedAt: string | null;
  }
  export interface AccountProgressResponse { streaks: AccountStreak[]; badges: AccountBadgeProgress[]; journalDays: number }
  export interface AccountStreaksResponse { streaks: AccountStreak[] }
  export interface AccountStartStreakRequest { kind: AccountStreakKind; startedOn: string; label?: string | null; isPublic?: boolean }
  export type AccountUpdateStreakRequest =
    | { reset: true; startedOn: string }
    | { reset?: false; startedOn?: string; label?: string; isPublic?: boolean };
  export interface AccountStreakResponse { streak: AccountStreak }
  export interface AccountDeleteStreakQuery { archive?: "1" }

  /* ── journal & daily reflection ─────────────────────── */
  export interface AccountJournalEntry {
    id: string;
    body: string;
    question: { id: string; body: string } | null;
    sharedPostId: string | null;
    sharedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }
  export interface AccountJournalPage { entries: AccountJournalEntry[]; nextCursor: string | null; total: number }
  export interface AccountJournalWriteRequest { body: string }
  export interface AccountJournalEntryResponse { entry: AccountJournalEntry }
  export interface AccountJournalShareRequest { isAnonymous?: boolean }
  export interface AccountJournalShareResponse { postId: string }

  export interface AccountDailyReflectionResponse {
    quote: { id: string; body: string; attribution: string | null } | null;
    question: {
      id: string;
      body: string;
      reflection: { body: string; updatedAt: string } | null;
    } | null;
  }
  export interface AccountSaveReflectionRequest { questionId: string; body: string }
  export interface AccountSaveReflectionResponse { reflection: { body: string; updatedAt: string } }

}

// ════════════════════════════════════════════════════════════
// Community Feed, Gratitude, Confessions, Uploads & Utilities
// ════════════════════════════════════════════════════════════

/** Community Feed, Gratitude, Confessions, Uploads & Utilities. Use as Feed.TypeName — shared enums above are visible inside. */
export namespace Feed {
  // Feed module types: Community Feed, Gratitude, Confessions (schema only), Uploads & Utilities.
  // Derived from src/lib/posts-feed.ts, comments.ts, gratitude.ts, gratitude-comments.ts,
  // video-status.ts, link-preview.ts, content-translate.ts and the route handlers.

  /* ── shared ─────────────────────────────────────────────── */

  export type FeedReactionType = "LIKE" | "HEART" | "CARE" | "STRENGTH" | "PROUD" | "SAME";

  export type FeedReportReason =
    | "SPAM"
    | "HARASSMENT"
    | "HATE_SPEECH"
    | "SELF_HARM"
    | "ADULT_CONTENT"
    | "MISINFORMATION"
    | "OFF_TOPIC"
    | "OTHER";

  export interface FeedErrorResponse {
    error: string;
  }

  export interface FeedReactionRequest {
    /** Omitted or unknown value = LIKE. Sending the same type you already have removes it. */
    type?: FeedReactionType;
  }

  /** Attached converted video (posts and gratitude). */
  export interface FeedAttachedVideo {
    assetId: string;
    url: string;
    posterUrl: string | null;
    width: number | null;
    height: number | null;
    durationSec: number | null;
  }

  export interface FeedImage {
    url: string;
    alt?: string | null;
  }

  /* ── posts ──────────────────────────────────────────────── */

  export interface FeedListQuery {
    /** Opaque "<ISO>_<id>" from previous nextCursor. */
    cursor?: string;
    /** 5–50, default 20 (clamped). */
    limit?: number;
    countryId?: string;
  }

  export interface FeedPost {
    id: string;
    /** WARNING: real author id even when isAnonymous (see gaps). */
    authorId: string | null;
    authorName: string;
    authorAvatar: string | null;
    /** Banned words masked with *. Plain text with **bold**, *italic*, ~~strike~~ markup. */
    body: string;
    images: Array<{ url: string; alt?: string | null }>;
    video: FeedAttachedVideo | null;
    isAnonymous: boolean;
    isFeatured: boolean;
    likeCount: number;
    commentCount: number;
    saveCount: number;
    liked: boolean;
    myReaction: FeedReactionType | null;
    saved: boolean;
    isOwn: boolean;
    countryName: string | null;
    countryCode: string | null;
    /** ISO 8601 */
    createdAt: string;
  }

  export interface FeedPage {
    items: FeedPost[];
    nextCursor: string | null;
  }

  export interface FeedCreatePostRequest {
    /** Required string; trimmed; max 5000. May be "" if images or video present. */
    body: string;
    isAnonymous?: boolean;
    /** Max 6 kept; entries without string url dropped. */
    images?: FeedImage[];
    /** Id of a READY VideoAsset owned by caller. */
    videoAssetId?: string;
    countryId?: string;
  }

  export interface FeedCreatePostResponse {
    ok: true;
    id: string;
  }

  export interface FeedOkResponse {
    ok: true;
  }

  export interface FeedPostReactionResponse {
    ok: true;
    liked: boolean;
    likeCount: number;
    myReaction: FeedReactionType | null;
  }

  export interface FeedSaveResponse {
    ok: true;
    saved: boolean;
    saveCount: number;
  }

  export interface FeedReportRequest {
    reason: FeedReportReason;
    /** Truncated to 2000 chars. */
    notes?: string;
  }

  export interface FeedReportResponse {
    ok: true;
    /** true when the caller already has an OPEN report on this target. */
    duplicate: boolean;
  }

  /* ── post comments ─────────────────────────────────────── */

  export interface FeedCommentsQuery {
    cursor?: string;
    /** 5–50, default 20. */
    limit?: number;
  }

  export interface FeedComment {
    id: string;
    /** WARNING: real author id even when isAnonymous. */
    authorId: string | null;
    authorName: string;
    authorAvatar: string | null;
    body: string;
    isAnonymous: boolean;
    likeCount: number;
    liked: boolean;
    myReaction: FeedReactionType | null;
    isOwn: boolean;
    createdAt: string;
  }

  export interface FeedCommentPage {
    items: FeedComment[];
    nextCursor: string | null;
  }

  export interface FeedCreateCommentRequest {
    /** 1–2000 chars after trim. */
    body: string;
    isAnonymous?: boolean;
  }

  export interface FeedCreateCommentResponse {
    ok: true;
    comment: FeedComment;
  }

  /** Comment reaction responses have NO `ok` key. */
  export interface FeedCommentReactionResponse {
    liked: boolean;
    likeCount: number;
    myReaction: FeedReactionType | null;
  }

  /* ── gratitude ──────────────────────────────────────────── */

  export type FeedGratitudeStatus = "PENDING" | "APPROVED" | "REJECTED";

  export interface FeedGratitudeListQuery {
    cursor?: string;
    /** Category slug; unknown slug = no filter. */
    category?: string;
  }

  export interface FeedGratitudeCategoryRef {
    id: string;
    name: string;
    slug: string;
    emoji: string | null;
  }

  export interface FeedGratitudeItem {
    id: string;
    /** null when anonymous. */
    authorId: string | null;
    /** "Anonymous" when anonymous. */
    authorName: string;
    authorAvatar: string | null;
    body: string;
    isAnonymous: boolean;
    heartCount: number;
    commentCount: number;
    hearted: boolean;
    myReaction: FeedReactionType | null;
    isOwn: boolean;
    imageUrl: string | null;
    video: FeedAttachedVideo | null;
    status: FeedGratitudeStatus;
    /** Only populated for own entries. */
    rejectionReason: string | null;
    category: FeedGratitudeCategoryRef | null;
    createdAt: string;
  }

  export interface FeedGratitudePage {
    items: FeedGratitudeItem[];
    /** base64url("<ISO>|<id>") */
    nextCursor: string | null;
  }

  export interface FeedCreateGratitudeRequest {
    /** 1–1000 chars after trim. */
    body: string;
    /** Photo OR video, not both. */
    imageUrl?: string;
    videoAssetId?: string;
    isAnonymous?: boolean;
    /** Required when any active category exists; unknown/inactive ids become null. */
    categoryId?: string;
  }

  export interface FeedCreateGratitudeResponse {
    item: FeedGratitudeItem;
  }

  export interface FeedGratitudeHeartResponse {
    hearted: boolean;
    heartCount: number;
    myReaction: FeedReactionType | null;
  }

  export interface FeedGratitudeComment {
    id: string;
    parentId: string | null;
    authorId: string | null;
    authorName: string;
    authorAvatar: string | null;
    body: string;
    isAnonymous: boolean;
    likeCount: number;
    liked: boolean;
    myReaction: FeedReactionType | null;
    isOwn: boolean;
    createdAt: string;
  }

  export interface FeedGratitudeCommentsResponse {
    comments: FeedGratitudeComment[];
  }

  export interface FeedCreateGratitudeCommentRequest {
    /** 1–4000 chars after trim. */
    body: string;
    isAnonymous?: boolean;
    /** Reply target; replies to replies are re-parented to the top-level comment. */
    parentId?: string;
  }

  export interface FeedCreateGratitudeCommentResponse {
    comment: FeedGratitudeComment;
    commentCount: number;
  }

  export interface FeedDeleteGratitudeCommentResponse {
    commentCount: number;
  }

  /** GET /api/public/categories?kind=gratitude (documented elsewhere; used by composer). */
  export interface FeedGratitudeCategoriesResponse {
    categories: FeedGratitudeCategoryRef[];
  }

  /* ── confessions (schema only; no API exists) ─────────────── */

  export type FeedConfessionStatus = "PENDING" | "APPROVED" | "REJECTED";

  export interface FeedConfessionCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    emoji: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }

  export interface FeedConfession {
    id: string;
    authorId: string;
    authorNameSnapshot: string;
    authorAvatarSnapshot: string | null;
    body: string;
    imageUrl: string | null;
    isAnonymous: boolean;
    video: FeedAttachedVideo | null;
    categoryId: string | null;
    status: FeedConfessionStatus;
    rejectionReason: string | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
    supportCount: number;
    commentCount: number;
    createdAt: string;
  }

  export interface FeedConfessionSupport {
    id: string;
    confessionId: string;
    userId: string;
    type: FeedReactionType;
    createdAt: string;
  }

  export interface FeedConfessionComment {
    id: string;
    confessionId: string;
    authorId: string;
    authorNameSnapshot: string;
    authorAvatarSnapshot: string | null;
    body: string;
    isAnonymous: boolean;
    likeCount: number;
    parentId: string | null;
    createdAt: string;
  }

  export interface FeedConfessionCommentReaction {
    commentId: string;
    userId: string;
    type: FeedReactionType;
    createdAt: string;
  }

  /* ── uploads ────────────────────────────────────────────── */

  export type FeedImageMime =
    | "image/png"
    | "image/jpeg"
    | "image/webp"
    | "image/gif"
    | "image/svg+xml"
    | "image/x-icon"
    | "image/vnd.microsoft.icon";

  /** multipart/form-data field `file`. */
  export interface FeedImageUploadRequest {
    file: Blob;
  }

  export interface FeedImageUploadSuccess {
    ok: true;
    url: string;
  }

  export interface FeedImageUploadFailure {
    ok: false;
    error: string;
  }

  export type FeedImageUploadResponse = FeedImageUploadSuccess | FeedImageUploadFailure;

  /** Raw body upload; headers carry metadata. */
  export interface FeedVideoUploadHeaders {
    "Content-Type": string; // video/* | application/octet-stream | application/mp4
    "x-filename": string; // encodeURIComponent(name), max 300 chars after decode
    "Content-Length"?: string;
  }

  export interface FeedVideoUploadResponse {
    ok: true;
    id: string;
  }

  export interface FeedVideoLimitsResponse {
    maxMB: number;
    /** 0 = no limit */
    maxSeconds: number;
  }

  export type FeedVideoStatus = "UPLOADING" | "QUEUED" | "PROCESSING" | "READY" | "FAILED";

  export type FeedVideoStage = "" | "inspect" | "convert" | "poster" | "verify" | "finish" | "done";

  export interface FeedVideoStatusResponse {
    id: string;
    status: FeedVideoStatus;
    percent: number;
    etaSeconds: number | null;
    stage: FeedVideoStage | string;
    message: string;
    url: string | null;
    posterUrl: string | null;
    width: number | null;
    height: number | null;
    durationSec: number | null;
    error: string | null;
  }

  export interface FeedVideoDiscardResponse {
    ok: boolean;
  }

  /* ── utilities ──────────────────────────────────────────── */

  export interface FeedLinkPreviewQuery {
    url: string;
  }

  export interface FeedLinkPreview {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
  }

  export interface FeedLinkPreviewResponse {
    preview: FeedLinkPreview | null;
  }

  export type FeedContentKind =
    | "articleCategory"
    | "eventCategory"
    | "campaignCategory"
    | "petitionCategory"
    | "gratitudeCategory"
    | "chatCategory"
    | "liveCategory"
    | "townHeroCategory"
    | "libraryTheme"
    | "article"
    | "event"
    | "campaign"
    | "petition"
    | "place"
    | "townHero"
    | "clip"
    | "liveStream"
    | "room"
    | "dailyQuote"
    | "dailyQuestion"
    | "post"
    | "comment"
    | "gratitude"
    | "gratitudeComment"
    | "clipComment"
    | "articleComment"
    | "chatMessage"
    | "liveComment"
    | "notification"
    | "member";

  export interface FeedContentRef {
    kind: FeedContentKind;
    id: string;
    /** e.g. "body" for post/comment/gratitude/gratitudeComment. */
    field: string;
  }

  export interface FeedTranslateRequest {
    /** Max 60 used per request. */
    refs: FeedContentRef[];
  }

  export interface FeedTranslateResponse {
    locale: string;
    /** key "<kind>:<id>:<field>" → translated text; missing = show original. */
    values: Record<string, string>;
    partial: boolean;
  }

  export interface FeedTranslateRateLimited {
    error: "Too many requests.";
    retryAfter: number;
  }

}

// ════════════════════════════════════════════════════════════
// Chat Rooms, Direct Messages & Live Streaming
// ════════════════════════════════════════════════════════════

/** Chat Rooms, Direct Messages & Live Streaming. Use as MessagingLive.TypeName — shared enums above are visible inside. */
export namespace MessagingLive {
  // Chat Rooms, Direct Messages & Live Streaming — request/response types.
  // Generated from src/lib/chat-user.ts, dm.ts, live-streams.ts, live-comments.ts,
  // live-categories.ts and the route handlers under src/app/api/user/{chatrooms,messages,live}.

  /* ───────────── Shared ───────────── */

  export interface ChatApiError {
    error: string;
    /** Present on 403 from members / messages when the room is not readable. */
    locked?: boolean;
  }

  export interface ChatOk {
    ok: true;
  }

  /* ───────────── Chat rooms: enums ───────────── */

  export type ChatTier = "PUBLIC" | "SUPPORT" | "CRISIS" | "CAVALRY";
  export type ChatRoomStatus = "ACTIVE" | "ARCHIVED";
  export type ChatMemberStatus = "PENDING" | "ACTIVE" | "BANNED";
  export type ChatMemberRole = "MEMBER" | "MODERATOR";
  export type ChatReactionEmoji = "❤️" | "🙏" | "🫂" | "👍" | "🎉" | "😢";
  export type ChatReportReason =
    | "SPAM"
    | "HARASSMENT"
    | "HATE_SPEECH"
    | "SELF_HARM"
    | "ADULT_CONTENT"
    | "MISINFORMATION"
    | "OFF_TOPIC"
    | "OTHER";

  /* ───────────── Chat rooms: browse ───────────── */

  export interface ChatListRoomsQuery {
    countryId?: string;
  }

  export interface ChatRoomSummary {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    tier: ChatTier;
    emoji: string | null;
    color: string | null;
    categoryId: string | null;
    categoryName: string | null;
    /** 9999 when uncategorised. */
    categorySort: number;
    memberCount: number;
    messageCount: number;
    membership: ChatMemberStatus | null;
    isMember: boolean;
    unread: number;
  }

  export interface ChatListRoomsResponse {
    rooms: ChatRoomSummary[];
  }

  /* ───────────── Chat rooms: detail ───────────── */

  export interface ChatPinnedPreview {
    id: string;
    authorName: string;
    body: string;
  }

  export interface ChatRoomDetail {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    rulesText: string | null;
    tier: ChatTier;
    status: ChatRoomStatus;
    emoji: string | null;
    color: string | null;
    allowAnonymous: boolean;
    slowModeSeconds: number;
    categoryName: string | null;
    memberCount: number;
    messageCount: number;
    membershipStatus: ChatMemberStatus | null;
    firstPostApproved: boolean;
    isMember: boolean;
    isModerator: boolean;
    banned: boolean;
    canRead: boolean;
    canPost: boolean;
    pinned: ChatPinnedPreview[];
  }

  export interface ChatRoomDetailResponse {
    room: ChatRoomDetail;
  }

  /* ───────────── Chat rooms: join / leave ───────────── */

  export interface ChatJoinResponse {
    ok: true;
    joined: true;
  }

  export interface ChatLeaveResponse {
    ok: true;
    left: true;
  }

  /* ───────────── Chat rooms: members ───────────── */

  export interface ChatMember {
    userId: string;
    userName: string;
    userAvatar: string | null;
    role: ChatMemberRole;
  }

  export interface ChatMembersResponse {
    members: ChatMember[];
  }

  /* ───────────── Chat rooms: messages ───────────── */

  export interface ChatReaction {
    emoji: string;
    count: number;
    mine: boolean;
  }

  export interface ChatReplyPreview {
    id: string;
    authorName: string;
    body: string;
  }

  export interface ChatAttachment {
    url: string;
    alt?: string | null;
  }

  export interface ChatMessage {
    id: string;
    authorId: string | null;
    authorName: string;
    authorAvatar: string | null;
    body: string;
    isAnonymous: boolean;
    isPinned: boolean;
    isOwn: boolean;
    pending: boolean;
    edited: boolean;
    /** ISO 8601 */
    createdAt: string;
    replyTo: ChatReplyPreview | null;
    reactions: ChatReaction[];
    attachments: ChatAttachment[];
  }

  export interface ChatListMessagesQuery {
    /** Cursor "<iso>|<id>" — older page. */
    before?: string;
    /** Cursor "<iso>|<id>" (or bare ISO) — newer messages, up to 100, oldest first. */
    after?: string;
    /** 10..50, default 30 (ignored in `after` mode). */
    limit?: number;
  }

  export interface ChatListMessagesResponse {
    items: ChatMessage[];
    hasMoreBefore: boolean;
    beforeCursor: string | null;
    afterCursor: string | null;
  }

  export interface ChatPostMessageRequest {
    /** Required string (may be "" when attachments present). Trimmed, max 2000 chars. */
    body: string;
    isAnonymous?: boolean;
    replyToId?: string;
    /** Max 4 kept; each needs a url (from POST /api/user/upload). */
    attachments?: ChatAttachment[];
    /** User ids to notify (must be ACTIVE members of the room). */
    mentions?: string[];
  }

  export interface ChatPostMessageResponse {
    ok: true;
    message: ChatMessage;
    pending: boolean;
  }

  export type ChatMessageAction = "edit" | "report" | "pin" | "unpin" | "remove" | "approve";

  export type ChatPatchMessageRequest =
    | { action: "edit"; body: string }
    | { action: "report"; reason: ChatReportReason; notes?: string }
    | { action: "pin" }
    | { action: "unpin" }
    | { action: "remove" }
    | { action: "approve" };

  export interface ChatEditMessageResponse {
    ok: true;
    message: ChatMessage;
  }

  export interface ChatReportMessageResponse {
    ok: true;
    duplicate: boolean;
  }

  export type ChatPatchMessageResponse = ChatEditMessageResponse | ChatReportMessageResponse | ChatOk;

  export interface ChatReactRequest {
    emoji: ChatReactionEmoji;
  }

  export interface ChatReactResponse {
    ok: true;
    emoji: string;
    count: number;
    mine: boolean;
  }

  /* ───────────── Chat rooms: panic ───────────── */

  export interface ChatHotline {
    region: string;
    name: string;
    detail: string;
    emergency: string;
  }

  export interface ChatPanicResponse {
    ok: true;
    moderatorsAlerted: number;
    hotline: ChatHotline;
  }

  /* ───────────── Chat rooms: SSE ───────────── */

  export interface ChatStreamQuery {
    /** Cursor "<iso>|<id>"; defaults to now. */
    after?: string;
  }

  /** event: messages — data: ChatMessage[] (oldest first). Heartbeat ": ping" every ~20s when idle. */
  export type ChatStreamEvent = { event: "messages"; data: ChatMessage[] };

  /* ───────────── Direct messages ───────────── */

  export type DmBox = "primary" | "requests";

  export interface DmListConversationsQuery {
    box?: DmBox;
  }

  export interface DmConversationSummary {
    id: string;
    otherId: string;
    otherName: string;
    otherAvatar: string | null;
    lastMessageText: string | null;
    lastMessageAt: string;
    lastSenderId: string | null;
    unread: number;
    isAccepted: boolean;
  }

  export interface DmListConversationsResponse {
    conversations: DmConversationSummary[];
  }

  export interface DmUnreadResponse {
    /** Number of accepted threads with ≥1 unread message. */
    inbox: number;
    /** Number of request threads with ≥1 unread message. */
    requests: number;
  }

  export interface DmMessage {
    id: string;
    senderId: string;
    /** "" when deleted. */
    body: string;
    imageUrl: string | null;
    deleted: boolean;
    isOwn: boolean;
    createdAt: string;
  }

  export interface DmThreadQuery {
    /** Opaque base64url cursor from nextCursor. */
    cursor?: string;
  }

  export interface DmThreadResponse {
    conversationId: string | null;
    other: { id: string; name: string; avatar: string | null } | null;
    isAccepted: boolean;
    isRequest: boolean;
    blocked: boolean;
    otherLastReadAt: string | null;
    messages: DmMessage[];
    nextCursor: string | null;
  }

  export interface DmSendRequest {
    /** Trimmed, max 4000. Body or imageUrl required. */
    body?: string;
    imageUrl?: string | null;
  }

  export interface DmSendResponse {
    conversationId: string;
    message: DmMessage;
  }

  export interface DmStreamQuery {
    /** ISO timestamp; defaults to now. */
    after?: string;
  }

  export type DmStreamEvent =
    | { event: "messages"; data: DmMessage[] }
    | { event: "seen"; data: { otherLastReadAt: string | null } }
    | { event: "typing"; data: { typing: boolean } };

  /* ───────────── Live streaming ───────────── */

  export type LiveStreamStatus = "IDLE" | "LIVE" | "ENDED";
  export type LiveVisibility = "PUBLIC" | "UNLISTED";

  export interface LiveStreamCategoryRef {
    id: string;
    name: string;
    slug: string;
    emoji: string | null;
    color: string | null;
  }

  export interface LiveStreamCard {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    status: LiveStreamStatus;
    visibility: LiveVisibility;
    ownerUserId: string | null;
    ownerName: string;
    ownerAvatar: string | null;
    startedAt: string | null;
    endedAt: string | null;
    viewerCount: number;
    viewerPeak: number;
    isMine: boolean;
    recording: boolean;
    category: LiveStreamCategoryRef | null;
  }

  export interface LiveCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    emoji: string | null;
    color: string | null;
    liveCount: number;
    viewerCount: number;
  }

  export interface LiveBrowseQuery {
    countryId?: string;
    categoryId?: string;
    /** Category slug (used when categoryId absent). */
    category?: string;
  }

  export interface LiveBrowseResponse {
    streams: LiveStreamCard[];
    categories: LiveCategory[];
    unknownCategory: boolean;
    blockedReason: string | null;
  }

  export interface LiveCategoriesResponse {
    categories: LiveCategory[];
  }

  export interface LiveCreateRequest {
    /** 1..200 chars after trim. */
    title: string;
    /** Required; must be an active LiveCategory id. */
    categoryId: string;
    /** Trimmed, truncated to 400. */
    summary?: string | null;
    /** Anything other than "UNLISTED" → server default (setting stream.defaultVisibility). */
    visibility?: LiveVisibility;
  }

  export interface LiveCreateResponse {
    ok: true;
    stream: LiveStreamCard;
  }

  export interface LiveMineResponse {
    streams: LiveStreamCard[];
    blockedReason: string | null;
  }

  export interface LiveWatchResponse {
    stream: LiveStreamCard;
    /** HLS manifest (…/index.m3u8) only while LIVE and streaming configured. */
    watchUrl: string | null;
  }

  export interface LiveBroadcastTicket {
    streamId: string;
    slug: string;
    /** 64-hex publish grant. Send as "Authorization: Bearer <token>" to publishUrl. */
    token: string;
    expiresAt: string;
    /** WHIP endpoint …/whip */
    publishUrl: string;
    /** HLS manifest …/index.m3u8 */
    watchUrl: string;
    maxHeight: number;
    maxDurationMin: number;
    recording: boolean;
  }

  export interface LiveConfirmResponse {
    live: boolean;
    problem?: string;
    tracks?: string[];
  }

  export interface LiveRecordingRequest {
    wanted: boolean;
  }

  export interface LiveRecordingResponse {
    recording: boolean;
  }

  export interface LiveEndResponse {
    ok: true;
  }

  export interface LiveViewersResponse {
    viewers: number;
    live: boolean;
  }

  export interface LiveComment {
    id: string;
    authorUserId: string | null;
    authorName: string;
    authorAvatar: string | null;
    body: string;
    createdAt: string;
    isMine: boolean;
    canRemove: boolean;
  }

  export interface LiveCommentsQuery {
    /** Cursor "<iso>|<id>" — tail mode, up to 200 newer comments. */
    after?: string;
    /** Page mode 10..100, default 50 (newest N, returned oldest first). */
    limit?: number;
  }

  export interface LiveCommentsResponse {
    comments: LiveComment[];
    canPost: boolean;
  }

  export interface LivePostCommentRequest {
    /** Trimmed, 1..500 chars. */
    body: string;
  }

  export interface LivePostCommentResponse {
    comment: LiveComment;
  }

  export interface LiveCommentsStreamQuery {
    after?: string;
  }

  /** event: comments — data: LiveComment[]; heartbeat ": ping" ~20s. */
  export type LiveCommentsStreamEvent = { event: "comments"; data: LiveComment[] };

  /* ───────────── MediaMTX auth hook (server-to-server) ───────────── */

  export type MediamtxAction = "publish" | "read" | "playback" | "api" | "metrics" | "pprof" | string;

  export interface MediamtxAuthRequest {
    user?: string;
    password?: string;
    token?: string;
    ip?: string;
    action?: MediamtxAction;
    path?: string;
    protocol?: string;
    id?: string;
    query?: string;
  }
  /** Response: 200 empty body = allow; 401 empty body = deny. */
  export type MediamtxAuthResponse = null;

}

// ════════════════════════════════════════════════════════════
// Articles, Video Library, Events, Petitions & Campaigns
// ════════════════════════════════════════════════════════════

/** Articles, Video Library, Events, Petitions & Campaigns. Use as Content.TypeName — shared enums above are visible inside. */
export namespace Content {
  // Content module: Articles, Video Library, Events, Petitions & Campaigns.
  // All dates are ISO-8601 strings over JSON.

  /* ── shared ─────────────────────────────────────────────── */

  export type ContentReactionType = "LIKE" | "HEART" | "CARE" | "STRENGTH" | "PROUD" | "SAME";

  export interface ContentErrorResponse {
    error: string;
    needsVerification?: boolean;
  }

  /** Body for every reaction toggle (articles, comments, clips, petitions). Unknown/missing type = LIKE. */
  export interface ContentReactRequest {
    type?: ContentReactionType;
  }

  export interface ContentReactionResult {
    liked: boolean;
    likeCount: number;
    myReaction: ContentReactionType | null;
  }

  export interface ContentPagedMeta {
    total: number;
    page: number;
    perPage: number;
    pageCount: number;
  }

  export interface ContentCountryQuery {
    countryId?: string;
  }

  /* ── articles ───────────────────────────────────────────── */

  export type ArticleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
  export type ArticleCommentStatus = "PUBLISHED" | "REMOVED";

  export interface ArticlesListQuery {
    /** ArticleCategory slug */
    category?: string;
    q?: string;
    /** default 1 */
    page?: number;
    /** default 12, max 48 */
    perPage?: number;
  }

  export interface ArticleCard {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    coverUrl: string | null;
    coverAlt: string | null;
    videoUrl: string | null;
    readMinutes: number | null;
    publishedAt: string | null;
    viewCount: number;
    likeCount: number;
    saveCount: number;
    commentCount: number;
    authorNameSnapshot: string | null;
    authorAvatarSnapshot: string | null;
    category: { id: string; name: string; slug: string } | null;
  }

  export interface ArticleReaderCategory {
    id: string;
    name: string;
    slug: string;
    count: number;
  }

  export interface ArticlesListResponse extends ContentPagedMeta {
    articles: ArticleCard[];
    categories: ArticleReaderCategory[];
  }

  export interface ArticleComment {
    id: string;
    parentId: string | null;
    /** NOT masked when isAnonymous — client must hide it */
    authorId: string;
    authorNameSnapshot: string;
    authorAvatarSnapshot: string | null;
    body: string;
    isAnonymous: boolean;
    likeCount: number;
    createdAt: string;
    liked: boolean;
    myReaction: ContentReactionType | null;
  }

  export interface ArticleCommentsResponse {
    comments: ArticleComment[];
  }

  export interface CreateArticleCommentRequest {
    /** non-empty after trim; stored truncated to 4000 chars */
    body: string;
    isAnonymous?: boolean;
    parentId?: string | null;
  }

  /** Raw ArticleComment row as created */
  export interface ArticleCommentRow {
    id: string;
    articleId: string;
    authorId: string;
    authorNameSnapshot: string;
    authorAvatarSnapshot: string | null;
    body: string;
    isAnonymous: boolean;
    status: ArticleCommentStatus;
    removedReason: string | null;
    parentId: string | null;
    likeCount: number;
    createdAt: string;
    [extra: string]: unknown;
  }

  export interface CreateArticleCommentResponse {
    ok: true;
    comment: ArticleCommentRow;
    commentCount: number;
  }

  export interface ArticleLikeResponse extends ContentReactionResult {
    ok: true;
  }

  export interface ArticleSaveResponse {
    ok: true;
    saved: boolean;
    saveCount: number;
  }

  export interface ArticleCommentDeleteResponse {
    ok: true;
    commentCount: number;
  }

  export interface ArticleCommentLikeResponse extends ContentReactionResult {
    ok: true;
  }

  /* ── library ────────────────────────────────────────────── */

  export type ClipKind = "EMBED" | "UPLOAD";

  export interface LibraryQuery {
    /** omit = themes list */
    scope?: "clips" | "following";
    /** required when scope=clips (theme id, not slug) */
    themeId?: string;
    /** default 1 */
    page?: number;
    /** default 24, max 48 */
    perPage?: number;
  }

  export interface LibraryTheme {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    coverUrl: string | null;
    emoji: string | null;
    followerCount: number;
    clipCount: number;
    sortOrder: number;
    following: boolean;
  }

  export interface LibraryThemesResponse {
    themes: LibraryTheme[];
  }

  export interface LibraryClip {
    id: string;
    themeId: string;
    title: string;
    caption: string | null;
    kind: ClipKind;
    /** raw provider URL (YouTube, Vimeo, Loom, Dailymotion, Spotify, SoundCloud) */
    embedUrl: string | null;
    videoUrl: string | null;
    posterUrl: string | null;
    width: number | null;
    height: number | null;
    durationSec: number | null;
    likeCount: number;
    saveCount: number;
    commentCount: number;
    publishedAt: string | null;
    createdAt: string;
    theme: { slug: string; name: string; emoji: string | null };
    liked: boolean;
    myReaction: ContentReactionType | null;
    saved: boolean;
  }

  export interface LibraryClipsResponse extends ContentPagedMeta {
    clips: LibraryClip[];
  }

  export interface LibraryFollowResponse {
    following: boolean;
    followerCount: number;
  }

  export type ClipLikeResponse = ContentReactionResult;

  export interface ClipSaveResponse {
    saved: boolean;
    saveCount: number;
  }

  export interface ClipComment {
    id: string;
    parentId: string | null;
    /** null when anonymous */
    authorId: string | null;
    /** "Anonymous" when anonymous */
    authorName: string;
    authorAvatar: string | null;
    body: string;
    isAnonymous: boolean;
    likeCount: number;
    liked: boolean;
    myReaction: ContentReactionType | null;
    isOwn: boolean;
    createdAt: string;
  }

  export interface ClipCommentsResponse {
    comments: ClipComment[];
  }

  export interface CreateClipCommentRequest {
    /** 1..4000 chars after trim */
    body: string;
    isAnonymous?: boolean;
    parentId?: string | null;
  }

  export interface CreateClipCommentResponse {
    comment: ClipComment;
    commentCount: number;
  }

  export interface ClipCommentDeleteResponse {
    ok: true;
    commentCount: number;
  }

  export type ClipCommentLikeResponse = ContentReactionResult;

  /* ── events ─────────────────────────────────────────────── */

  export type EventStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

  export interface EventCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    emoji: string | null;
    color: string | null;
    upcomingCount: number;
  }

  export interface EventCategoriesResponse {
    categories: EventCategory[];
  }

  export interface EventsListQuery {
    countryId?: string;
    /** EventCategory slug; unknown/retired = no filter */
    category?: string;
    q?: string;
    /** "1" = past events, newest first */
    past?: "1";
    page?: number;
    /** default 12, max 48 */
    perPage?: number;
  }

  export interface EventCard {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    coverUrl: string | null;
    startsAt: string;
    endsAt: string | null;
    /** IANA zone the organiser used — always format times in this zone */
    timezone: string;
    isOnline: boolean;
    venueName: string | null;
    city: string | null;
    countryId: string | null;
    capacity: number | null;
    rsvpCount: number;
    status: EventStatus;
    hostNameSnapshot: string | null;
    hostAvatarSnapshot: string | null;
    category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
  }

  export interface EventsListResponse extends ContentPagedMeta {
    events: EventCard[];
  }

  export interface CreateEventRequest {
    /** required, trimmed, max 200 */
    title: string;
    /** required, markdown */
    description: string;
    /** max 400 */
    summary?: string | null;
    coverUrl?: string | null;
    /** ISO instant (UTC) */
    startsAt: string;
    /** ISO, must be after startsAt */
    endsAt?: string | null;
    /** IANA zone, default "UTC" */
    timezone?: string | null;
    isOnline?: boolean;
    /** required when isOnline */
    joinUrl?: string | null;
    /** venueName or addressLine required when not online */
    venueName?: string | null;
    addressLine?: string | null;
    city?: string | null;
    countryId?: string | null;
    /** positive integer, else unlimited */
    capacity?: number | null;
    /** max 12 kept */
    photos?: { url: string; alt?: string }[] | null;
    /** required, active EventCategory id */
    categoryId: string;
  }

  export interface CreateEventResponse {
    ok: true;
    id: string;
    slug: string;
  }

  export interface EventRsvpResponse {
    ok: true;
    going: boolean;
    rsvpCount: number;
  }

  /* ── petitions ──────────────────────────────────────────── */

  export type PetitionStatus = "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";

  export interface PetitionCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    emoji: string | null;
    color: string | null;
    openCount: number;
  }

  export interface PetitionCategoriesResponse {
    categories: PetitionCategory[];
  }

  export interface PetitionsListQuery {
    /** NOTE: "country", not "countryId" */
    country?: string;
    /** PetitionCategory slug; unknown = no filter */
    category?: string;
    /** "1" = only still taking signatures */
    open?: "1";
    /** page size, default 30, max 60 */
    take?: number;
    page?: number;
  }

  export interface PetitionImage {
    url: string;
    alt: string | null;
  }

  export interface PetitionVideo {
    assetId: string;
    url: string;
    posterUrl: string | null;
    width: number | null;
    height: number | null;
    durationSec: number | null;
  }

  export interface PetitionCard {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    coverUrl: string | null;
    photos: PetitionImage[];
    video: PetitionVideo | null;
    target: string;
    goal: number | null;
    status: PetitionStatus;
    countryId: string | null;
    category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
    closesAt: string | null;
    signatureCount: number;
    reactionCount: number;
    creatorUserId: string | null;
    creatorName: string;
    creatorAvatar: string | null;
    createdAt: string;
    open: boolean;
    isMine: boolean;
  }

  export interface PetitionsListResponse {
    petitions: PetitionCard[];
  }

  export interface PetitionDetail extends PetitionCard {
    body: string;
    /** only for the creator */
    rejectionReason: string | null;
    hasSigned: boolean;
    myReaction: ContentReactionType | null;
  }

  export interface PetitionSignature {
    userId: string;
    name: string;
    avatar: string | null;
    comment: string | null;
    createdAt: string;
  }

  export interface PetitionDetailResponse {
    petition: PetitionDetail;
    /** up to 50 newest non-anonymous */
    signatures: PetitionSignature[];
  }

  export interface CreatePetitionRequest {
    /** 6..200 chars after trim */
    title: string;
    /** max 400 */
    summary?: string | null;
    /** min 40 chars after trim */
    body: string;
    /** 2..200 chars */
    target: string;
    /** >0, clamped to 1,000,000 */
    goal?: number | null;
    countryId?: string | null;
    /** required, active PetitionCategory id */
    categoryId: string;
    /** ISO date */
    closesAt?: string | null;
    coverUrl?: string | null;
    /** max 10 kept */
    photos?: { url: string; alt?: string | null }[] | null;
    /** READY VideoAsset owned by the caller */
    videoAssetId?: string | null;
  }

  export interface CreatePetitionResponse {
    slug: string;
  }

  export interface PetitionCloseResponse {
    ok: true;
  }

  export interface SignPetitionRequest {
    /** max 400, used only when signing */
    comment?: string | null;
    anonymous?: boolean;
  }

  export interface SignPetitionResponse {
    ok: true;
    signed: boolean;
    signatureCount: number;
  }

  export interface PetitionReactResponse {
    reacted: boolean;
    reactionCount: number;
    myReaction: ContentReactionType | null;
  }

  /* ── campaigns ──────────────────────────────────────────── */

  export type CampaignStatus = "PENDING" | "DRAFT" | "PUBLISHED" | "REJECTED" | "ARCHIVED";

  export interface CampaignCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    emoji: string | null;
    color: string | null;
    liveCount: number;
  }

  export interface CampaignCategoriesResponse {
    categories: CampaignCategory[];
  }

  export interface CampaignsListQuery {
    countryId?: string;
    /** CampaignCategory slug; unknown = no filter */
    category?: string;
    /** "1" = hide finished */
    live?: "1";
    /** page size; omitted = ALL rows */
    take?: number;
    page?: number;
  }

  export interface CampaignCard {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    coverUrl: string | null;
    emoji: string | null;
    status: CampaignStatus;
    publishedAt: string | null;
    startsAt: string | null;
    endsAt: string | null;
    countryId: string | null;
    supporterCount: number;
    category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
    _count: { articles: number; events: number };
    supporting: boolean;
    finished: boolean;
  }

  export interface CampaignsListResponse {
    campaigns: CampaignCard[];
  }

  export interface CreateCampaignRequest {
    /** 6..200 chars after trim */
    title: string;
    /** max 400 */
    summary?: string | null;
    /** 40..40000 chars after trim */
    body: string;
    /** required, active CampaignCategory id */
    categoryId: string;
    countryId?: string | null;
    coverUrl?: string | null;
    /** max 10 kept */
    photos?: { url: string; alt?: string | null }[] | null;
  }

  export interface CreateCampaignResponse {
    slug: string;
  }

  export interface CampaignSupportResponse {
    supporting: boolean;
    supporterCount: number;
  }

  /* ── shared categories ──────────────────────────────────── */

  export interface PublicCategoriesQuery {
    kind: "gratitude";
  }

  export interface PublicCategory {
    id: string;
    name: string;
    slug: string;
    emoji: string | null;
  }

  export interface PublicCategoriesResponse {
    categories: PublicCategory[];
  }

}

// ════════════════════════════════════════════════════════════
// Places Directory, Town Heroes, Geography, Donations & Payouts
// ════════════════════════════════════════════════════════════

/** Places Directory, Town Heroes, Geography, Donations & Payouts. Use as PlacesMoney.TypeName — shared enums above are visible inside. */
export namespace PlacesMoney {
  // Places Directory, Town Heroes, Geography, Donations & Payouts — API types.
  // All money is integer cents. All dates are ISO-8601 strings.

  /* ── Geography ─────────────────────────────────────────────── */

  export interface GeoCountry {
    id: string;
    name: string;
    code: string; // ISO 3166-1 alpha-2
    slug: string;
    emojiFlag: string | null;
  }
  export interface GeoCountriesResponse { items: GeoCountry[] }

  export interface GeoStatesQuery { countryId?: string }
  export interface GeoState { id: string; name: string; code: string | null; slug: string }
  export interface GeoStatesResponse { items: GeoState[] }

  /* ── Places ────────────────────────────────────────────────── */

  export type PlaceType =
    | "RECOVERY_PROGRAM" | "CLINIC" | "COUNSELLING" | "CHURCH" | "FOOD_BANK"
    | "ANIMAL_SHELTER" | "SHELTER" | "COMMUNITY_CENTRE" | "DONATING_BUSINESS" | "OTHER";

  export type PlaceStatus = "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";

  export type PlaceReportKind =
    | "CLOSED_DOWN" | "MOVED" | "WRONG_DETAILS" | "DUPLICATE" | "NOT_APPROPRIATE" | "OTHER";

  export interface PlaceTypeTile {
    value: PlaceType;
    label: string;
    emoji: string;
    colour: string; // hex
    slug: string; // e.g. "food-banks"
    blurb: string;
    count: number;
  }
  export interface PlaceTypesQuery { countryId?: string }
  export interface PlaceTypesResponse { types: PlaceTypeTile[] }

  export interface PlacesListQuery {
    types?: string; // comma-separated PlaceType values
    donorOnly?: "1";
    countryId?: string;
    stateId?: string;
    saved?: "1";
    q?: string;
    lat?: number;
    lng?: number;
    km?: number; // clamped 1..2000
    mappable?: "1";
    page?: number; // default 1
    perPage?: number; // default 50, max 200
  }

  export interface PlaceCard {
    id: string;
    slug: string;
    name: string;
    type: PlaceType;
    summary: string | null;
    addressLine: string | null;
    city: string | null;
    postcode: string | null;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    website: string | null;
    isDonor: boolean;
    coverUrl: string | null;
    saveCount: number;
    needs: string | null;
    countryId: string | null;
    saved: boolean;
    distanceKm: number | null;
  }
  export interface PlacesListResponse {
    places: PlaceCard[];
    total: number;
    page: number;
    perPage: number;
    pageCount: number;
  }

  export interface PlaceOpeningHour {
    day: number; // 0 = Sunday .. 6
    opens?: string; // "HH:MM"
    closes?: string;
    closed?: boolean;
  }

  export interface PlacePhotoInput { url: string; alt?: string | null }

  export interface SubmitPlaceRequest {
    name: string;
    type?: PlaceType;
    summary?: string | null;
    about?: string | null;
    addressLine?: string | null;
    city?: string | null;
    postcode?: string | null;
    countryId?: string | null;
    stateId?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    hours?: PlaceOpeningHour[] | null;
    needs?: string | null;
    coverUrl?: string | null;
    photos?: PlacePhotoInput[] | null;
  }
  export interface SubmitPlaceResponse { ok: true; id: string; slug: string; name: string }

  export interface PlaceSaveToggleResponse { saved: boolean; saveCount: number }

  export interface ReportPlaceRequest { kind: PlaceReportKind; notes?: string | null }
  export interface ReportPlaceResponse { ok: true; updated: boolean }

  export interface PlaceFilterSetFilters {
    types?: PlaceType[];
    donorOnly?: true;
    stateId?: string;
    q?: string;
  }
  export interface PlaceFilterSet {
    id: string;
    name: string;
    filters: PlaceFilterSetFilters;
    createdAt: string;
  }
  export interface PlaceFilterSetsResponse { sets: PlaceFilterSet[] }
  export interface SavePlaceFilterSetRequest { name: string; filters?: PlaceFilterSetFilters }
  export interface SavePlaceFilterSetResponse {
    ok: true;
    set: { id: string; name: string; filters: PlaceFilterSetFilters };
  }
  export interface PlacesOkResponse { ok: true }

  /** Shape the web detail page builds (no API yet — see gaps). */
  export interface PlaceDetail extends Omit<PlaceCard, "distanceKm"> {
    photos: Array<{ url: string; alt: string | null }> | null;
    about: string | null;
    email: string | null;
    hours: PlaceOpeningHour[];
    stateId: string | null;
    viewCount: number;
    chatRoomId: string | null;
    geocodedAt: string | null;
    createdAt: string;
    room: { id: string; slug: string; name: string; memberCount: number } | null;
    country: { name: string; emojiFlag: string | null } | null;
  }

  /* ── Town Heroes ───────────────────────────────────────────── */

  export type TownHeroStatus = "PENDING" | "APPROVED" | "REJECTED";

  export interface TownHeroCategoryRef {
    id: string;
    name: string;
    slug: string;
    emoji: string | null;
    color: string | null;
  }

  export interface TownHero {
    id: string;
    slug: string;
    heroName: string;
    town: string | null;
    countryId: string | null;
    photoUrl: string | null;
    photoAlt: string;
    summary: string | null;
    category: TownHeroCategoryRef;
    body?: string; // only on nominate response / detail
    nominatorName: string | null;
    isAnonymous: boolean;
    status: TownHeroStatus;
    rejectionReason: string | null;
    heartCount: number;
    hearted: boolean;
    isOwn: boolean;
    isFeatured: boolean;
    approvedAt: string | null;
    createdAt: string;
  }

  export interface TownHeroesListQuery {
    countryId?: string;
    category?: string; // category slug
    q?: string;
    take?: number; // default 30, max 60
    page?: number; // default 1
  }
  export interface TownHeroesListResponse { heroes: TownHero[] }

  export interface TownHeroHighlightsQuery { countryId?: string; take?: number /* default 6, max 12 */ }
  export interface TownHeroHighlightsResponse { heroes: TownHero[] }

  export interface NominateTownHeroRequest {
    heroName: string;
    categoryId: string;
    body: string;
    town?: string | null;
    countryId?: string | null;
    photoUrl?: string | null;
    photoAlt?: string | null;
    summary?: string | null;
    isAnonymous?: boolean;
  }
  export interface NominateTownHeroResponse { hero: TownHero }

  export interface TownHeroHeartResponse { hearted: boolean; heartCount: number }

  export interface TownHeroCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    emoji: string | null;
    color: string | null;
    publicCount: number;
  }
  export interface TownHeroCategoriesQuery { countryId?: string }
  export interface TownHeroCategoriesResponse { categories: TownHeroCategory[] }

  /* ── Donations ─────────────────────────────────────────────── */

  export type DonationStatus = "PENDING" | "SUCCEEDED" | "REFUNDED" | "FAILED" | "DISPUTED";

  export type DonationsConfigResponse =
    | { enabled: boolean; minCents: number; maxCents: number; currency: string }
    | { enabled: false };

  export interface DonationCheckoutRequest {
    amountCents: number;
    recipientUserId?: string;
    campaignId?: string;
    eventId?: string;
    liveStreamId?: string;
    donorEmail?: string; // used only when signed out
    message?: string; // max 500
    isAnonymous?: boolean;
  }
  export interface DonationCheckoutResponse { ok: true; url: string }

  export interface DonationRow {
    id: string;
    grossCents: number;
    netCents: number;
    refundedCents: number;
    currency: string;
    status: DonationStatus;
    message: string | null;
    isAnonymous: boolean;
    recipientName: string | null;
    donorName: string | null;
    causeTitle: string | null;
    createdAt: string;
    succeededAt: string | null;
    availableAt: string | null;
  }

  export interface MoneyBalance {
    availableCents: number;
    onHoldCents: number;
    reservedCents: number;
    paidOutCents: number;
    lifetimeCents: number;
    currency: string;
  }

  export interface DonationsHistoryResponse {
    given: DonationRow[];
    received: DonationRow[];
    balance: MoneyBalance;
  }

  export type StripeWebhookEvent =
    | "checkout.session.completed"
    | "checkout.session.async_payment_succeeded"
    | "checkout.session.async_payment_failed"
    | "checkout.session.expired"
    | "charge.refunded"
    | "charge.refund.updated"
    | "charge.dispute.created"
    | "charge.dispute.closed";

  export interface StripeWebhookResponse { received: true; handled: boolean; note: string }

  /* ── Payouts ───────────────────────────────────────────────── */

  export type PayoutMethodType = "PAYPAL" | "BANK" | "WISE" | "CHECK";
  export type PayoutStatus = "REQUESTED" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";

  export interface PayoutMethod {
    id: string;
    type: PayoutMethodType;
    typeLabel: string;
    label: string | null;
    displayHint: string;
    isDefault: boolean;
    readable: boolean;
    createdAt: string;
  }
  export interface PayoutMethodsResponse { methods: PayoutMethod[] }

  export interface PayoutEmailDetails { email: string }
  export interface PayoutBankDetails {
    accountName: string;
    accountNumber?: string;
    routingNumber?: string;
    iban?: string;
    swift?: string;
    bankName?: string;
    country?: string; // 2 letters
  }
  export interface PayoutCheckDetails {
    payeeName: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postcode: string;
    country?: string;
  }

  export type AddPayoutMethodRequest =
    | { type: "PAYPAL" | "WISE"; details: PayoutEmailDetails; label?: string }
    | { type: "BANK"; details: PayoutBankDetails; label?: string }
    | { type: "CHECK"; details: PayoutCheckDetails; label?: string };
  export interface AddPayoutMethodResponse { ok: true; id: string }

  export interface UpdatePayoutMethodRequest { isDefault: true }
  export interface PayoutsOkResponse { ok: true }

  export interface Payout {
    id: string;
    userId: string;
    userNameSnapshot: string;
    userEmailSnapshot: string | null;
    amountCents: number;
    feeBasisPoints: number;
    feeCents: number;
    netCents: number;
    currency: string;
    methodId: string | null;
    methodSnapshot: { type: PayoutMethodType; label: string | null; displayHint: string };
    status: PayoutStatus;
    requestedAt: string;
    reviewedAt: string | null;
    paidAt: string | null;
    reviewedByAdminId: string | null;
    adminNote: string | null;
    rejectionReason: string | null;
    externalRef: string | null;
    createdAt: string;
    updatedAt: string;
  }

  export interface PayoutLimits {
    enabled: boolean;
    minCents: number;
    feeBasisPoints: number;
    holdDays: number;
    currency: string;
    allowedMethods: PayoutMethodType[];
  }

  export interface PayoutsOverviewResponse {
    balance: MoneyBalance;
    methods: PayoutMethod[];
    payouts: Payout[];
    limits: PayoutLimits;
  }

  export interface RequestPayoutRequest { amountCents: number; methodId: string }
  export interface RequestPayoutResponse { ok: true; id: string }

  export interface PlacesMoneyError { error: string; needsVerification?: boolean }

}

// ════════════════════════════════════════════════════════════
// Admin: Auth, Team, Users, Moderation, Chat, Live, Notifications, Settings, Money, Media, Translations
// ════════════════════════════════════════════════════════════

/** Admin: Auth, Team, Users, Moderation, Chat, Live, Notifications, Settings, Money, Media, Translations. Use as AdminCore.TypeName — shared enums above are visible inside. */
export namespace AdminCore {
  // Admin core module types — derived from src/app/api/admin/** and src/lib/*.
  // All dates are ISO-8601 strings. Money is integer cents.

  /* ── shared ─────────────────────────────────────────────── */
  export type AdminRole = "OWNER" | "ADMIN" | "MODERATOR";
  export interface AdminErrorResponse { error: string }
  export interface AdminOkResponse { ok: true }
  export interface AdminPaged<T> {
    items: T[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  }
  export interface AdminPageQuery { page?: number; perPage?: number /* 5..100, default 25 */ }

  /* ── auth ───────────────────────────────────────────────── */
  export interface AdminLoginRequest { email: string; password: string }
  export interface AdminLoginResponse { ok: true }
  export interface AdminLogoutResponse { ok: true }
  /** Server-side shape only (getCurrentAdmin) — no API returns it. */
  export interface AdminSession { id: string; email: string; displayName: string; role: AdminRole }

  /* ── team ───────────────────────────────────────────────── */
  export interface AdminTeamMember {
    id: string;
    email: string;
    displayName: string;
    role: AdminRole;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  }
  export interface AdminTeamListQuery extends AdminPageQuery {
    q?: string;
    status?: "all" | "active" | "inactive";
    role?: "all" | AdminRole;
  }
  export type AdminTeamListResponse = AdminPaged<AdminTeamMember>;
  export interface AdminTeamCreateRequest {
    email: string;
    displayName: string; // 2..60
    password?: string; // >= 8; generated if blank
    role?: AdminRole; // default ADMIN
  }
  export interface AdminTeamCreateResponse { item: AdminTeamMember; initialPassword: string }
  export interface AdminTeamItemResponse { item: AdminTeamMember }
  export interface AdminTeamUpdateRequest { displayName?: string; email?: string; role?: AdminRole }
  export interface AdminTeamDeleteRequest { reason?: string }
  export interface AdminTeamResetPasswordRequest { password?: string }
  export interface AdminTeamResetPasswordResponse { ok: true; newPassword: string }
  export interface AdminTeamStatusRequest { action: "activate" | "deactivate"; reason?: string }

  /* ── users ──────────────────────────────────────────────── */
  export interface AdminUser {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    anonymousByDefault: boolean;
    isActive: boolean;
    bannedAt: string | null;
    banReason: string | null;
    emailVerifiedAt: string | null;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
    activityCount: number;
  }
  export type AdminUserStatusFilter = "all" | "active" | "inactive" | "banned" | "unverified";
  export type AdminUserSort = "created_desc" | "created_asc" | "last_login" | "name";
  export interface AdminUserListQuery extends AdminPageQuery {
    q?: string;
    status?: AdminUserStatusFilter;
    sort?: AdminUserSort;
  }
  export type AdminUserListResponse = AdminPaged<AdminUser>;
  export interface AdminUserCreateRequest {
    email: string;
    displayName: string; // 2..40
    password: string; // >= 8
    emailVerified?: boolean;
  }
  export interface AdminUserItemResponse { item: AdminUser }
  export interface AdminUserUpdateRequest {
    displayName?: string;
    email?: string;
    avatarUrl?: string | null;
    anonymousByDefault?: boolean;
  }
  export interface AdminUserDeleteRequest { reason?: string }
  export type AdminUserStatusAction = "activate" | "deactivate" | "ban" | "unban";
  export interface AdminUserStatusRequest { action: AdminUserStatusAction; reason?: string /* required for ban */ }
  export interface AdminUserActivityQuery extends AdminPageQuery { kind?: "user" | "admin" }
  export type AdminUserActivityType =
    | "SIGNED_UP" | "SIGNED_IN" | "SIGN_IN_FAILED" | "EMAIL_VERIFIED"
    | "PASSWORD_CHANGED" | "PROFILE_UPDATED" | "ADMIN_ACTION";
  export interface AdminUserActivity {
    id: string;
    type: AdminUserActivityType;
    message: string;
    meta: unknown | null;
    createdAt: string;
  }
  export type AdminActionType =
    | "USER_UPDATED" | "USER_ACTIVATED" | "USER_DEACTIVATED" | "USER_BANNED" | "USER_UNBANNED"
    | "USER_DELETED" | "USER_PASSWORD_RESET_SENT" | "USER_EMAIL_SENT" | "USER_CREATED"
    | "POST_REMOVED" | "POST_RESTORED" | "POST_FEATURED" | "POST_UNFEATURED"
    | "COMMENT_REMOVED" | "COMMENT_RESTORED" | "REPORT_RESOLVED" | "REPORT_DISMISSED"
    | "PAYOUT_APPROVED" | "PAYOUT_PAID" | "PAYOUT_REJECTED" | "PAYOUT_REVERSED"
    | "PAYOUT_DETAILS_VIEWED" | "PAYMENT_SETTINGS_UPDATED";
  export interface AdminActionEntry {
    id: string;
    action: AdminActionType;
    reason: string | null;
    meta: unknown | null;
    createdAt: string;
    admin: { id: string; displayName: string; email: string } | null;
  }
  export type AdminUserActivityResponse = AdminPaged<AdminUserActivity> | AdminPaged<AdminActionEntry>;
  export interface AdminUserSendEmailRequest { templateSlug: string; variables?: Record<string, string> }
  export interface AdminUserEmailResponse { ok: true }
  export interface AdminUserEmailFailure { ok: false; error: string }

  /* ── posts moderation ───────────────────────────────────── */
  export type AdminPostStatus = "PUBLISHED" | "PENDING" | "REMOVED" | "DRAFT";
  export type AdminPostStatusFilter = "all" | "published" | "pending" | "removed" | "reported";
  export interface AdminPostVideo {
    assetId: string;
    url: string;
    posterUrl: string | null;
    width: number | null;
    height: number | null;
    durationSec: number | null;
  }
  export interface AdminPost {
    id: string;
    authorId: string | null;
    authorName: string;
    authorAvatar: string | null;
    authorEmail: string | null;
    body: string;
    images: Array<{ url: string; alt?: string | null }>;
    video: AdminPostVideo | null;
    isAnonymous: boolean;
    status: AdminPostStatus;
    isFeatured: boolean;
    removedReason: string | null;
    likeCount: number;
    commentCount: number;
    saveCount: number;
    reportCount: number;
    countryId: string | null;
    countryName: string | null;
    createdAt: string;
    updatedAt: string;
  }
  export interface AdminPostComment {
    id: string;
    postId: string;
    authorId: string | null;
    authorName: string;
    authorAvatar: string | null;
    body: string;
    isAnonymous: boolean;
    status: AdminPostStatus;
    likeCount: number;
    reportCount: number;
    removedReason: string | null;
    createdAt: string;
  }
  export interface AdminPostListQuery extends AdminPageQuery {
    q?: string;
    status?: AdminPostStatusFilter;
    authorId?: string;
    countryId?: string;
    featured?: "1";
  }
  export type AdminPostListResponse = AdminPaged<AdminPost>;
  export interface AdminPostDetailResponse { item: AdminPost; comments: AdminPostComment[] }
  export interface AdminPostPurgeResponse { ok: true; bytesFreed: number }
  export interface AdminPostActionRequest { action: "remove" | "restore" | "feature" | "unfeature"; reason?: string }
  export interface AdminCommentActionRequest { action: "remove" | "restore"; reason?: string }
  export interface AdminPostStats {
    postsTotal: number;
    postsPublished: number;
    postsRemoved: number;
    commentsTotal: number;
    reportsOpen: number;
    reportsResolvedLast7d: number;
  }
  export type AdminReportReason =
    | "SPAM" | "HARASSMENT" | "HATE_SPEECH" | "SELF_HARM"
    | "ADULT_CONTENT" | "MISINFORMATION" | "OFF_TOPIC" | "OTHER";
  export interface AdminReport {
    id: string;
    targetType: "POST" | "COMMENT";
    postId: string;
    commentId: string | null;
    reporterId: string | null;
    reporterName: string | null;
    reason: AdminReportReason;
    notes: string | null;
    status: "OPEN" | "RESOLVED" | "DISMISSED";
    resolvedByName: string | null;
    resolvedAt: string | null;
    resolution: string | null;
    createdAt: string;
    targetPreview: string; // max 240 chars + "…"
    targetAuthorName: string;
  }
  export interface AdminReportListQuery extends AdminPageQuery {
    status?: "all" | "open" | "resolved" | "dismissed"; // default open
    reason?: AdminReportReason;
  }
  export type AdminReportListResponse = AdminPaged<AdminReport>;
  export interface AdminReportResolveRequest { outcome: "remove" | "keep" | "dismiss"; note?: string }
  export interface AdminReportCountResponse { openCount: number }

  /* ── banned words ───────────────────────────────────────── */
  export interface AdminBannedWord { id: string; word: string; createdAt: string }
  export interface AdminBannedWordsResponse { words: AdminBannedWord[] }
  export interface AdminBannedWordsAddRequest { words?: string; word?: string }
  export interface AdminBannedWordsAddResponse { ok: true; added: number }

  /* ── chat ───────────────────────────────────────────────── */
  export type AdminChatTier = "PUBLIC" | "SUPPORT" | "CRISIS" | "CAVALRY";
  export type AdminChatRoomStatus = "ACTIVE" | "ARCHIVED";
  export interface AdminChatCategory { id: string; name: string; slug: string; sortOrder: number; roomCount: number }
  export interface AdminChatCategoriesResponse { categories: AdminChatCategory[] }
  export interface AdminChatCategoryCreateRequest { name: string; sortOrder?: number }
  export interface AdminChatCategoryUpdateRequest { name?: string; sortOrder?: number }
  export interface AdminChatCreatedResponse { ok: true; id: string }
  export interface AdminChatRoomListItem {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    tier: AdminChatTier;
    status: AdminChatRoomStatus;
    categoryId: string | null;
    categoryName: string | null;
    emoji: string | null;
    color: string | null;
    allowAnonymous: boolean;
    isFeatured: boolean;
    sortOrder: number;
    memberCount: number;
    messageCount: number;
    createdAt: string;
  }
  export interface AdminChatRoomListQuery {
    q?: string;
    status?: "all" | "active" | "archived";
    tier?: "all" | AdminChatTier;
    categoryId?: string;
  }
  export interface AdminChatRoomListResponse { rooms: AdminChatRoomListItem[] }
  export interface AdminChatRoomDetail extends AdminChatRoomListItem {
    countryId: string | null;
    slowModeSeconds: number;
    rulesText: string | null;
    pendingMessages: number;
    pendingMembers: number;
  }
  export interface AdminChatRoomDetailResponse { room: AdminChatRoomDetail }
  export interface AdminChatRoomInput {
    name?: string; // required on create
    slug?: string;
    description?: string | null;
    tier?: AdminChatTier;
    status?: AdminChatRoomStatus;
    categoryId?: string | null;
    countryId?: string | null;
    emoji?: string | null;
    color?: string | null;
    allowAnonymous?: boolean;
    isFeatured?: boolean;
    sortOrder?: number;
    slowModeSeconds?: number;
    rulesText?: string | null;
  }
  export interface AdminChatRoomCreatedResponse { ok: true; id: string; slug: string }
  export type AdminChatMemberRole = "MEMBER" | "MODERATOR";
  export type AdminChatMemberStatus = "PENDING" | "ACTIVE" | "BANNED";
  export interface AdminChatMember {
    id: string;
    userId: string;
    userName: string;
    userAvatar: string | null;
    role: AdminChatMemberRole;
    status: AdminChatMemberStatus;
    firstPostApproved: boolean;
    joinedAt: string;
  }
  export interface AdminChatMembersResponse { members: AdminChatMember[] }
  export interface AdminChatMemberUpdateRequest {
    role?: AdminChatMemberRole;
    status?: AdminChatMemberStatus;
    approveFirstPost?: boolean;
    reason?: string;
  }
  export interface AdminChatMessage {
    id: string;
    authorId: string | null;
    authorName: string;
    isAnonymous: boolean;
    body: string;
    status: "PUBLISHED" | "PENDING" | "REMOVED";
    isPinned: boolean;
    reportCount: number;
    removedReason: string | null;
    createdAt: string;
  }
  export interface AdminChatMessagesQuery { status?: "all" | "published" | "pending" | "removed" | "reported" }
  export interface AdminChatMessagesResponse { messages: AdminChatMessage[] }
  export interface AdminChatMessageActionRequest {
    action: "approve" | "remove" | "restore" | "pin" | "unpin";
    reason?: string;
  }

  /* ── live ───────────────────────────────────────────────── */
  export interface AdminStreamCategory { id: string; name: string; slug: string; emoji: string | null; color: string | null }
  export interface AdminStream {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    status: "IDLE" | "LIVE" | "ENDED";
    visibility: "PUBLIC" | "UNLISTED";
    ownerUserId: string | null;
    ownerName: string;
    ownerAvatar: string | null;
    startedAt: string | null;
    endedAt: string | null;
    viewerCount: number;
    viewerPeak: number;
    isMine: boolean; // always false for admin
    recording: boolean;
    category: AdminStreamCategory | null;
    countryId: string | null;
    createdAt: string;
    endedBy: "OWNER" | "ADMIN" | "LIMIT" | "STALE" | null;
    endReason: string | null;
    viewCount: number;
    path: string;
    ownerCanStream: boolean;
  }
  export interface AdminLiveListQuery { status?: "IDLE" | "LIVE" | "ENDED"; q?: string }
  export interface AdminLiveListResponse { streams: AdminStream[] }
  export interface AdminLiveEndRequest { reason?: string }
  export interface AdminLiveOwnerRequest { allowed: boolean }
  export interface AdminLiveOwnerResponse { ok: true; ended: number }

  /* ── notifications ──────────────────────────────────────── */
  export type AdminNotifType =
    | "USER_SIGNED_UP" | "USER_EMAIL_VERIFIED" | "USER_BANNED" | "USER_DELETED"
    | "POST_REPORTED" | "POST_REMOVED" | "CONFESSION_PENDING" | "EVENT_PENDING"
    | "PLACE_PENDING" | "PLACE_REPORTED" | "PETITION_PENDING" | "CAMPAIGN_PENDING";
  export interface AdminNotification {
    id: string;
    type: AdminNotifType;
    title: string;
    message: string | null;
    actionUrl: string | null;
    readAt: string | null;
    createdAt: string;
  }
  export interface AdminBellPayload { unread: number; items: AdminNotification[] }
  export interface AdminNotificationsReadRequest { ids?: string[]; all?: true }
  export interface AdminNotificationsReadResponse { updated: number }
  /** SSE: `event: bell` with data = AdminBellPayload; `: keep-alive` comments. */
  export type AdminNotificationStreamEvent = { event: "bell"; data: AdminBellPayload };

  /* ── settings ───────────────────────────────────────────── */
  export interface AdminGeneralSettings {
    "general.siteName"?: string;
    "general.tagline"?: string;
    "general.description"?: string;
    "general.textLogo"?: string;
    "general.svgLogo"?: string;
    "general.logoUrl"?: string;
    "general.faviconUrl"?: string;
    "general.supportEmail"?: string;
  }
  export interface AdminGeneralSettingsResponse { values: AdminGeneralSettings }
  export interface AdminSettingsSaveResponse { ok: true; updated: number }
  export interface AdminEmailSettings {
    "email.provider"?: string; // "resend"
    "email.resendApiKey"?: string; // masked on read
    "email.fromEmail"?: string;
    "email.fromName"?: string;
    "email.replyToEmail"?: string;
    "email.enabled"?: boolean;
  }
  export interface AdminEmailSettingsResponse { values: AdminEmailSettings; hasKey: boolean }
  export interface AdminStorageSettings {
    "storage.provider"?: string;
    "storage.localPath"?: string;
    "storage.publicBaseUrl"?: string;
    "storage.maxFileMB"?: number; // 1..1024
    "storage.maxVideoMB"?: number; // 1..bodyLimitMB
    "storage.maxVideoSeconds"?: number; // 0..86400 (0 = unlimited)
  }
  export interface AdminStorageSettingsResponse { values: AdminStorageSettings; bodyLimitMB: number }
  export interface AdminCacheSettings { "cache.enabled"?: boolean; "cache.defaultTtlSeconds"?: number }
  export interface AdminCacheStatus { enabled: boolean; ttlSeconds: number; warm: boolean; entries: number; ageSeconds: number | null }
  export interface AdminCacheSettingsResponse {
    values: AdminCacheSettings;
    stats: Array<{ name: string; description: string } & AdminCacheStatus>;
  }
  export interface AdminCacheSaveResponse { ok: true; updated: number; applied?: AdminCacheStatus }
  export interface AdminCachePurgeResponse { ok: true; purged: ["settings"] }
  export interface AdminStreamSettings {
    "stream.publicUrl"?: string;
    "stream.pathPrefix"?: string;
    "stream.apiUrl"?: string;
    "stream.apiUser"?: string;
    "stream.apiPass"?: string; // masked on read
    "stream.playbackUrl"?: string;
    "stream.allowedIps"?: string;
    "stream.defaultVisibility"?: "PUBLIC" | "UNLISTED";
    "stream.enabled"?: boolean;
    "stream.requireEmailVerified"?: boolean;
    "stream.autoRecord"?: boolean;
    "stream.maxDurationMin"?: number; // 5..1440
    "stream.maxConcurrentPerUser"?: number; // 1..10
    "stream.maxHeight"?: number; // 240..2160
    "stream.recordingRetentionDays"?: number; // 0..3650
  }
  export interface AdminStreamSettingsResponse { values: AdminStreamSettings; hasPass: boolean }
  export interface AdminStreamHealth {
    ok: boolean;
    configured: boolean;
    enabled: boolean;
    steps: Array<{ step: "host" | "api" | "prefix"; label: string; ok: boolean; detail: string | null }>;
    pathCount: number | null;
    sessionCount: number | null;
    checkedAt: string;
  }

  /* ── email templates ────────────────────────────────────── */
  export interface AdminEmailTemplateSummary {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    subject: string;
    enabled: boolean;
    updatedAt: string;
  }
  export interface AdminEmailTemplate extends AdminEmailTemplateSummary {
    previewText: string | null;
    htmlBody: string;
    textBody: string | null;
    variables: string[] | null;
    createdAt: string;
  }
  export interface AdminEmailTemplateListResponse { items: AdminEmailTemplateSummary[] }
  export interface AdminEmailTemplateItemResponse { item: AdminEmailTemplate }
  export interface AdminEmailTemplateCreateRequest {
    slug: string; // ^[a-z0-9_]+$
    name: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    previewText?: string;
    description?: string;
    variables?: string[];
  }
  export interface AdminEmailTemplateUpdateRequest {
    name?: string;
    subject?: string;
    htmlBody?: string;
    textBody?: string | null;
    previewText?: string | null;
    description?: string | null;
    variables?: string[];
    enabled?: boolean;
  }
  export interface AdminEmailTemplateTestRequest { to: string; variables?: Record<string, string> }
  export interface AdminEmailTemplateTestResponse { ok: true; status: "sent"; providerId?: string }
  export interface AdminEmailTemplateTestFailure { ok: false; status: "skipped" | "failed"; error?: string }

  /* ── money ──────────────────────────────────────────────── */
  export type AdminPayoutMethodType = "PAYPAL" | "BANK" | "WISE" | "CHECK";
  export interface AdminPaymentSettings {
    enabled: boolean;
    mode: "test" | "live";
    publishableKey: string;
    currency: string;
    creditRecipient: "net" | "gross";
    payoutFeeBasisPoints: number; // 0..10000
    payoutMinCents: number;
    payoutHoldDays: number;
    payoutMethods: string[];
    minDonationCents: number;
    maxDonationCents: number;
    secretKeyMasked: string | null;
    webhookSecretMasked: string | null;
    hasSecretKey: boolean;
    hasWebhookSecret: boolean;
  }
  export interface AdminPaymentSettingsResponse { settings: AdminPaymentSettings; encryptionReady: boolean }
  export interface AdminPaymentSettingsUpdateRequest {
    enabled?: boolean;
    mode?: "test" | "live";
    publishableKey?: string;
    creditRecipient?: "net" | "gross";
    payoutFeeBasisPoints?: number;
    payoutMinCents?: number;
    payoutHoldDays?: number;
    payoutMethods?: string[];
    minDonationCents?: number;
    maxDonationCents?: number;
    secretKey?: string; // blank = unchanged
    webhookSecret?: string; // blank = unchanged
  }
  export interface AdminPaymentTestRequest { secretKey?: string }
  export interface AdminPaymentTestResponse {
    ok: boolean;
    message: string;
    accountName?: string;
    accountId?: string;
    country?: string;
    defaultCurrency?: string;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    livemode?: boolean;
    modeMismatch?: boolean;
  }
  export type AdminPayoutStatus = "REQUESTED" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";
  export interface AdminPayout {
    id: string;
    userId: string;
    userNameSnapshot: string;
    userEmailSnapshot: string | null;
    amountCents: number;
    feeBasisPoints: number;
    feeCents: number;
    netCents: number;
    currency: string;
    methodId: string | null;
    methodSnapshot: { type: AdminPayoutMethodType; label: string | null; displayHint: string };
    status: AdminPayoutStatus;
    requestedAt: string;
    reviewedAt: string | null;
    paidAt: string | null;
    reviewedByAdminId: string | null;
    adminNote: string | null;
    rejectionReason: string | null;
    externalRef: string | null;
    createdAt: string;
    updatedAt: string;
  }
  export interface AdminPayoutTotalsEntry { count: number; amountCents: number; feeCents: number; netCents: number }
  export interface AdminPayoutListQuery { status?: "ALL" | AdminPayoutStatus; q?: string; take?: number }
  export interface AdminPayoutListResponse { payouts: AdminPayout[]; totals: Record<string, AdminPayoutTotalsEntry> }
  export interface AdminPayoutBalance {
    availableCents: number;
    onHoldCents: number;
    reservedCents: number;
    paidOutCents: number;
    lifetimeCents: number;
    currency: string;
  }
  export type AdminPayoutDetails =
    | { email: string }
    | { accountName: string; accountNumber: string; routingNumber: string; iban: string; swift: string; bankName: string; country: string }
    | { payeeName: string; line1: string; line2: string; city: string; state: string; postcode: string; country: string };
  export interface AdminPayoutDetailResponse {
    payout: AdminPayout;
    details: { type: AdminPayoutMethodType; details: AdminPayoutDetails } | null;
    balance: AdminPayoutBalance;
  }
  export interface AdminPayoutActionRequest {
    action: "approve" | "paid" | "reject" | "reverse";
    adminNote?: string;
    externalRef?: string; // paid only, max 160
    rejectionReason?: string; // required for reject + reverse
  }
  export type AdminDonationStatus = "PENDING" | "SUCCEEDED" | "REFUNDED" | "DISPUTED" | "FAILED";
  export interface AdminDonation {
    id: string;
    status: AdminDonationStatus;
    grossCents: number;
    netCents: number;
    stripeFeeCents: number;
    refundedCents: number;
    feeUnknown: boolean;
    currency: string;
    message: string | null;
    isAnonymous: boolean;
    donorName: string | null;
    donorEmail: string | null;
    donorUserId: string | null;
    recipientName: string | null;
    recipientUserId: string | null;
    causeTitle: string | null;
    eventId: string | null;
    campaignId: string | null;
    stripeSessionId: string | null;
    stripePaymentIntentId: string | null;
    createdAt: string;
    succeededAt: string | null;
    availableAt: string | null;
    disputedAt: string | null;
  }
  export interface AdminDonationTotals {
    byStatus: Record<string, { count: number; grossCents: number; netCents: number }>;
    collectedCents: number;
    stripeFeesCents: number;
    feeUnknownCount: number;
    strandedCount: number;
  }
  export interface AdminDonationListQuery { status?: "ALL" | AdminDonationStatus; q?: string; take?: number }
  export interface AdminDonationListResponse { donations: AdminDonation[]; totals: AdminDonationTotals }

  /* ── media ──────────────────────────────────────────────── */
  export interface AdminFfmpegCheck { id: string; label: string; state: "pass" | "fail" | "warn"; detail: string }
  export interface AdminFfmpegStatus {
    ready: boolean;
    ffmpegPath: string | null;
    ffprobePath: string | null;
    origin: "env" | "managed" | "path" | null;
    version: string | null;
    checks: AdminFfmpegCheck[];
    platform: { os: string; arch: string; node: string };
    installable: boolean;
    manualCommand: string;
    managedRoot: string;
    installedAt: string | null;
    archiveSha256: string | null;
    source: string | null;
    installing: boolean;
  }
  export interface AdminFfmpegInstallRequest { url?: string; expectedSha256?: string }
  export interface AdminFfmpegInstallResponse {
    ok: boolean;
    message: string;
    sha256?: string;
    ffmpegPath?: string;
    ffprobePath?: string;
    version?: string | null;
  }
  export interface AdminUploadResponse { ok: true; url: string }
  export interface AdminUploadFailure { ok: false; error: string }
  export interface AdminVideoUploadResponse { ok: true; id: string }
  export interface AdminVideoLimitsResponse { maxMB: number; maxSeconds: number }
  export interface AdminVideoStatus {
    id: string;
    status: "UPLOADING" | "QUEUED" | "PROCESSING" | "READY" | "FAILED";
    percent: number;
    etaSeconds: number | null;
    stage: string;
    message: string;
    url: string | null;
    posterUrl: string | null;
    width: number | null;
    height: number | null;
    durationSec: number | null;
    error: string | null;
  }
  export interface AdminVideoDiscardResponse { ok: boolean }

  /* ── translations ───────────────────────────────────────── */
  export interface AdminLocale {
    code: string;
    name: string;
    nativeName: string;
    direction: "LTR" | "RTL";
    isEnabled: boolean;
    sortOrder: number;
    translated: number;
    reviewed: number;
    stale: number;
  }
  export interface AdminTranslationKeyStatus {
    configured: boolean;
    source: "database" | "environment" | "none";
    hint: string | null;
    showPicker: boolean;
  }
  export interface AdminLocalesResponse extends AdminTranslationKeyStatus { locales: AdminLocale[]; totalStrings: number }
  export type AdminLocalesPostRequest =
    | { action: "sync" }
    | { action: "key"; apiKey: string }
    | { action: "picker"; on: boolean }
    | { code: string; isEnabled?: boolean; sortOrder?: number };
  export interface AdminLocalesSyncResponse { ok: true; added: number; total: number }
  export type AdminLocalesKeyResponse = { ok: true } & AdminTranslationKeyStatus;
  export interface AdminTranslationString {
    id: string;
    key: string;
    english: string;
    context: string | null;
    value: string | null;
    source: "GOOGLE" | "HUMAN" | null;
    reviewed: boolean;
    stale: boolean;
  }
  export interface AdminStringsQuery {
    locale: string;
    filter?: "all" | "missing" | "machine" | "reviewed" | "stale";
    q?: string;
    take?: number; // 1..200, default 50
    skip?: number;
  }
  export interface AdminStringsResponse { rows: AdminTranslationString[]; total: number }
  export interface AdminStringSaveRequest { stringId: string; locale: string; value?: string; action?: "review" }
  export interface AdminTranslateRequest { locale: string; includeStale?: boolean; limit?: number }
  export interface AdminTranslateResponse { ok: true; translated: number; skipped: number }
  export interface AdminExtractRequest { apply?: boolean; prune?: boolean }
  export interface AdminExtractResponse {
    ok: true;
    sourceAvailable: boolean;
    scannedFiles: number;
    serverFiles: number;
    calls: number;
    strings: number;
    characters: number;
    added: string[];
    changed: string[];
    removed: string[];
    collisions: Array<{ key: string; variants: Array<{ file: string; line: number; english: string }> }>;
    problems: Array<{ file: string; line: number; reason: string; excerpt: string }>;
    wrote: number;
    pruned: number;
    refused: string | null;
  }
  export interface AdminContentHealthQuery { probe?: string }
  export interface AdminContentHealth {
    tableReady: boolean;
    rows: number;
    byLocale: Array<{ locale: string; rows: number }>;
    byKind: Array<{ kind: string; rows: number }>;
    configured: boolean;
    probe: { ok: boolean; message: string } | null;
    error: string | null;
  }

}

// ════════════════════════════════════════════════════════════
// Admin: Content & Catalog Management
// ════════════════════════════════════════════════════════════

/** Admin: Content & Catalog Management. Use as AdminContent.TypeName — shared enums above are visible inside. */
export namespace AdminContent {
  // Admin: Content & Catalog Management — request/response types.
  // All dates are ISO 8601 strings. All endpoints require the admin cookie.

  export interface AdminContentError { error: string }
  export interface AdminContentOk { ok: true }

  /* ── Articles ─────────────────────────────────────────── */
  export type AdminArticleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
  export interface AdminArticleCategoryRef { id: string; name: string; slug: string }
  export interface AdminArticleListQuery { q?: string; status?: AdminArticleStatus | "ALL"; categoryId?: string; page?: number; perPage?: number }
  export interface AdminArticleListItem {
    id: string; slug: string; title: string; excerpt: string | null; coverUrl: string | null;
    status: AdminArticleStatus; isFeatured: boolean; publishedAt: string | null; readMinutes: number;
    viewCount: number; likeCount: number; commentCount: number; authorName: string;
    category: AdminArticleCategoryRef | null; createdAt: string; updatedAt: string;
  }
  export interface AdminArticleListResponse { articles: AdminArticleListItem[]; total: number; page: number; perPage: number; pageCount: number }
  export interface AdminCreateArticleRequest {
    title: string; body: string; excerpt?: string | null; coverUrl?: string | null; coverAlt?: string | null;
    videoUrl?: string | null; categoryId?: string | null; status?: AdminArticleStatus; isFeatured?: boolean;
  }
  export type AdminUpdateArticleRequest = Partial<AdminCreateArticleRequest>;
  export interface AdminCreateArticleResponse { ok: true; id: string; slug: string }
  export interface AdminGalleryImage { url: string; alt: string | null }
  export interface AdminArticle {
    id: string; slug: string; title: string; excerpt: string | null; body: string;
    coverUrl: string | null; coverAlt: string | null; photos: AdminGalleryImage[] | null; videoUrl: string | null;
    categoryId: string | null; status: AdminArticleStatus; isFeatured: boolean; featuredAt: string | null;
    publishedAt: string | null; readMinutes: number; authorAdminId: string | null; authorNameSnapshot: string;
    authorAvatarSnapshot: string | null; viewCount: number; likeCount: number; saveCount: number; commentCount: number;
    createdAt: string; updatedAt: string; category: AdminArticleCategoryRef | null;
  }
  export interface AdminArticleResponse { article: AdminArticle }

  export interface AdminArticleCategory {
    id: string; name: string; slug: string; description: string | null; emoji: string | null;
    color: string | null; sortOrder: number; articleCount: number;
  }
  export interface AdminArticleCategoriesResponse { categories: AdminArticleCategory[] }
  export interface AdminArticleCategoryRequest { name: string; description?: string | null; emoji?: string | null; color?: string | null; sortOrder?: number }
  export type AdminUpdateArticleCategoryRequest = Partial<AdminArticleCategoryRequest>;
  export interface AdminCreatedIdResponse { ok: true; id: string }

  /* ── Campaigns ────────────────────────────────────────── */
  export type AdminCampaignStatus = "PENDING" | "DRAFT" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
  export interface AdminCampaignListQuery { status?: AdminCampaignStatus | "ALL" }
  export interface AdminCampaignListItem {
    id: string; slug: string; title: string; summary: string | null; coverUrl: string | null; emoji: string | null;
    status: AdminCampaignStatus; startsAt: string | null; endsAt: string | null; supporterCount: number;
    updatedAt: string; createdAt: string; reviewNote: string | null; submittedByUserId: string | null;
    submitterNameSnapshot: string | null;
    category: { id: string; name: string; slug: string; emoji: string | null } | null;
    _count: { articles: number; events: number };
  }
  export interface AdminCampaignListResponse { campaigns: AdminCampaignListItem[] }
  export interface AdminCampaignWriteRequest {
    title: string; categoryId?: string | null; summary?: string | null; body?: string | null; coverUrl?: string | null;
    photos?: Array<{ url: string; alt?: string | null }> | null; emoji?: string | null; callToAction?: string | null;
    ctaUrl?: string | null; status?: AdminCampaignStatus; startsAt?: string | null; endsAt?: string | null;
    countryId?: string | null; chatRoomId?: string | null; petitionId?: string | null;
  }
  export type AdminCampaignUpdateRequest = Partial<AdminCampaignWriteRequest>;
  export interface AdminCampaignSaveResponse { ok: true; id: string; slug: string }
  export interface AdminCampaignDetail {
    id: string; slug: string; title: string; summary: string | null; body: string | null; coverUrl: string | null;
    photos: AdminGalleryImage[] | null; emoji: string | null; callToAction: string | null; ctaUrl: string | null;
    status: AdminCampaignStatus; publishedAt: string | null; startsAt: string | null; endsAt: string | null;
    countryId: string | null; categoryId: string | null; submittedByUserId: string | null;
    submitterNameSnapshot: string | null; submitterAvatarSnapshot: string | null; reviewNote: string | null;
    reviewedAt: string | null; reviewedByAdminId: string | null; chatRoomId: string | null; petitionId: string | null;
    supporterCount: number; createdByAdminId: string | null; createdAt: string; updatedAt: string;
    articles: Array<{ sortOrder: number; article: { id: string; title: string; slug: string; status: AdminArticleStatus; coverUrl: string | null } }>;
    events: Array<{ sortOrder: number; event: { id: string; title: string; slug: string; status: AdminEventStatus; startsAt: string; coverUrl: string | null } }>;
    room: { id: string; name: string; slug: string } | null;
  }
  export interface AdminCampaignDetailResponse { campaign: AdminCampaignDetail }
  export interface AdminCampaignReviewRequest { action: "approve" | "reject"; reason?: string; categoryId?: string | null }
  export interface AdminCampaignReviewResponse { ok: true; status: "PUBLISHED" | "REJECTED" }
  export type AdminCampaignAttachmentRequest =
    | { action: "attach" | "detach"; kind: "articles" | "events"; targetId: string }
    | { action: "reorder"; kind: "articles" | "events"; ids: string[] };
  export interface AdminAttachablesQuery { q?: string }
  export interface AdminAttachablesResponse {
    articles: Array<{ id: string; title: string; slug: string; status: AdminArticleStatus; coverUrl: string | null }>;
    events: Array<{ id: string; title: string; slug: string; status: AdminEventStatus; startsAt: string; coverUrl: string | null }>;
    rooms: Array<{ id: string; name: string; slug: string }>;
  }

  /* ── Events ───────────────────────────────────────────── */
  export type AdminEventStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  export interface AdminEventListQuery { status?: AdminEventStatus | "ALL"; q?: string; page?: number; perPage?: number }
  export interface AdminEventCategoryRef { id: string; name: string; slug: string; emoji: string | null; color: string | null }
  export interface AdminEventListItem {
    id: string; slug: string; title: string; summary: string | null; coverUrl: string | null; startsAt: string;
    endsAt: string | null; timezone: string; isOnline: boolean; venueName: string | null; city: string | null;
    countryId: string | null; capacity: number | null; rsvpCount: number; status: AdminEventStatus;
    hostNameSnapshot: string; hostAvatarSnapshot: string | null; category: AdminEventCategoryRef | null;
    rejectionReason: string | null; chatRoomId: string | null; createdAt: string;
  }
  export interface AdminEventListResponse { events: AdminEventListItem[]; total: number; pendingCount: number; page: number; perPage: number; pageCount: number }
  export interface AdminEventWriteRequest {
    title: string; description: string; summary?: string | null; coverUrl?: string | null; startsAt: string;
    endsAt?: string | null; timezone?: string | null; isOnline?: boolean; joinUrl?: string | null; venueName?: string | null;
    addressLine?: string | null; city?: string | null; countryId?: string | null; capacity?: number | null;
    photos?: Array<{ url: string; alt?: string }> | null; categoryId?: string | null;
  }
  export type AdminEventUpdateRequest = Partial<AdminEventWriteRequest>;
  export interface AdminEventCreateResponse { ok: true; id: string; slug: string }
  export interface AdminEvent {
    id: string; slug: string; title: string; summary: string | null; description: string; coverUrl: string | null;
    photos: Array<{ url: string; alt?: string }> | null; startsAt: string; endsAt: string | null; timezone: string;
    isOnline: boolean; joinUrl: string | null; venueName: string | null; addressLine: string | null; city: string | null;
    countryId: string | null; categoryId: string | null; capacity: number | null; status: AdminEventStatus;
    rejectionReason: string | null; reviewedAt: string | null; reviewedBy: string | null; hostUserId: string | null;
    hostNameSnapshot: string; hostAvatarSnapshot: string | null; createdByAdminId: string | null;
    chatRoomId: string | null; rsvpCount: number; createdAt: string; updatedAt: string;
  }
  export interface AdminEventResponse { event: AdminEvent }
  export interface AdminEventReviewRequest { action: "approve" | "reject" | "cancel"; reason?: string }
  export type AdminEventReviewResponse =
    | { ok: true; status: "APPROVED" | "REJECTED" }
    | { ok: true; cancelled: number };

  export interface AdminEventCategory {
    id: string; name: string; slug: string; description: string | null; emoji: string | null; color: string | null;
    sortOrder: number; isActive: boolean; eventCount: number; upcomingCount: number;
  }
  export interface AdminEventCategoriesResponse { categories: AdminEventCategory[] }
  export interface AdminTaxonomyCategoryRequest {
    name: string; description?: string | null; emoji?: string | null; color?: string | null; sortOrder?: number; isActive?: boolean;
  }
  export type AdminTaxonomyCategoryUpdateRequest = Partial<AdminTaxonomyCategoryRequest>;

  /* ── Petitions ────────────────────────────────────────── */
  export type AdminPetitionStatus = "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";
  export interface AdminPetitionListQuery { status?: AdminPetitionStatus | "ALL"; q?: string }
  export interface AdminPetitionListItem {
    id: string; slug: string; title: string; target: string; status: AdminPetitionStatus; signatureCount: number;
    goal: number | null; creatorUserId: string | null; creatorNameSnapshot: string; createdAt: string; reviewedAt: string | null;
  }
  export interface AdminPetitionListResponse { petitions: AdminPetitionListItem[] }
  export interface AdminPetition {
    id: string; slug: string; title: string; summary: string | null; body: string; coverUrl: string | null;
    photos: AdminGalleryImage[] | null; video: { assetId: string; url: string; posterUrl: string | null; width: number | null; height: number | null; durationSec: number | null } | null;
    target: string; goal: number | null; countryId: string | null; categoryId: string | null; status: AdminPetitionStatus;
    rejectionReason: string | null; reviewedAt: string | null; reviewedBy: string | null; closesAt: string | null;
    creatorUserId: string | null; creatorNameSnapshot: string; creatorAvatarSnapshot: string | null;
    createdByAdminId: string | null; signatureCount: number; reactionCount: number; createdAt: string; updatedAt: string;
  }
  export interface AdminPetitionResponse { petition: AdminPetition }
  export interface AdminPetitionReviewRequest { action: "approve" | "reject" | "close"; reason?: string }
  export interface AdminPetitionReviewResponse { ok: true; status: "APPROVED" | "REJECTED" | "CLOSED" }

  /* ── Places ───────────────────────────────────────────── */
  export type AdminPlaceStatus = "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";
  export type AdminPlaceType =
    | "RECOVERY_PROGRAM" | "CLINIC" | "COUNSELLING" | "CHURCH" | "FOOD_BANK" | "ANIMAL_SHELTER"
    | "SHELTER" | "COMMUNITY_CENTRE" | "DONATING_BUSINESS" | "OTHER";
  export interface AdminPlaceHour { day: number; opens?: string; closes?: string; closed?: boolean }
  export interface AdminPlaceListQuery { status?: AdminPlaceStatus | "ALL"; type?: AdminPlaceType | "ALL"; q?: string; page?: number; perPage?: number }
  export interface AdminPlaceListItem {
    id: string; slug: string; name: string; type: AdminPlaceType; status: AdminPlaceStatus; city: string | null;
    addressLine: string | null; latitude: number | null; longitude: number | null; geocodeError: string | null;
    isDonor: boolean; coverUrl: string | null; saveCount: number; submitterSnapshot: string | null; updatedAt: string;
  }
  export interface AdminPlaceListResponse { items: AdminPlaceListItem[]; total: number; page: number; perPage: number; pageCount: number; pending: number }
  export interface AdminPlaceWriteRequest {
    name: string; type?: AdminPlaceType; summary?: string | null; about?: string | null; addressLine?: string | null;
    city?: string | null; postcode?: string | null; countryId?: string | null; stateId?: string | null;
    latitude?: number | null; longitude?: number | null; phone?: string | null; email?: string | null; website?: string | null;
    hours?: AdminPlaceHour[] | null; needs?: string | null; coverUrl?: string | null;
    photos?: Array<{ url: string; alt?: string | null }> | null; isDonor?: boolean; status?: AdminPlaceStatus;
  }
  export type AdminPlaceUpdateRequest = Partial<AdminPlaceWriteRequest>;
  export interface AdminPlaceSaveResponse { ok: true; id: string; slug: string; status: AdminPlaceStatus }
  export interface AdminPlace {
    id: string; slug: string; name: string; type: AdminPlaceType; summary: string | null; about: string | null;
    addressLine: string | null; city: string | null; postcode: string | null; countryId: string | null; stateId: string | null;
    latitude: number | null; longitude: number | null; geocodedAt: string | null; geocodeError: string | null;
    phone: string | null; email: string | null; website: string | null; hours: AdminPlaceHour[] | null; needs: string | null;
    coverUrl: string | null; photos: AdminGalleryImage[] | null; isDonor: boolean; status: AdminPlaceStatus;
    reviewNote: string | null; reviewedAt: string | null; reviewedByAdminId: string | null; submittedByUserId: string | null;
    submitterSnapshot: string | null; chatRoomId: string | null; saveCount: number; viewCount: number; createdAt: string; updatedAt: string;
  }
  export interface AdminPlaceResponse { place: AdminPlace }
  export interface AdminPlaceGeocodeResponse {
    ok: boolean; latitude: number | null; longitude: number | null; geocodedAt: string | null; geocodeError: string | null;
  }
  export interface AdminPlaceReviewRequest { action: "approve" | "reject"; note?: string }
  export interface AdminPlaceReviewResponse { status: "APPROVED" | "REJECTED" }
  export type AdminPlaceReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";
  export type AdminPlaceReportKind = "CLOSED_DOWN" | "MOVED" | "WRONG_DETAILS" | "DUPLICATE" | "NOT_APPROPRIATE" | "OTHER";
  export interface AdminPlaceReportsQuery { status?: AdminPlaceReportStatus | "ALL" }
  export interface AdminPlaceReport {
    id: string; kind: AdminPlaceReportKind; notes: string | null; status: AdminPlaceReportStatus; reporterSnapshot: string | null;
    createdAt: string; resolvedAt: string | null; resolution: string | null;
    place: { id: string; slug: string; name: string; city: string | null; status: AdminPlaceStatus };
  }
  export interface AdminPlaceReportsResponse { reports: AdminPlaceReport[]; open: number }
  export interface AdminPlaceReportActionRequest { action: "resolve" | "dismiss"; resolution?: string }
  export interface AdminPlaceReportActionResponse { status: "RESOLVED" | "DISMISSED" }

  /* ── Geography ────────────────────────────────────────── */
  export interface AdminGeographyStats {
    regions: { total: number; active: number }; subRegions: { total: number; active: number };
    countries: { total: number; active: number }; states: { total: number; active: number };
  }
  export type AdminGeographyOptionsLevel = "regions" | "sub-regions" | "countries";
  export interface AdminGeographyOptionsQuery { level: AdminGeographyOptionsLevel; regionId?: string }
  export type AdminGeographyOptionsResponse =
    | { items: Array<{ id: string; name: string; slug: string }> }
    | { items: Array<{ id: string; name: string; regionId: string; regionName: string }> }
    | { items: Array<{ id: string; name: string; code: string }> };
  export type AdminGeoActiveFilter = "all" | "active" | "inactive";
  export interface AdminRegion {
    id: string; slug: string; name: string; code: string; sortOrder: number; isActive: boolean;
    subRegionCount: number; countryCount: number; createdAt: string; updatedAt: string;
  }
  export interface AdminRegionsResponse { items: AdminRegion[] }
  export interface AdminRegionRequest { name: string; code: string; slug?: string; sortOrder?: number; isActive?: boolean }
  export type AdminRegionUpdateRequest = Partial<AdminRegionRequest>;
  export interface AdminSubRegion {
    id: string; slug: string; name: string; code: string; regionId: string; regionName: string; regionSlug: string;
    sortOrder: number; isActive: boolean; countryCount: number; createdAt: string; updatedAt: string;
  }
  export interface AdminSubRegionsQuery { q?: string; regionId?: string }
  export interface AdminSubRegionsResponse { items: AdminSubRegion[] }
  export interface AdminSubRegionRequest { regionId: string; name: string; code: string; slug?: string; sortOrder?: number; isActive?: boolean }
  export type AdminSubRegionUpdateRequest = Partial<AdminSubRegionRequest>;
  export interface AdminCountry {
    id: string; slug: string; name: string; code: string; code3: string | null; numericCode: string | null;
    flagUrl: string | null; emojiFlag: string | null; phoneCode: string | null; currency: string | null; language: string | null;
    subRegionId: string; subRegionName: string; subRegionSlug: string; regionId: string; regionName: string; regionSlug: string;
    sortOrder: number; isActive: boolean; stateCount: number; createdAt: string; updatedAt: string;
  }
  export interface AdminCountriesQuery { q?: string; regionId?: string; subRegionId?: string; status?: AdminGeoActiveFilter; page?: number; perPage?: number }
  export interface AdminCountriesResponse { items: AdminCountry[]; total: number; page: number; perPage: number; totalPages: number }
  export interface AdminCountryResponse { item: AdminCountry }
  export interface AdminCountryRequest {
    subRegionId: string; name: string; code: string; slug?: string; code3?: string; numericCode?: string; flagUrl?: string;
    emojiFlag?: string; phoneCode?: string; currency?: string; language?: string; sortOrder?: number; isActive?: boolean;
  }
  export type AdminCountryUpdateRequest = Partial<AdminCountryRequest>;
  export interface AdminState {
    id: string; slug: string; name: string; code: string; capital: string | null; countryId: string; countryName: string;
    countryCode: string; countrySlug: string; sortOrder: number; isActive: boolean; createdAt: string; updatedAt: string;
  }
  export interface AdminStatesQuery { q?: string; countryId?: string; status?: AdminGeoActiveFilter }
  export interface AdminStatesResponse { items: AdminState[]; countryId: string | null }
  export interface AdminStateRequest { countryId?: string; name: string; code: string; slug?: string; capital?: string; sortOrder?: number; isActive?: boolean }
  export type AdminStateUpdateRequest = Partial<AdminStateRequest>;

  /* ── Gratitude ────────────────────────────────────────── */
  export type AdminGratitudeStatus = "PENDING" | "APPROVED" | "REJECTED";
  export interface AdminGratitudeQuery { status?: AdminGratitudeStatus | "ALL"; cursor?: string }
  export interface AdminGratitudeItem {
    id: string; authorId: string; authorName: string; authorAvatar: string | null; isAnonymous: boolean; body: string;
    imageUrl: string | null;
    video: { assetId: string; url: string; posterUrl: string | null; width: number | null; height: number | null; durationSec: number | null } | null;
    status: AdminGratitudeStatus; rejectionReason: string | null; heartCount: number; createdAt: string; reviewedAt: string | null;
  }
  export interface AdminGratitudeListResponse { items: AdminGratitudeItem[]; nextCursor: string | null; pendingCount: number }
  export interface AdminGratitudeModerateRequest { action: "approve" | "reject"; reason?: string }
  export interface AdminGratitudeModerateResponse { item: AdminGratitudeItem }
  export interface AdminGratitudeCategory {
    id: string; name: string; slug: string; description: string | null; emoji: string | null; sortOrder: number; isActive: boolean; count: number;
  }
  export interface AdminGratitudeCategoriesResponse { categories: AdminGratitudeCategory[] }
  export interface AdminGratitudeCategoryRequest { name: string; description?: string | null; emoji?: string | null; sortOrder?: number }
  export interface AdminGratitudeCategoryUpdateRequest { name?: string; description?: string | null; emoji?: string | null; sortOrder?: number; isActive?: boolean }
  export interface AdminGratitudeCategoryCreateResponse { ok: true; id: string; slug: string }
  export interface AdminGratitudeCategoryDeleteResponse { ok: true; orphaned: number }

  /* ── Town Heroes ──────────────────────────────────────── */
  export type AdminTownHeroStatus = "PENDING" | "APPROVED" | "REJECTED";
  export interface AdminTownHeroQuery { status?: AdminTownHeroStatus | "ALL"; q?: string }
  export interface AdminTownHero {
    id: string; slug: string; heroName: string; town: string | null; countryId: string | null; photoUrl: string | null;
    photoAlt: string; summary: string | null;
    category: { id: string; name: string; slug: string; emoji: string | null; color: string | null };
    body: string; nominatorName: string | null; nominatorRealName: string | null; nominatedByUserId: string | null;
    isAnonymous: boolean; status: AdminTownHeroStatus; rejectionReason: string | null; heartCount: number;
    isFeatured: boolean; approvedAt: string | null; reviewedAt: string | null; createdAt: string;
  }
  export interface AdminTownHeroListResponse { heroes: AdminTownHero[]; pendingCount: number }
  export interface AdminTownHeroReviewRequest { action: "approve" | "reject"; reason?: string }
  export interface AdminTownHeroReviewResponse { status: "APPROVED" | "REJECTED" }
  export interface AdminTownHeroUpdateRequest {
    heroName?: string; town?: string; countryId?: string; photoUrl?: string; photoAlt?: string; summary?: string; body?: string; isFeatured?: boolean;
  }
  export interface AdminTownHeroCategory {
    id: string; name: string; slug: string; description: string | null; emoji: string | null; color: string | null;
    sortOrder: number; isActive: boolean; heroCount: number; publicCount: number;
  }
  export interface AdminTownHeroCategoriesResponse { categories: AdminTownHeroCategory[] }
  export interface AdminTownHeroCategoryRequest { name: string; description?: string; emoji?: string; color?: string; sortOrder?: number }
  export interface AdminTownHeroCategoryUpdateRequest { name?: string; description?: string; emoji?: string; color?: string; sortOrder?: number; isActive?: boolean }
  export interface AdminTownHeroCategoryCreateResponse { id: string }

  /* ── Library ──────────────────────────────────────────── */
  export interface AdminLibraryThemeListItem {
    id: string; slug: string; name: string; tagline: string | null; coverUrl: string | null; emoji: string | null;
    isActive: boolean; sortOrder: number; followerCount: number; clipCount: number; updatedAt: string;
  }
  export interface AdminLibraryThemesResponse { themes: AdminLibraryThemeListItem[] }
  export interface AdminLibraryTheme {
    id: string; slug: string; name: string; tagline: string | null; about: string | null; coverUrl: string | null;
    emoji: string | null; isActive: boolean; sortOrder: number; followerCount: number; clipCount: number; createdAt: string; updatedAt: string;
  }
  export type AdminClipKind = "EMBED" | "UPLOAD";
  export interface AdminClip {
    id: string; title: string; caption: string | null; kind: AdminClipKind; embedUrl: string | null; videoUrl: string | null;
    posterUrl: string | null; width: number | null; height: number | null; durationSec: number | null; isPublished: boolean;
    sortOrder: number; likeCount: number; saveCount: number; viewCount: number; commentCount: number; createdAt: string;
  }
  export interface AdminLibraryThemeResponse { theme: AdminLibraryTheme; clips: AdminClip[] }
  export interface AdminLibraryThemeRequest {
    name: string; tagline?: string | null; about?: string | null; coverUrl?: string | null; emoji?: string | null; isActive?: boolean; sortOrder?: number | null;
  }
  export type AdminLibraryThemeUpdateRequest = Partial<AdminLibraryThemeRequest>;
  export interface AdminLibraryThemeSaveResponse { ok: true; id: string; slug: string }
  export interface AdminClipRequest {
    themeId: string; title: string; caption?: string | null; kind: AdminClipKind; embedUrl?: string | null;
    videoAssetId?: string | null; isPublished?: boolean; sortOrder?: number | null;
  }
  export type AdminClipUpdateRequest = Partial<Omit<AdminClipRequest, "themeId">>;
  export interface AdminClipCreateResponse { ok: true; id: string }
  export interface AdminClipUpdateResponse { ok: true; id: string; themeId: string }
  export interface AdminLibraryReorderRequest { themeId?: string; ids: string[] }
  export type AdminClipCommentStatus = "PUBLISHED" | "REMOVED";
  export interface AdminClipComment {
    id: string; parentId: string | null; authorId: string | null; authorName: string; body: string; isAnonymous: boolean;
    status: AdminClipCommentStatus; removedReason: string | null; likeCount: number; createdAt: string;
  }
  export interface AdminClipCommentsResponse { comments: AdminClipComment[] }
  export interface AdminClipCommentActionRequest { action: "remove" | "restore"; reason?: string }
  export interface AdminClipCommentActionResponse { ok: true; status: AdminClipCommentStatus; commentCount: number }

  /* ── Live categories ──────────────────────────────────── */
  export interface AdminLiveCategory {
    id: string; name: string; slug: string; description: string | null; emoji: string | null; color: string | null;
    sortOrder: number; isActive: boolean; streamCount: number; liveCount: number;
  }
  export interface AdminLiveCategoriesResponse { categories: AdminLiveCategory[] }

  /* ── Daily reflections ────────────────────────────────── */
  export interface AdminDailyQuote { id: string; body: string; attribution: string | null; displayDate: string; isActive: boolean; createdAt: string; updatedAt: string }
  export interface AdminDailyQuestion { id: string; body: string; displayDate: string; isActive: boolean; createdAt: string; updatedAt: string; _count: { reflections: number } }
  export interface AdminDailyReflectionsResponse { quotes: AdminDailyQuote[]; questions: AdminDailyQuestion[] }
  export interface AdminDailyReflectionCreateRequest { kind: "quote" | "question"; body: string; displayDate: string; attribution?: string; isActive?: boolean }
  export interface AdminDailyReflectionUpdateRequest extends AdminDailyReflectionCreateRequest { id: string }
  export interface AdminDailyReflectionDeleteRequest { kind: "quote" | "question"; id: string }
  export interface AdminDailyReflectionItemResponse { item: AdminDailyQuote | Omit<AdminDailyQuestion, "_count"> }

}

