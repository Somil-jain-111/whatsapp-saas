import { Injectable } from "@nestjs/common";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class AxiosLoggingInterceptor {
  private requestInterceptorId?: number;
  private responseInterceptorId?: number;

  constructor(private readonly httpService: HttpService) {}

  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    this.setupInterceptor();
    const response = await firstValueFrom(this.httpService.request<T>(config));
    return response.data;
  }

  private setupInterceptor() {
    // Remove previous interceptors if they exist
    if (this.requestInterceptorId !== undefined) {
      this.httpService.axiosRef.interceptors.request.eject(
        this.requestInterceptorId,
      );
    }
    if (this.responseInterceptorId !== undefined) {
      this.httpService.axiosRef.interceptors.response.eject(
        this.responseInterceptorId,
      );
    }

    // Attach new request interceptor
    this.requestInterceptorId =
      this.httpService.axiosRef.interceptors.request.use(
        (config: any) => {
          // in future add a logger

          return config;
        },
        (error) => {
          return Promise.reject(error);
        },
      );

    // Attach new response interceptor
    this.responseInterceptorId =
      this.httpService.axiosRef.interceptors.response.use(
        (response: AxiosResponse) => {
          return response;
        },
        (error) => {
          return Promise.reject(error);
        },
      );
  }
}
