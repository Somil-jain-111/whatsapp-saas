import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class SellerWriteAccessService {
  constructor(private readonly dataSource: DataSource) {}

  async isApproved(sellerId: number): Promise<boolean> {
    const row = await this.dataSource
      .createQueryBuilder()
      .select("si.onboarding_status", "onboardingStatus")
      .addSelect("ov.status", "kycStatus")
      .from("store_information", "si")
      .leftJoin(
        "seller_kyc_overrides",
        "ov",
        "ov.seller_id = si.seller_id AND ov.deleted_at IS NULL",
      )
      .where("si.seller_id = :sellerId", { sellerId })
      .andWhere("si.deleted_at IS NULL")
      .getRawOne<{ onboardingStatus: string; kycStatus: string | null }>();

    return (
      row?.onboardingStatus === "APPROVED" && row?.kycStatus === "APPROVED"
    );
  }
}
