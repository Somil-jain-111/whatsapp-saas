import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseRepository } from "src/default/common/repositories/base.repository";
import { UserEntity } from "../database/entities";

@Injectable()
export class UsersRepository extends BaseRepository<UserEntity> {
  constructor(
    @InjectRepository(UserEntity) repository: Repository<UserEntity>,
  ) {
    super(repository);
  }

  findByNormalizedEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOneBy({
      emailNormalized: email.trim().toLowerCase(),
    });
  }
}
