import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const CONSTANTS = {
  PAGE: 1,
  SIZE: 25,
};

export const BULL_QUEUE = {
  FETCHCUSTOMERS: "fetchCustomerDetailsAPI",
};

export const FIXED_POINT_INVOICE_CATEGORY_SLUG = ["solar_invertor"];

@Injectable()
export class RewardsConfigService {
  constructor(private readonly configService: ConfigService) {}

  getRewardsApiConfig() {
    const isProd = this.configService.get("NODE_ENV") === "production";

    return {
      baseUrl: isProd
        ? `${this.configService.get(
            "Rewards_API_Base_Url_Live",
          )}/catalogue/projectWiseCatalogueProducts`
        : `${this.configService.get(
            "Rewards_API_Base_Url_Dev",
          )}/catalogue/projectWiseCatalogueProducts`,

      permanentToken: isProd
        ? this.configService.get("Rewards_API_Permanent_Token_Live")
        : this.configService.get("Rewards_API_Permanent_Token_Dev"),
    };
  }
}
