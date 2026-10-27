// src/default/databases/transaction/transaction.service.ts

import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, QueryRunner } from "typeorm";
import { ConsoleLogger } from "src/default/logger/console/console.service";

export type TransactionManagerCallback<T> = (
  manager: EntityManager,
) => Promise<T>;

export type TransactionQueryRunnerCallback<T> = (
  queryRunner: QueryRunner,
) => Promise<T>;

@Injectable()
export class TransactionService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Use this when you only need EntityManager
   */
  async execute<T>(callback: TransactionManagerCallback<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await callback(queryRunner.manager);

      await queryRunner.commitTransaction();

      return result;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      ConsoleLogger.error("TRANSACTION_FAILED", error?.stack, {
        tag: "TransactionService.execute",
        data: {
          message: error?.message,
        },
      });

      throw error;
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }

  /**
   * Use this when you need full queryRunner
   */
  async runInTransaction<T>(
    callback: TransactionQueryRunnerCallback<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await callback(queryRunner);

      await queryRunner.commitTransaction();

      return result;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      ConsoleLogger.error("TRANSACTION_FAILED", error?.stack, {
        tag: "TransactionService.runInTransaction",
        data: {
          message: error?.message,
        },
      });

      throw error;
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }

  getRepository<T>(manager: EntityManager, entity: new () => T) {
    return manager.getRepository(entity);
  }
}
