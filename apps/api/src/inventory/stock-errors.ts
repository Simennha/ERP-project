/** Thrown by StockService.reserve() when available stock (onHand - reserved) is less than requested. */
export class InsufficientStockError extends Error {
  constructor(
    public readonly productId: string,
    public readonly warehouseId: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(
      `Insufficient stock for product ${productId} at warehouse ${warehouseId}: requested ${requested}, available ${available}`,
    );
    this.name = 'InsufficientStockError';
  }
}

/** Thrown by commitReservation()/release() when asked to un-reserve more than is currently reserved. */
export class InvalidReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReservationError';
  }
}
