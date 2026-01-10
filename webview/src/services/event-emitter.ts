/**
 * Generic EventEmitter for pub-sub pattern.
 * Allows subscribing to events with callbacks and emitting events to all subscribers.
 */
export class EventEmitter<T> {
  private listeners: Set<(event: T) => void> = new Set();

  /**
   * Subscribe to events.
   * Returns an unsubscribe function.
   */
  on(callback: (event: T) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Subscribe to the next event only.
   */
  once(callback: (event: T) => void): () => void {
    const wrapper = (event: T) => {
      this.listeners.delete(wrapper);
      callback(event);
    };
    return this.on(wrapper);
  }

  /**
   * Emit an event to all subscribers.
   */
  emit(event: T): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("Error in event listener:", error);
      }
    });
  }

  /**
   * Get the number of active listeners.
   */
  listenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Remove all listeners.
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }
}
