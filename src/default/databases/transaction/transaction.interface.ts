import { EntityManager } from "typeorm";

export type TransactionCallback<T> = (manager: EntityManager) => Promise<T>;
