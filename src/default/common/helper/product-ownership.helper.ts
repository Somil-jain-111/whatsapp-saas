import { BusinessException } from "src/default/error/business.exception";
import { ERROR_CODES } from "src/default/error/error.code";
import { UserRole } from "../enums/user-type.enum";

const ADMIN_ROLES: string[] = [UserRole.SUPERADMIN, UserRole.ADMIN];

/**
 * Shared ownership check for any entity with a `sellerId`/owner column —
 * reused across products now, and whichever later modules need the same rule.
 */
export function assertOwnerOrAdmin(
  entity: { sellerId: number },
  user: { id: number; role: string[] },
): void {
  // Bigint columns come back from TypeORM as strings — normalize before comparing.
  const isOwner = Number(entity.sellerId) === Number(user.id);
  const isAdmin = user.role.some((r) => ADMIN_ROLES.includes(r));

  if (!isOwner && !isAdmin) {
    throw new BusinessException(ERROR_CODES.PRODUCT.PRODUCT_NOT_OWNED);
  }
}
