import {
  DeepPartial,
  FindManyOptions,
  FindOptionsWhere,
  QueryRunner,
  Repository,
  SelectQueryBuilder,
} from "typeorm";

export class BaseRepository<T extends object> {
  constructor(protected readonly repository: Repository<T>) {}

  getRepository(queryRunner?: QueryRunner): Repository<T> {
    return queryRunner
      ? queryRunner.manager.getRepository(this.repository.target)
      : this.repository;
  }

  create(data: DeepPartial<T>, queryRunner?: QueryRunner): T {
    const repo = this.getRepository(queryRunner);

    return repo.create(data);
  }

  async save(data: DeepPartial<T>, queryRunner?: QueryRunner): Promise<T> {
    const repo = this.getRepository(queryRunner);

    const entity = this.create(data, queryRunner);

    return await repo.save(entity);
  }

  async saveMany(
    data: DeepPartial<T>[],
    queryRunner?: QueryRunner,
  ): Promise<T[]> {
    const repo = this.getRepository(queryRunner);
    const entities = repo.create(data);
    return await repo.save(entities);
  }

  async findOne(
    where: FindOptionsWhere<T>,
    relations?: string[],
    queryRunner?: QueryRunner,
  ): Promise<T | null> {
    return await this.getRepository(queryRunner).findOne({
      where,
      relations,
    });
  }

  async findMany(
    options?: FindManyOptions<T>,
    queryRunner?: QueryRunner,
  ): Promise<T[]> {
    return await this.getRepository(queryRunner).find(options);
  }

  async findById(
    id: string | number | bigint,
    relations?: string[],
    queryRunner?: QueryRunner,
  ): Promise<T | null> {
    return await this.getRepository(queryRunner).findOne({
      where: {
        id,
      } as unknown as FindOptionsWhere<T>,
      relations,
    });
  }

  async findByIdWithRole(id: string | number | bigint): Promise<T | null> {
    return await this.repository.findOne({
      where: {
        id,
      } as unknown as FindOptionsWhere<T>,
      relations: ["roles"],
    });
  }

  async updateById(
    id: string | number | bigint,
    data: Partial<T>,
    queryRunner?: QueryRunner,
  ): Promise<boolean> {
    const repo = this.getRepository(queryRunner);

    const result = await repo.update(
      {
        id,
      } as unknown as FindOptionsWhere<T>,
      data as any,
    );

    return Number(result.affected) > 0;
  }

  async updateByCondition(
    where: FindOptionsWhere<T>,
    data: Partial<T>,
    queryRunner?: QueryRunner,
  ): Promise<boolean> {
    const repo = this.getRepository(queryRunner);

    const result = await repo.update(where, data as any);
    return Number(result.affected) > 0;
  }

  async deleteById(
    id: string | number | bigint,
    queryRunner?: QueryRunner,
  ): Promise<boolean> {
    const repo = this.getRepository(queryRunner);

    const result = await repo.delete(id as any);
    return Number(result.affected) > 0;
  }

  /**
   * Hard-`deleteById` bypasses BaseEntity's `@DeleteDateColumn` — use this instead
   * whenever the entity should be soft-deleted (recoverable).
   */
  async softDeleteById(
    id: string | number | bigint,
    queryRunner?: QueryRunner,
  ): Promise<boolean> {
    const repo = this.getRepository(queryRunner);

    const result = await repo.softDelete(id as any);
    return Number(result.affected) > 0;
  }

  async count(
    options?: FindManyOptions<T>,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    return await this.getRepository(queryRunner).count(options);
  }

  createQueryBuilder(
    alias: string,
    queryRunner?: QueryRunner,
  ): SelectQueryBuilder<T> {
    return this.getRepository(queryRunner).createQueryBuilder(alias);
  }

  async update(where: any, data: any, queryRunner?: QueryRunner) {
    return await this.getRepository(queryRunner).update(where, data);
  }
}
