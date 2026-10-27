import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PhaseOneAuthGuard } from "../guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../guards/tenant-permission.guard";
import { TenantRequest } from "../interfaces/request-context.interface";
import { AccountService } from "../services/account.service";

@Controller("whatsapp")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountService) {}

  @Get("accounts")
  @RequireWhatsappPermission("whatsapp.account.read")
  list(@Req() request: TenantRequest) {
    return this.accounts.list(request.organizationId);
  }

  @Get("accounts/:id")
  @RequireWhatsappPermission("whatsapp.account.read")
  get(@Req() request: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.accounts.get(request.organizationId, id);
  }

  @Get("accounts/:id/phone-numbers")
  @RequireWhatsappPermission("whatsapp.account.read")
  phones(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.accounts.phones(request.organizationId, id);
  }

  @Patch("phone-numbers/:id/default")
  @RequireWhatsappPermission("whatsapp.account.manage")
  async setDefault(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.accounts.setDefaultPhone(
      request.organizationId,
      request.user.id,
      id,
    );
    return { id, isDefault: true };
  }
}
