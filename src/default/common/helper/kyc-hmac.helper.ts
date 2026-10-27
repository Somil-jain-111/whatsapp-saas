import * as crypto from "crypto";

export class KycHmacHelper {
  static generateSecretKey(data: any, secretKey: string): string {
    const body: Record<string, any> = {};

    const fields = [
      "type",
      "id_number",
      "ifsc_code",
      "transaction_id",
      "otp",
      "name_1",
      "name_2",
    ];

    for (const field of fields) {
      if (
        data?.result?.[field] !== undefined &&
        data?.result?.[field] !== null
      ) {
        body[field] = data.result[field];
      }
    }

    const requestBody = JSON.stringify(body);

    return crypto
      .createHmac("sha256", secretKey)
      .update(requestBody)
      .digest("hex");
  }
}
