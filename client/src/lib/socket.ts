/**
 * Frontend Socket.IO Client
 * Singleton pattern with eager initialization
 */

import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

class SocketClient {
  private socket: Socket;
  private isConnected = false;
  private eventQueue: Array<{ event: string; data: any }> = [];

  constructor() {
    // Initialize socket immediately (but don't connect yet)
    this.socket = io(WS_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      transports: ["websocket", "polling"],
      autoConnect: false, // Don't connect until connect() is called
    });

    this.socket.on("connect", () => {
      console.log("[SOCKET] Connected:", this.socket.id);
      this.isConnected = true;
      this.flushEventQueue();
    });

    this.socket.on("disconnect", () => {
      console.log("[SOCKET] Disconnected");
      this.isConnected = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error("[SOCKET] Connection error:", error.message);
    });
  }

  /**
   * Connect to server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      // If already connecting, wait for connect event
      if (this.socket.active) {
        this.socket.once("connect", () => resolve());
        return;
      }

      this.socket.connect();

      this.socket.once("connect", () => resolve());

      // Timeout
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error("Socket connection timeout"));
        }
      }, 10000);
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.socket.disconnect();
    this.isConnected = false;
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get socket ID
   */
  getId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Emit event to server
   */
  emit(event: string, data: any): void {
    if (!this.isConnected) {
      this.eventQueue.push({ event, data });
      return;
    }
    this.socket.emit(event, data);
  }

  /**
   * Listen for event from server
   * Always works because socket is initialized in constructor
   */
  on(event: string, callback: (...args: any[]) => void): void {
    this.socket.on(event, callback);
  }

  /**
   * Listen for event once
   */
  once(event: string, callback: (...args: any[]) => void): void {
    this.socket.once(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback?: (...args: any[]) => void): void {
    this.socket.off(event, callback);
  }

  /**
   * Flush queued events after connection
   */
  private flushEventQueue(): void {
    if (this.eventQueue.length === 0) return;

    console.log(`[SOCKET] Flushing ${this.eventQueue.length} queued events`);
    this.eventQueue.forEach(({ event, data }) => {
      this.socket.emit(event, data);
    });
    this.eventQueue = [];
  }
}

// Export singleton instance
export const socketClient = new SocketClient();
