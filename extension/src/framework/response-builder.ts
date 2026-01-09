/**
 * Generic response builder for creating properly formatted webview messages.
 * Ensures consistent error handling and response structure across handlers.
 */
export class ResponseBuilder<T extends { kind: string; requestId: string }> {
  constructor(
    private templateFactory: (data?: any) => Omit<T, "success" | "error">
  ) {}

  /**
   * Build a success response with optional data.
   */
  success(data?: any): T & { success: true } {
    const template = this.templateFactory(data);
    return {
      ...template,
      success: true
    } as T & { success: true };
  }

  /**
   * Build an error response from an error or string.
   */
  error(error: string | Error): T & { success: false; error: string } {
    const template = this.templateFactory();
    const errorMessage = error instanceof Error ? error.message : error;
    return {
      ...template,
      success: false,
      error: errorMessage
    } as T & { success: false; error: string };
  }
}
