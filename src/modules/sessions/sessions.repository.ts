import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeepPartial, IsNull, MoreThan, Repository } from "typeorm";
import { SessionEntity } from "../database/entities";

@Injectable()
export class SessionsRepository {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly repository: Repository<SessionEntity>,
  ) {}

  create(data: DeepPartial<SessionEntity>): Promise<SessionEntity> {
    return this.repository.save(this.repository.create(data));
  }

  findActive(tokenHash: string): Promise<SessionEntity | null> {
    return this.repository.findOne({
      where: {
        tokenHash,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async revoke(id: string, reason: string): Promise<boolean> {
    const result = await this.repository.update(
      { id, revokedAt: IsNull() },
      { revokedAt: new Date(), revocationReason: reason },
    );
    return result.affected === 1;
  }
}
