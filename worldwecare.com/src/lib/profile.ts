/**
 * Profile reads/writes. Self profile (with private bits) + a public
 * read-only view for /u/[id]. Framed around a member's "journey"
 * rather than vanity metrics — fits the support-community tone.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getFollowCounts } from "./follows";

export interface MyProfile {
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

export async function getMyProfile(userId: string): Promise<MyProfile | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, displayName: true, email: true, avatarUrl: true,
      coverUrl: true, bio: true, location: true, emailVerifiedAt: true, createdAt: true,
    },
  });
  if (!u) return null;
  return {
    id: u.id,
    displayName: u.displayName,
    email: u.email,
    avatarUrl: u.avatarUrl,
    coverUrl: u.coverUrl,
    bio: u.bio,
    location: u.location,
    emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function updateMyProfile(
  userId: string,
  input: { displayName?: string; bio?: string | null; location?: string | null; avatarUrl?: string | null; coverUrl?: string | null },
): Promise<void> {
  const data: Prisma.UserUpdateInput = {};
  if (typeof input.displayName === "string") {
    const name = input.displayName.trim();
    if (!name) throw new Error("Name can't be empty.");
    if (name.length > 60) throw new Error("Name is too long.");
    data.displayName = name;
  }
  if (input.bio !== undefined) {
    const bio = (input.bio ?? "").trim();
    if (bio.length > 600) throw new Error("Bio is too long (max 600).");
    data.bio = bio || null;
  }
  if (input.location !== undefined) {
    const loc = (input.location ?? "").trim();
    if (loc.length > 100) throw new Error("Location is too long.");
    data.location = loc || null;
  }
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl || null;
  if (input.coverUrl !== undefined) data.coverUrl = input.coverUrl || null;
  await prisma.user.update({ where: { id: userId }, data });
}

export interface JourneyStats {
  posts: number;
  replies: number;
  rooms: number;
  saved: number;
  followers: number;
  following: number;
  memberSince: string;
}

export async function getJourneyStats(userId: string): Promise<JourneyStats | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!u) return null;
  const [posts, replies, rooms, saved, follows] = await Promise.all([
    prisma.post.count({ where: { authorId: userId, status: "PUBLISHED" } }),
    prisma.postComment.count({ where: { authorId: userId, status: "PUBLISHED" } }),
    prisma.chatMembership.count({ where: { userId, status: "ACTIVE" } }),
    prisma.postSave.count({ where: { userId } }),
    getFollowCounts(userId),
  ]);
  return {
    posts, replies, rooms, saved,
    followers: follows.followers, following: follows.following,
    memberSince: u.createdAt.toISOString(),
  };
}

export interface PublicProfile {
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

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, displayName: true, avatarUrl: true, coverUrl: true,
      bio: true, location: true, createdAt: true, isActive: true, bannedAt: true,
    },
  });
  if (!u || !u.isActive || u.bannedAt) return null;
  const [postCount, roomCount, follows] = await Promise.all([
    prisma.post.count({ where: { authorId: userId, status: "PUBLISHED", isAnonymous: false } }),
    prisma.chatMembership.count({ where: { userId, status: "ACTIVE" } }),
    getFollowCounts(userId),
  ]);
  return {
    id: u.id,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    coverUrl: u.coverUrl,
    bio: u.bio,
    location: u.location,
    createdAt: u.createdAt.toISOString(),
    postCount,
    roomCount,
    followerCount: follows.followers,
    followingCount: follows.following,
  };
}
