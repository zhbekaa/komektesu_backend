/** A failed action with an HTTP status the routes can return as-is. */
export class ActionError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ActionError";
    this.status = status;
  }
}
