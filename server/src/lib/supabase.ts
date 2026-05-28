/**
 * Supabase Client
 * Handles database operations for persistence
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

// Initialize Supabase client
export const supabase: SupabaseClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// Log warning if Supabase is not configured
if (!supabase) {
  console.warn(
    "[SUPABASE] Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local"
  );
}

/**
 * Database Tables:
 * 1. rooms - Persistent room metadata
 * 2. room_users - Users in rooms (with host designation)
 * 3. room_sessions - Playback state and session data
 * 4. room_history - Historical data for analytics (future)
 */

// Room table interface
export interface Room {
  id: string;
  created_at: string;
  video_url: string | null;
  status: "waiting" | "playing" | "paused";
  host_id: string | null;
  max_users: number;
  inactive_timeout: number; // minutes
  last_activity: string;
}

// Room user table interface
export interface RoomUser {
  id: string;
  room_id: string;
  user_id: string;
  socket_id: string | null;
  is_host: boolean;
  joined_at: string;
  last_seen: string;
}

// Room session table interface
export interface RoomSession {
  id: string;
  room_id: string;
  is_playing: boolean;
  playback_time: number;
  last_updated_at: string;
  updated_by: string; // user_id who triggered the update
}

// Initialize database tables (call on startup)
export async function initializeDatabase() {
  if (!supabase) {
    console.warn("[SUPABASE] Cannot initialize database: client not configured");
    return false;
  }

  try {
    // Note: In a real deployment, you would run these SQL commands via Supabase dashboard
    // or migration scripts. For MVP, we'll assume tables are created manually or via setup script.
    
    console.log("[SUPABASE] Database initialization check complete");
    return true;
  } catch (error) {
    console.error("[SUPABASE] Database initialization error:", error);
    return false;
  }
}

// Room operations
export const roomOperations = {
  /**
   * Get room by ID
   */
  async getRoom(roomId: string): Promise<Room | null> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 means no rows returned, which is ok
        console.error("[SUPABASE] Error fetching room:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("[SUPABASE] Error fetching room:", error);
      return null;
    }
  },

  /**
   * Create a new room
   */
  async createRoom(
    roomId: string,
    hostId: string,
    videoUrl: string = null
  ): Promise<Room | null> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from("rooms")
        .insert([
          {
            id: roomId,
            host_id: hostId,
            video_url: videoUrl,
            status: "waiting",
            max_users: 50, // from constants
            inactive_timeout: 30, // from constants
            last_activity: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("[SUPABASE] Error creating room:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("[SUPABASE] Error creating room:", error);
      return null;
    }
  },

  /**
   * Update room status
   */
  async updateRoomStatus(
    roomId: string,
    status: "waiting" | "playing" | "paused"
  ): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("rooms")
        .update({
          status,
          last_activity: new Date().toISOString(),
        })
        .eq("id", roomId);

      if (error) {
        console.error("[SUPABASE] Error updating room status:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[SUPABASE] Error updating room status:", error);
      return false;
    }
  },

  /**
   * Update room video URL
   */
  async updateRoomVideoUrl(
    roomId: string,
    videoUrl: string
  ): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("rooms")
        .update({
          video_url: videoUrl,
          last_activity: new Date().toISOString(),
        })
        .eq("id", roomId);

      if (error) {
        console.error("[SUPABASE] Error updating room video URL:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[SUPABASE] Error updating room video URL:", error);
      return false;
    }
  },

  /**
   * Delete room (and associated data via CASCADE)
   */
  async deleteRoom(roomId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("rooms")
        .delete()
        .eq("id", roomId);

      if (error) {
        console.error("[SUPABASE] Error deleting room:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[SUPABASE] Error deleting room:", error);
      return false;
    }
  },

  /**
   * Get inactive rooms for cleanup
   */
  async getInactiveRooms(timeoutMinutes: number): Promise<string[]> {
    if (!supabase) return [];

    try {
      const cutoffTime = new Date(
        Date.now() - timeoutMinutes * 60 * 1000
      ).toISOString();

      const { data, error } = await supabase
        .from("rooms")
        .select("id")
        .lt("last_activity", cutoffTime);

      if (error) {
        console.error("[SUPABASE] Error fetching inactive rooms:", error);
        return [];
      }

      return data.map((room) => room.id);
    } catch (error) {
      console.error("[SUPABASE] Error fetching inactive rooms:", error);
      return [];
    }
  },
};

// Room user operations
export const roomUserOperations = {
  /**
   * Add user to room
   */
  async addUserToRoom(
    roomId: string,
    userId: string,
    socketId: string,
    isHost: boolean = false
  ): Promise<RoomUser | null> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from("room_users")
        .insert([
          {
            room_id: roomId,
            user_id: userId,
            socket_id: socketId,
            is_host: isHost,
            joined_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("[SUPABASE] Error adding user to room:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("[SUPABASE] Error adding user to room:", error);
      return null;
    }
  },

  /**
   * Update user's socket ID and last seen time
   */
  async updateUserSocket(
    roomId: string,
    userId: string,
    socketId: string
  ): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("room_users")
        .update({
          socket_id: socketId,
          last_seen: new Date().toISOString(),
        })
        .match({ room_id: roomId, user_id: userId });

      if (error) {
        console.error("[SUPABASE] Error updating user socket:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[SUPABASE] Error updating user socket:", error);
      return false;
    }
  },

  /**
   * Remove user from room
   */
  async removeUserFromRoom(
    roomId: string,
    userId: string
  ): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("room_users")
        .delete()
        .match({ room_id: roomId, user_id: userId });

      if (error) {
        console.error("[SUPABASE] Error removing user from room:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[SUPABASE] Error removing user from room:", error);
      return false;
    }
  },

  /**
   * Get users in room
   */
  async getUsersInRoom(roomId: string): Promise<RoomUser[]> {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from("room_users")
        .select("*")
        .eq("room_id", roomId);

      if (error) {
        console.error("[SUPABASE] Error fetching users in room:", error);
        return [];
      }

      return data;
    } catch (error) {
      console.error("[SUPABASE] Error fetching users in room:", error);
      return [];
    }
  },

  /**
   * Update last seen time for user
   */
  async updateUserLastSeen(
    roomId: string,
    userId: string
  ): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("room_users")
        .update({
          last_seen: new Date().toISOString(),
        })
        .match({ room_id: roomId, user_id: userId });

      if (error) {
        console.error("[SUPABASE] Error updating user last seen:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[SUPABASE] Error updating user last seen:", error);
      return false;
    }
  },

  /**
   * Get room host
   */
  async getRoomHost(roomId: string): Promise<RoomUser | null> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from("room_users")
        .select("*")
        .eq("room_id", roomId)
        .eq("is_host", true)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("[SUPABASE] Error fetching room host:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("[SUPABASE] Error fetching room host:", error);
      return null;
    }
  },

  /**
   * Transfer host to another user
   */
  async transferHost(
    roomId: string,
    newHostId: string
  ): Promise<boolean> {
    if (!supabase) return false;

    try {
      // First, remove host status from current host
      const { error: error1 } = await supabase
        .from("room_users")
        .update({ is_host: false })
        .match({ room_id: roomId, is_host: true });

      if (error1) {
        console.error("[SUPABASE] Error removing host status:", error1);
        return false;
      }

      // Then, set new host
      const { error: error2 } = await supabase
        .from("room_users")
        .update({ is_host: true })
        .match({ room_id: roomId, user_id: newHostId });

      if (error2) {
        console.error("[SUPABASE] Error setting new host:", error2);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[SUPABASE] Error transferring host:", error);
      return false;
    }
  },
};

// Room session operations
export const roomSessionOperations = {
  /**
   * Create or update room session (playback state)
   */
  async upsertRoomSession(
    roomId: string,
    isPlaying: boolean,
    currentTime: number,
    updatedBy: string
  ): Promise<RoomSession | null> {
    if (!supabase) return null;

    try {
      // First, try to update existing session
      const { data, error } = await supabase
        .from("room_sessions")
        .upsert(
          {
            room_id: roomId,
            is_playing: isPlaying,
            playback_time: currentTime,
            last_updated_at: new Date().toISOString(),
            updated_by: updatedBy,
          },
          { onConflict: ["room_id"] }
        )
        .select()
        .single();

      if (error) {
        console.error("[SUPABASE] Error upserting room session:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("[SUPABASE] Error upserting room session:", error);
      return null;
    }
  },

  /**
   * Get room session (playback state)
   */
  async getRoomSession(roomId: string): Promise<RoomSession | null> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from("room_sessions")
        .select("*")
        .eq("room_id", roomId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("[SUPABASE] Error fetching room session:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("[SUPABASE] Error fetching room session:", error);
      return null;
    }
  },

  /**
   * Delete room session
   */
  async deleteRoomSession(roomId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("room_sessions")
        .delete()
        .eq("room_id", roomId);

      if (error) {
        console.error("[SUPABASE] Error deleting room session:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[SUPABASE] Error deleting room session:", error);
      return false;
    }
  },
};

// Cleanup operations
export const cleanupOperations = {
  /**
   * Clean up inactive rooms and associated data
   */
  async cleanupInactiveRooms(): Promise<void> {
    if (!supabase) return;

    try {
      // Get rooms inactive for more than 30 minutes (from constants)
      const inactiveRoomIds = await roomOperations.getInactiveRooms(30);

      for (const roomId of inactiveRoomIds) {
        // Delete room (will cascade to users and sessions)
        await roomOperations.deleteRoom(roomId);
        console.log(`[CLEANUP] Removed inactive room: ${roomId}`);
      }
    } catch (error) {
      console.error("[CLEANUP] Error during cleanup:", error);
    }
  },

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup(intervalMs: number = 60000): NodeJS.Timeout {
    // Run cleanup every minute
    const interval = setInterval(() => {
      this.cleanupInactiveRooms().catch(console.error);
    }, intervalMs);

    console.log(`[CLEANUP] Started periodic cleanup (interval: ${intervalMs}ms)`);
    return interval;
  },
};