import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { createHmac } from "crypto";
import { AxiosError } from "axios";
import { firstValueFrom } from "rxjs";
import { AppConfigService } from "../../../default/config/config.service";
import {
  buildMetaInteractivePayload,
  InteractiveMessage,
} from "../../messaging/interactive-message";

export interface MetaAccount {
  id: string;
  name?: string;
  account_review_status?: string;
  business_verification_status?: string;
}

export interface MetaPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  name_status?: string;
  messaging_limit_tier?: string;
}

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status?: string;
  rejected_reason?: string;
  components?: Record<string, unknown>[];
}

export interface MetaAppConfiguration {
  appId: string;
  appSecret: string;
  configurationId: string;
  graphApiVersion: string;
}

interface MetaCredential extends MetaAppConfiguration {
  accessToken: string;
}

export class MetaProviderError extends BadGatewayException {
  constructor(
    message: string,
    readonly ambiguous: boolean,
  ) {
    super(message);
  }
}

@Injectable()
export class MetaGraphProvider {
  constructor(
    private readonly http: HttpService,
    private readonly config: AppConfigService,
  ) {}

  publicConfiguration(configuration?: MetaAppConfiguration) {
    return {
      appId: configuration?.appId ?? this.required("META_APP_ID"),
      configurationId:
        configuration?.configurationId ??
        this.required("META_EMBEDDED_SIGNUP_CONFIG_ID"),
      graphApiVersion:
        configuration?.graphApiVersion ??
        this.required("META_GRAPH_API_VERSION"),
      permissions: this.required("META_REQUIRED_PERMISSIONS").split(","),
    };
  }

  async exchangeCode(
    code: string,
    configuration?: MetaAppConfiguration,
  ): Promise<{ accessToken: string; expiresIn?: number }> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ access_token?: string; expires_in?: number }>(
          `${this.baseUrl(configuration?.graphApiVersion)}/oauth/access_token`,
          {
            params: {
              client_id: configuration?.appId ?? this.required("META_APP_ID"),
              client_secret:
                configuration?.appSecret ?? this.required("META_APP_SECRET"),
              code,
            },
            timeout: this.timeout(),
          },
        ),
      );
      if (!response.data.access_token) throw new Error("Missing access token");
      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      throw this.safeError(error, "Meta authorization failed");
    }
  }

  encodeCredential(
    accessToken: string,
    configuration?: MetaAppConfiguration,
  ): string {
    if (!configuration) return accessToken;
    return `byo:v1:${Buffer.from(
      JSON.stringify({ accessToken, ...configuration }),
    ).toString("base64url")}`;
  }

  async getAccount(accessToken: string, wabaId: string): Promise<MetaAccount> {
    return this.get<MetaAccount>(
      `/${encodeURIComponent(wabaId)}`,
      accessToken,
      "id,name,account_review_status,business_verification_status",
    );
  }

  async getPhoneNumbers(
    accessToken: string,
    wabaId: string,
  ): Promise<MetaPhoneNumber[]> {
    const response = await this.get<{ data?: MetaPhoneNumber[] }>(
      `/${encodeURIComponent(wabaId)}/phone_numbers`,
      accessToken,
      "id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status,messaging_limit_tier",
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  async subscribeApp(accessToken: string, wabaId: string): Promise<void> {
    await this.post(
      `/${encodeURIComponent(wabaId)}/subscribed_apps`,
      accessToken,
      {},
    );
  }

  async createTemplate(
    accessToken: string,
    wabaId: string,
    template: Record<string, unknown>,
  ): Promise<{ id?: string; status?: string; category?: string }> {
    return this.post(
      `/${encodeURIComponent(wabaId)}/message_templates`,
      accessToken,
      template,
    );
  }

  async sendTemplate(
    accessToken: string,
    phoneNumberId: string,
    input: {
      to: string;
      name: string;
      language: string;
      parameters: Record<string, string>;
    },
  ): Promise<{ messages?: Array<{ id?: string }> }> {
    const values = Object.entries(input.parameters)
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([, text]) => ({ type: "text", text }));
    return this.post(
      `/${encodeURIComponent(phoneNumberId)}/messages`,
      accessToken,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to.replace(/^\+/, ""),
        type: "template",
        template: {
          name: input.name,
          language: { code: input.language },
          ...(values.length
            ? { components: [{ type: "body", parameters: values }] }
            : {}),
        },
      },
    );
  }

  sendText(
    accessToken: string,
    phoneNumberId: string,
    to: string,
    text: string,
  ): Promise<{ messages?: Array<{ id?: string }> }> {
    return this.post(
      `/${encodeURIComponent(phoneNumberId)}/messages`,
      accessToken,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/^\+/, ""),
        type: "text",
        text: { body: text, preview_url: false },
      },
    );
  }

  sendInteractive(
    accessToken: string,
    phoneNumberId: string,
    to: string,
    interactive: InteractiveMessage,
  ): Promise<{ messages?: Array<{ id?: string }> }> {
    return this.post(
      `/${encodeURIComponent(phoneNumberId)}/messages`,
      accessToken,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/^\+/, ""),
        type: "interactive",
        interactive: buildMetaInteractivePayload(interactive),
      },
    );
  }

  sendMedia(
    accessToken: string,
    phoneNumberId: string,
    to: string,
    type: string,
    mediaId: string,
    fileName?: string,
  ): Promise<{ messages?: Array<{ id?: string }> }> {
    return this.post(
      `/${encodeURIComponent(phoneNumberId)}/messages`,
      accessToken,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/^\+/, ""),
        type,
        [type]: {
          id: mediaId,
          ...(type === "document" && fileName ? { filename: fileName } : {}),
        },
      },
    );
  }

  async uploadMedia(
    accessToken: string,
    phoneNumberId: string,
    bytes: Buffer,
    mimeType: string,
    fileName: string,
  ): Promise<string> {
    try {
      const credential = this.credential(accessToken);
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("type", mimeType);
      form.append(
        "file",
        new Blob([new Uint8Array(bytes)], { type: mimeType }),
        fileName,
      );
      const response = await firstValueFrom(
        this.http.post<{ id?: string }>(
          `${this.baseUrl(credential.graphApiVersion)}/${encodeURIComponent(phoneNumberId)}/media`,
          form,
          {
            headers: { Authorization: `Bearer ${credential.accessToken}` },
            params: { appsecret_proof: this.appSecretProof(credential) },
            timeout: this.timeout(),
          },
        ),
      );
      if (!response.data.id) throw new Error("Missing media ID");
      return response.data.id;
    } catch (error) {
      throw this.safeError(error, "Meta media upload failed");
    }
  }

  async downloadMedia(
    accessToken: string,
    mediaId: string,
  ): Promise<{ bytes: Buffer; mimeType: string }> {
    try {
      const credential = this.credential(accessToken);
      const metadata = await firstValueFrom(
        this.http.get<{ url?: string; mime_type?: string; file_size?: number }>(
          `${this.baseUrl(credential.graphApiVersion)}/${encodeURIComponent(mediaId)}`,
          {
            headers: { Authorization: `Bearer ${credential.accessToken}` },
            params: { appsecret_proof: this.appSecretProof(credential) },
            timeout: this.timeout(),
          },
        ),
      );
      if (!metadata.data.url || !metadata.data.mime_type)
        throw new Error("Missing media metadata");
      if (Number(metadata.data.file_size ?? 0) > 16 * 1024 * 1024)
        throw new Error("Inbound media exceeds the 16 MB inbox limit");
      const url = new URL(metadata.data.url);
      const allowed = ["facebook.com", "fbcdn.net", "fbsbx.com"].some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      );
      if (url.protocol !== "https:" || !allowed)
        throw new Error("Unexpected Meta media host");
      const response = await firstValueFrom(
        this.http.get<ArrayBuffer>(url.toString(), {
          headers: { Authorization: `Bearer ${credential.accessToken}` },
          responseType: "arraybuffer",
          maxContentLength: 16 * 1024 * 1024,
          maxBodyLength: 16 * 1024 * 1024,
          timeout: this.timeout(),
        }),
      );
      return {
        bytes: Buffer.from(response.data),
        mimeType: metadata.data.mime_type,
      };
    } catch (error) {
      throw this.safeError(error, "Meta media download failed");
    }
  }

  async listTemplates(
    accessToken: string,
    wabaId: string,
    after?: string,
  ): Promise<{ data: MetaTemplate[]; after?: string }> {
    const response = await this.get<{
      data?: MetaTemplate[];
      paging?: { cursors?: { after?: string } };
    }>(
      `/${encodeURIComponent(wabaId)}/message_templates`,
      accessToken,
      "id,name,language,category,status,rejected_reason,components",
      after,
    );
    return {
      data: Array.isArray(response.data) ? response.data : [],
      after: response.paging?.cursors?.after,
    };
  }

  private async get<T>(
    path: string,
    token: string,
    fields: string,
    after?: string,
  ): Promise<T> {
    const credential = this.credential(token);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await firstValueFrom(
          this.http.get<T>(`${this.baseUrl(credential.graphApiVersion)}${path}`, {
            headers: { Authorization: `Bearer ${credential.accessToken}` },
            params: {
              fields,
              appsecret_proof: this.appSecretProof(credential),
              ...(after ? { after } : {}),
            },
            timeout: this.timeout(),
          }),
        );
        return response.data;
      } catch (error) {
        const retryable = this.isRetryable(error);
        if (!retryable || attempt === 2)
          throw this.safeError(error, "Meta API request failed");
        await new Promise((resolve) =>
          setTimeout(resolve, 150 * 2 ** attempt + Math.random() * 100),
        );
      }
    }
    throw new ServiceUnavailableException("Meta API request failed");
  }

  private async post<T>(
    path: string,
    token: string,
    body: unknown,
  ): Promise<T> {
    const credential = this.credential(token);
    try {
      const response = await firstValueFrom(
        this.http.post<T>(`${this.baseUrl(credential.graphApiVersion)}${path}`, body, {
          headers: { Authorization: `Bearer ${credential.accessToken}` },
          params: { appsecret_proof: this.appSecretProof(credential) },
          timeout: this.timeout(),
        }),
      );
      return response.data;
    } catch (error) {
      // Provider writes are not retried: a timeout can occur after Meta committed it.
      throw this.safeError(error, "Meta API write failed");
    }
  }

  private appSecretProof(credential: MetaCredential): string {
    return createHmac("sha256", credential.appSecret)
      .update(credential.accessToken)
      .digest("hex");
  }

  private credential(value: string): MetaCredential {
    if (value.startsWith("byo:v1:")) {
      try {
        const parsed = JSON.parse(
          Buffer.from(value.slice(7), "base64url").toString("utf8"),
        ) as MetaCredential;
        if (
          !parsed.accessToken ||
          !parsed.appSecret ||
          !/^v\d+\.\d+$/.test(parsed.graphApiVersion)
        )
          throw new Error("Invalid credential package");
        return parsed;
      } catch {
        throw new ServiceUnavailableException("Meta credential is invalid");
      }
    }
    return {
      accessToken: value,
      appId: this.required("META_APP_ID"),
      appSecret: this.required("META_APP_SECRET"),
      configurationId: this.required("META_EMBEDDED_SIGNUP_CONFIG_ID"),
      graphApiVersion: this.required("META_GRAPH_API_VERSION"),
    };
  }

  private isRetryable(error: unknown): boolean {
    if (!(error instanceof AxiosError)) return false;
    return (
      !error.response ||
      error.response.status === 429 ||
      error.response.status >= 500
    );
  }

  private safeError(error: unknown, message: string): Error {
    if (error instanceof AxiosError && error.response?.status === 429) {
      return new ServiceUnavailableException(
        `${message}; provider rate limit reached`,
      );
    }
    const definitiveRejection =
      error instanceof AxiosError &&
      Boolean(error.response) &&
      error.response!.status >= 400 &&
      error.response!.status < 500;
    return new MetaProviderError(message, !definitiveRejection);
  }

  private baseUrl(version?: string): string {
    const root = this.required("META_GRAPH_BASE_URL").replace(/\/$/, "");
    return `${root}/${version ?? this.required("META_GRAPH_API_VERSION")}`;
  }

  private timeout(): number {
    return this.config.get<number>("META_REQUEST_TIMEOUT_MS", 8000);
  }

  private required(name: string): string {
    const value = this.config.get<string>(name);
    if (!value)
      throw new ServiceUnavailableException(
        "Meta integration is not configured",
      );
    return value;
  }
}
